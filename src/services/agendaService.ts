import {
  CLIENT_SEED,
  PROFESSIONAL_SEED,
  SERVICE_SEED,
  TIME_SLOTS,
  TODAY_APPOINTMENTS,
} from '@/data/mock';
import type {
  Appointment,
  AppointmentStatus,
  DayState,
  PaymentMethod,
  ProfessionalRecord,
  ScheduleBlock,
  ServiceItem,
} from '@/data/types';
import { dateKey, isSameDay } from '@/utils/format';
import { intBetween, pick, seeded, shuffle } from '@/utils/random';
import { overlaps, toMinutes } from '@/utils/time';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { isoToLocal, localToISO } from './mappers';
import {
  dropAppointment,
  getOverlay,
  getState,
  nextId,
  patchOverlay,
  upsertAppointment,
} from './store';

/**
 * AGENDA
 *
 * Fonte única de tudo que envolve atendimento: dashboard, fichas de cliente,
 * ranking da equipe, caixa e relatórios são leituras derivadas daqui.
 *
 * ## Com banco
 *
 * A leitura vem da janela que `loadCompanyData` trouxe (180 dias para trás, 90
 * para frente) e a escrita vai para as RPCs transacionais. Nada de otimismo: o
 * horário livre quem decide é a constraint de exclusão do Postgres.
 *
 * ## Sem `.env.local` (modo mock)
 *
 * Duas camadas somadas:
 *
 * 1. **Base determinística** — a mesma data sempre gera os mesmos horários. É
 *    o que dá histórico ao sistema sem precisar de banco, e o que faz o
 *    dashboard mostrar números para meses que ninguém abriu.
 * 2. **Overlay** — o que o usuário criou, alterou ou removeu naquele dia.
 *
 * A base lê as sementes, não o store. Se o gerador consultasse o catálogo
 * editável, mudar o preço do corte hoje reescreveria o faturamento de março — e
 * o "desativar sem perder histórico" do módulo de serviços viraria mentira.
 * Passado é passado: o preço praticado fica gravado no atendimento, que é
 * também o que `appointment_services` congela no banco.
 */

/* ==========================================================================
   PREÇO E DURAÇÃO
   ========================================================================= */

/** Tabela do profissional quando existe; preço de balcão quando não. */
export function priceFor(service: ServiceItem, professionalId: string) {
  return service.priceOverrides[professionalId] ?? service.priceCents;
}

/**
 * Tempo total que o atendimento ocupa na cadeira.
 *
 * As durações somam; o preparo, não. Dois serviços seguidos usam a mesma
 * higienização no fim — cobrar o buffer duas vezes inflaria a agenda e
 * derrubaria artificialmente a taxa de ocupação.
 */
export function durationFor(services: ServiceItem[]) {
  const work = services.reduce((acc, s) => acc + s.durationMin, 0);
  const buffer = services.reduce((acc, s) => Math.max(acc, s.bufferMin), 0);
  return work + buffer;
}

/* ==========================================================================
   CAMADA 1 — BASE DETERMINÍSTICA
   ========================================================================= */

/** Serviços simples da semente: combo é embalagem de outros, não entra no sorteio. */
const SEED_SERVICES = SERVICE_SEED.filter((s) => s.comboOf.length === 0);

const SEED_STAFF = PROFESSIONAL_SEED.filter((p) => p.active);

/**
 * Mistura de meios de pagamento de uma clínica brasileira.
 *
 * A repetição é o peso: sorteando uniformemente desta lista, o Pix responde por
 * ~40% e o dinheiro por ~13%, que é a proporção realista hoje. Uma distribuição
 * plana daria 25% para cada e faria a conciliação parecer inventada.
 */
/**
 * Clientes em ordem de cadastro, com os carimbos ao lado.
 *
 * Serve para o gerador só sortear quem já era cliente na data. Sem isso, uma
 * ficha aberta ontem apareceria em atendimentos de um ano atrás — e o relatório
 * de retenção acusava 100% de recorrentes para sempre, porque todo mundo
 * "já tinha vindo antes" de qualquer período analisado.
 */
const CLIENTS_BY_SIGNUP = [...CLIENT_SEED].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const SIGNUP_TIMES = CLIENTS_BY_SIGNUP.map((c) => new Date(c.createdAt).getTime());

/** Quantos clientes já existiam ao fim do dia informado. Busca binária. */
function signedUpCount(date: Date) {
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).getTime();

  let low = 0;
  let high = SIGNUP_TIMES.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (SIGNUP_TIMES[mid] <= endOfDay) low = mid + 1;
    else high = mid;
  }
  return low;
}

const PAYMENT_MIX: PaymentMethod[] = [
  'pix', 'pix', 'pix', 'pix', 'pix', 'pix',
  'credito', 'credito', 'credito', 'credito',
  'debito', 'debito', 'debito',
  'dinheiro', 'dinheiro',
];

export function resolveDayState(date: Date): DayState {
  const today = new Date();
  if (isSameDay(date, today)) return 'today';
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() < startOfToday.getTime() ? 'past' : 'future';
}

function statusForSlot(rnd: () => number, dayState: DayState, slotMinutes: number): AppointmentStatus {
  if (dayState === 'past') {
    const roll = rnd();
    // Falta e cancelamento existem em taxa realista — sem eles, o índice de
    // faltas do módulo de clientes seria sempre zero e não mediria nada.
    if (roll > 0.94) return 'cancelado';
    if (roll > 0.88) return 'falta';
    return 'concluido';
  }
  if (dayState === 'future') return 'agendado';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (slotMinutes < nowMinutes - 45) return 'concluido';
  if (slotMinutes <= nowMinutes) return 'em_andamento';
  return 'agendado';
}

/** A agenda que a data produziria se ninguém tivesse mexido nela. */
export function baseAppointments(date: Date): Appointment[] {
  const key = dateKey(date);
  const dayState = resolveDayState(date);

  if (dayState === 'today') {
    return TODAY_APPOINTMENTS.map((a, i) => {
      const client = CLIENT_SEED.find((c) => c.id === a.clientId);
      return {
        ...a,
        id: `${key}-${i}`,
        client: client?.name ?? 'Paciente',
      };
    });
  }

  const rnd = seeded(key);
  const weekday = date.getDay();
  if (weekday === 0) return []; // domingo fechado

  const count = weekday === 6 ? intBetween(rnd, 8, 11) : intBetween(rnd, 4, 8);
  const slots = shuffle(rnd, TIME_SLOTS).slice(0, count).sort();

  // Só quem já era cliente naquele dia. Com a base ainda pequena no passado
  // remoto, cai para a lista inteira em vez de devolver um dia vazio.
  const known = signedUpCount(date);
  const pool = known > 0 ? CLIENTS_BY_SIGNUP.slice(0, known) : CLIENT_SEED;

  return slots.map((time, i) => {
    const primary = pick(rnd, SEED_SERVICES);
    const extra = pick(rnd, SEED_SERVICES);
    const paired = rnd() > 0.55 && extra.id !== primary.id;
    const chosen = paired ? [primary, extra] : [primary];
    const professional = pick(rnd, SEED_STAFF);
    const client = pick(rnd, pool);

    return {
      id: `${key}-${i}`,
      time,
      client: client.name,
      clientId: client.id,
      services: chosen.map((s) => s.name),
      serviceIds: chosen.map((s) => s.id),
      professionalId: professional.id,
      status: statusForSlot(rnd, dayState, toMinutes(time)),
      priceCents: chosen.reduce((acc, s) => acc + priceFor(s, professional.id), 0),
      durationMin: durationFor(chosen),
      // A forma de pagamento também é semeada: sem ela a conciliação do
      // financeiro não teria o que conferir, e uma tela de conciliação vazia
      // não prova nada sobre o mecanismo.
      paymentMethod: pick(rnd, PAYMENT_MIX),
    } satisfies Appointment;
  });
}

/* ==========================================================================
   CAMADA 2 — BASE + OVERLAY
   ========================================================================= */

const byTime = (a: Appointment, b: Appointment) => a.time.localeCompare(b.time);

/**
 * Índice por dia da janela carregada do banco.
 *
 * `listByDate` é chamada uma vez por painel e várias vezes por `listRange` —
 * um relatório anual a chama 365 vezes. Varrer a janela inteira a cada chamada
 * seria quadrático; o índice é reconstruído só quando o array troca de
 * identidade, o que só acontece numa gravação ou numa recarga.
 */
let indexedFrom: Appointment[] | null = null;
let byDay = new Map<string, Appointment[]>();

function dayIndex(): Map<string, Appointment[]> {
  const { appointments } = getState();
  if (appointments === indexedFrom) return byDay;

  const map = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    if (!appointment.date) continue;
    const list = map.get(appointment.date);
    if (list) list.push(appointment);
    else map.set(appointment.date, [appointment]);
  }
  for (const list of map.values()) list.sort(byTime);

  indexedFrom = appointments;
  byDay = map;
  return map;
}

/** A agenda real do dia: o que foi gerado, corrigido pelo que o usuário fez. */
export function listByDate(date: Date): Appointment[] {
  const key = dateKey(date);

  // Com banco, a agenda é o que está gravado — sem base gerada e sem overlay.
  // Fora da janela carregada o dia vem vazio, e é honesto que venha: inventar
  // atendimentos aqui é exatamente o defeito que esta migração corrige.
  if (isSupabaseConfigured) return dayIndex().get(key) ?? [];

  const overlay = getOverlay(key);
  const removed = new Set(overlay.removed);

  const base = baseAppointments(date)
    .filter((a) => !removed.has(a.id))
    .map((a) => (overlay.patched[a.id] ? { ...a, ...overlay.patched[a.id] } : a));

  const created = overlay.created
    .filter((a) => !removed.has(a.id))
    .map((a) => (overlay.patched[a.id] ? { ...a, ...overlay.patched[a.id] } : a));

  return [...base, ...created].sort(byTime);
}

/** Percorre um intervalo fechado de datas. Base do histórico e dos relatórios. */
export function listRange(from: Date, to: Date): Appointment[] {
  const out: Appointment[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor.getTime() <= last.getTime()) {
    for (const appointment of listByDate(new Date(cursor))) out.push(appointment);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Igual a `listRange`, mas guarda a data de cada atendimento. */
export function listRangeDated(from: Date, to: Date): Array<{ date: Date; appointment: Appointment }> {
  const out: Array<{ date: Date; appointment: Appointment }> = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor.getTime() <= last.getTime()) {
    const day = new Date(cursor);
    for (const appointment of listByDate(day)) out.push({ date: day, appointment });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/* ==========================================================================
   BLOQUEIOS
   ========================================================================= */

export function blocksFor(date: Date, professionalId?: string): ScheduleBlock[] {
  const key = dateKey(date);
  return getState().blocks.filter(
    (b) =>
      b.date === key &&
      (professionalId === undefined || b.professionalId === 'all' || b.professionalId === professionalId),
  );
}

/* ==========================================================================
   ESCRITA
   ========================================================================= */

export interface AppointmentDraft {
  time: string;
  clientId: string;
  serviceIds: string[];
  professionalId: string;
  status: AppointmentStatus;
  notes?: string;
  paymentMethod?: PaymentMethod;
}

/** Monta o atendimento a partir do catálogo **vigente** e congela preço e duração. */
function compose(draft: AppointmentDraft, id: string, date: string): Appointment | null {
  const { services, clients } = getState();
  const chosen = draft.serviceIds
    .map((sid) => services.find((s) => s.id === sid))
    .filter((s): s is ServiceItem => Boolean(s));

  if (chosen.length === 0) return null;
  const client = clients.find((c) => c.id === draft.clientId);
  if (!client) return null;

  return {
    id,
    date,
    time: draft.time,
    client: client.name,
    clientId: client.id,
    services: chosen.map((s) => s.name),
    serviceIds: chosen.map((s) => s.id),
    professionalId: draft.professionalId,
    status: draft.status,
    priceCents: chosen.reduce((acc, s) => acc + priceFor(s, draft.professionalId), 0),
    durationMin: durationFor(chosen),
    notes: draft.notes,
    paymentMethod: draft.paymentMethod,
  };
}

/* ==========================================================================
   PONTE COM AS RPCs
   ========================================================================= */

/** A linha de `appointments` que as funções transacionais devolvem. */
interface BookedRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number | string;
  payment_method: PaymentMethod | null;
  notes: string;
  professional_id: string;
  client_id: string;
}

/**
 * Mensagens para os códigos que as funções levantam sem `detail`.
 *
 * Quando o banco manda o detalhe — o caso de `validate_slot`, que explica
 * *qual* regra barrou — é ele que aparece: repetir a explicação aqui criaria
 * duas versões da mesma regra para divergirem com o tempo.
 */
const RPC_MESSAGES: Record<string, string> = {
  NAO_ENCONTRADO: 'O atendimento não existe mais. Recarregue a agenda.',
  SEM_PERMISSAO: 'Você não tem permissão para alterar esta agenda.',
  JA_CONCLUIDO: 'Atendimento concluído não pode ser remarcado.',
  SLOT_OCUPADO: 'Esse horário acabou de ser preenchido.',
  SLOT_INVALIDO: 'Horário indisponível.',
  CLIENTE_INVALIDO: 'O paciente não pertence a esta clínica.',
  SEM_SERVICO: 'Selecione ao menos um procedimento.',
  FORA_DA_JANELA: 'O cancelamento está fora da janela permitida.',
};

function rpcError(error: { message: string; details?: string | null }): string {
  const detail = error.details?.trim();
  if (detail) return detail;
  return RPC_MESSAGES[error.message.trim()] ?? error.message;
}

/**
 * A linha crua vira o atendimento que a grade desenha.
 *
 * Instantes, total e status vêm do banco — são a verdade. Os rótulos (nome do
 * cliente, nomes dos serviços) saem do catálogo em memória: é exatamente o que
 * a próxima recarga traria pelos joins, e evita uma segunda ida ao servidor só
 * para reescrever texto que já está na tela.
 */
function fromBooked(row: BookedRow, serviceIds: string[]): Appointment {
  const { services, clients, timezone } = getState();
  const local = isoToLocal(row.starts_at, timezone);

  return {
    id: row.id,
    date: local.date,
    time: local.time,
    client: clients.find((c) => c.id === row.client_id)?.name ?? 'Cliente',
    clientId: row.client_id,
    services: serviceIds.map((sid) => services.find((s) => s.id === sid)?.name ?? 'Serviço'),
    serviceIds,
    professionalId: row.professional_id,
    status: row.status,
    priceCents: Number(row.price_cents),
    durationMin: Math.round(
      (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000,
    ),
    notes: row.notes || undefined,
    paymentMethod: row.payment_method ?? undefined,
  };
}

/** Contexto de escrita. Ausente, o modo banco não tem onde gravar. */
function writeContext() {
  const { companyId, timezone } = getState();
  if (!supabase || !companyId) return null;
  return { sb: supabase, companyId, timezone };
}

/** Fallback para atendimentos antigos que não gravaram duração. */
const spanOf = (a: Appointment) => a.durationMin ?? 30;

/** O profissional trabalha nesse dia e nessa faixa? */
function withinShift(record: ProfessionalRecord, date: Date, start: number, end: number) {
  const shift = record.schedule[date.getDay()];
  if (!shift) return false;
  if (start < toMinutes(shift.start) || end > toMinutes(shift.end)) return false;
  if (shift.breakStart && shift.breakEnd) {
    return !overlaps(start, end, toMinutes(shift.breakStart), toMinutes(shift.breakEnd));
  }
  return true;
}

/**
 * Valida um horário e devolve o motivo da recusa, ou `null` se estiver livre.
 *
 * Esta é a regra que o banco vai repetir com `EXCLUDE USING gist` quando o
 * Supabase entrar (decisão D6 da arquitetura). Aqui ela é conveniência de UX;
 * lá será a barreira real contra dois clientes no mesmo horário.
 */
export function validateSlot(
  date: Date,
  draft: AppointmentDraft,
  ignoreId?: string,
): string | null {
  const { services, professionals, settings } = getState();

  const chosen = draft.serviceIds
    .map((sid) => services.find((s) => s.id === sid))
    .filter((s): s is ServiceItem => Boolean(s));

  if (chosen.length === 0) return 'Selecione ao menos um procedimento.';

  const record = professionals.find((p) => p.id === draft.professionalId);
  if (!record) return 'Profissional não encontrado.';
  if (!record.active) return `${record.name} está inativo na equipe.`;

  const start = toMinutes(draft.time);
  const end = start + durationFor(chosen);

  const day = settings.hours[date.getDay()];
  if (!day || day.closed) return 'A clínica não abre nesse dia.';
  if (start < toMinutes(day.open) || end > toMinutes(day.close)) {
    return `Fora do horário de funcionamento (${day.open} às ${day.close}).`;
  }
  if (settings.holidays.includes(dateKey(date))) return 'A data está marcada como feriado.';

  if (!withinShift(record, date, start, end)) {
    return `Fora da jornada de ${record.name.split(' ')[0]} nesse dia.`;
  }

  const notOffered = chosen.find(
    (s) => record.serviceIds.length > 0 && !record.serviceIds.includes(s.id),
  );
  if (notOffered) return `${record.name.split(' ')[0]} não executa ${notOffered.name}.`;

  const inactive = chosen.find((s) => !s.active);
  if (inactive) return `${inactive.name} está desativado no catálogo.`;

  for (const block of blocksFor(date, draft.professionalId)) {
    if (overlaps(start, end, toMinutes(block.start), toMinutes(block.end))) {
      return `Conflito com bloqueio: ${block.reason || 'horário indisponível'}.`;
    }
  }

  if (!settings.booking.allowOverbooking) {
    const clash = listByDate(date).find((a) => {
      if (a.id === ignoreId) return false;
      if (a.professionalId !== draft.professionalId) return false;
      if (a.status === 'cancelado' || a.status === 'falta') return false;
      const aStart = toMinutes(a.time);
      return overlaps(start, end, aStart, aStart + spanOf(a));
    });
    if (clash) return `${record.name.split(' ')[0]} já atende ${clash.client} às ${clash.time}.`;
  }

  return null;
}

/**
 * As cinco escritas são assíncronas — e só elas.
 *
 * A leitura continua síncrona porque a janela já está em memória; a gravação
 * não pode ser, porque quem decide se o horário está livre é o Postgres. Pintar
 * o bloco na grade antes da resposta e desfazer depois seria o pior dos mundos
 * justamente na operação de maior valor: dois clientes veriam "agendado" e um
 * deles descobriria o contrário meio segundo depois.
 *
 * `validateSlot` roda antes assim mesmo. Não é a barreira — é o que evita a ida
 * ao servidor quando o erro é óbvio, e o que dá a mensagem na hora de digitar.
 */
export async function createAppointment(date: Date, draft: AppointmentDraft) {
  const error = validateSlot(date, draft);
  if (error) return { ok: false as const, error };

  const key = dateKey(date);
  const composed = compose(draft, nextId('a'), key);
  if (!composed) return { ok: false as const, error: 'Dados incompletos.' };

  if (!isSupabaseConfigured) {
    patchOverlay(key, (day) => ({ ...day, created: [...day.created, composed] }));
    return { ok: true as const, appointment: composed };
  }

  const ctx = writeContext();
  if (!ctx) return { ok: false as const, error: 'Sessão sem clínica ativa.' };

  const { data, error: failure } = await ctx.sb.rpc('book_appointment', {
    p_company: ctx.companyId,
    p_professional: draft.professionalId,
    p_client: draft.clientId,
    p_services: draft.serviceIds,
    p_starts_at: localToISO(key, draft.time, ctx.timezone),
    p_status: draft.status,
    p_payment: draft.paymentMethod ?? null,
    p_notes: draft.notes ?? '',
  });

  if (failure) return { ok: false as const, error: rpcError(failure) };

  const appointment = fromBooked(data as BookedRow, draft.serviceIds);
  upsertAppointment(appointment);
  return { ok: true as const, appointment };
}

export async function updateAppointment(date: Date, id: string, draft: AppointmentDraft) {
  const error = validateSlot(date, draft, id);
  if (error) return { ok: false as const, error };

  const key = dateKey(date);
  const composed = compose(draft, id, key);
  if (!composed) return { ok: false as const, error: 'Dados incompletos.' };

  if (!isSupabaseConfigured) {
    patchOverlay(key, (day) => {
      const isLocal = day.created.some((a) => a.id === id);
      if (isLocal) {
        return { ...day, created: day.created.map((a) => (a.id === id ? composed : a)) };
      }
      return { ...day, patched: { ...day.patched, [id]: composed } };
    });
    return { ok: true as const, appointment: composed };
  }

  const ctx = writeContext();
  if (!ctx) return { ok: false as const, error: 'Sessão sem clínica ativa.' };

  const { data, error: failure } = await ctx.sb.rpc('update_appointment', {
    p_appointment: id,
    p_professional: draft.professionalId,
    p_client: draft.clientId,
    p_services: draft.serviceIds,
    p_starts_at: localToISO(key, draft.time, ctx.timezone),
    p_status: draft.status,
    p_payment: draft.paymentMethod ?? null,
    p_notes: draft.notes ?? '',
  });

  if (failure) return { ok: false as const, error: rpcError(failure) };

  const appointment = fromBooked(data as BookedRow, draft.serviceIds);
  upsertAppointment(appointment);
  return { ok: true as const, appointment };
}

/** Muda só o estado — não revalida horário, porque o horário não mudou. */
export async function setAppointmentStatus(date: Date, id: string, status: AppointmentStatus) {
  if (!isSupabaseConfigured) {
    patchOverlay(dateKey(date), (day) => {
      const isLocal = day.created.some((a) => a.id === id);
      if (isLocal) {
        return { ...day, created: day.created.map((a) => (a.id === id ? { ...a, status } : a)) };
      }
      return { ...day, patched: { ...day.patched, [id]: { ...day.patched[id], status } } };
    });
    return { ok: true as const };
  }

  const ctx = writeContext();
  if (!ctx) return { ok: false as const, error: 'Sessão sem clínica ativa.' };

  // Cancelar não é escrever `status = 'cancelado'`: a função checa a janela de
  // antecedência que a clínica configurou e registra o motivo na nota.
  if (status === 'cancelado') {
    const { data, error } = await ctx.sb.rpc('cancel_appointment', { p_appointment: id });
    if (error) return { ok: false as const, error: rpcError(error) };

    const row = data as BookedRow;
    const current = getState().appointments.find((a) => a.id === id);
    upsertAppointment(fromBooked(row, current?.serviceIds ?? []));
    return { ok: true as const };
  }

  const { error } = await ctx.sb.from('appointments').update({ status }).eq('id', id);
  if (error) return { ok: false as const, error: rpcError(error) };

  const current = getState().appointments.find((a) => a.id === id);
  if (current) upsertAppointment({ ...current, status });
  return { ok: true as const };
}

/**
 * Remove de vez.
 *
 * No modo mock, registros gerados não podem ser apagados da base — ela é uma
 * função pura da data — então o id entra numa lista de exclusão que a leitura
 * respeita. Com banco é um `delete` de verdade, e `appointment_services` cai
 * junto pelo `on delete cascade`.
 */
export async function removeAppointment(date: Date, id: string) {
  if (!isSupabaseConfigured) {
    patchOverlay(dateKey(date), (day) => ({
      ...day,
      created: day.created.filter((a) => a.id !== id),
      removed: day.removed.includes(id) ? day.removed : [...day.removed, id],
    }));
    return { ok: true as const };
  }

  const ctx = writeContext();
  if (!ctx) return { ok: false as const, error: 'Sessão sem clínica ativa.' };

  const { error } = await ctx.sb.from('appointments').delete().eq('id', id);
  if (error) return { ok: false as const, error: rpcError(error) };

  dropAppointment(id);
  return { ok: true as const };
}

/**
 * Reagendamento que atravessa o dia.
 *
 * Com banco não existe "mover": a data está dentro de `starts_at`, e
 * `update_appointment` já revalida o horário no destino. No modo mock o
 * atendimento precisa sair de um overlay e entrar em outro, porque lá o dia é
 * a chave do armazenamento.
 */
export async function moveAppointment(from: Date, id: string, to: Date, draft: AppointmentDraft) {
  if (isSupabaseConfigured || isSameDay(from, to)) return updateAppointment(to, id, draft);

  const error = validateSlot(to, draft);
  if (error) return { ok: false as const, error };

  const key = dateKey(to);
  const composed = compose(draft, nextId('a'), key);
  if (!composed) return { ok: false as const, error: 'Dados incompletos.' };

  await removeAppointment(from, id);
  patchOverlay(key, (day) => ({ ...day, created: [...day.created, composed] }));
  return { ok: true as const, appointment: composed };
}
