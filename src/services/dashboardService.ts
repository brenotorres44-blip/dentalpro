import { SERVICE_SEED, TIME_SLOTS, toProduct, toProfessional } from '@/data/mock';
import type {
  Appointment,
  DashboardSnapshot,
  DayState,
  Professional,
  RevenuePoint,
  ServiceStat,
} from '@/data/types';
import { dateKey } from '@/utils/format';
import { between, seeded } from '@/utils/random';
import { listByDate, listRangeDated, resolveDayState } from './agendaService';
import { getState } from './store';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isBillable } from './insightsService';

/**
 * Camada de dados do dashboard.
 *
 * Não gera mais nada por conta própria: a agenda vem de `agendaService`, a
 * equipe e o estoque vêm do store. É o que sustenta a regra de que dois números
 * na mesma tela nunca se contradizem — marcar um atendimento como concluído no
 * módulo de agendamentos move o faturamento do dia aqui, na mesma leitura.
 *
 * A assinatura `getDashboardSnapshot(date) => DashboardSnapshot` continua sendo
 * o contrato: quando o Supabase entrar, só o corpo muda.
 */

// --- constantes de calibragem ----------------------------------------------

/**
 * Números de vitrine do mês corrente — **só no modo demonstração**.
 *
 * Eles existiam para o painel abrir cheio sem banco nenhum, e isso continua
 * válido sem `.env.local`. Com banco, eram uma mentira de primeira tela: uma
 * clínica criada há um minuto abria com R$ 48.750 de faturamento, 1.246
 * clientes e 78% de ocupação — e, no mesmo painel, "sem atendimentos", equipe
 * zero e ticket R$ 0,00. Dois números da mesma tela se contradizendo é
 * exatamente o que a regra 8 proíbe, e o pior lugar para isso acontecer é o
 * primeiro minuto de uso.
 *
 * Daqui para baixo, tudo que é `CANONICAL` está atrás de `modoDemonstracao`.
 */
const CANONICAL = {
  monthRevenueCents: 4_875_000,
  monthRevenueDelta: 12.5,
  totalCustomers: 1246,
  newCustomers: 28,
  occupancy: 78,
};

const DAILY_CAPACITY = TIME_SLOTS.length; // slots × dia, por clínica

/** Sem `.env.local` não há o que derivar: o painel vive de semente. */
const modoDemonstracao = () => !isSupabaseConfigured;

/** Primeiro e último instante do mês da data — a janela de tudo que é "do mês". */
function mesDe(date: Date): { from: Date; to: Date } {
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 0),
  };
}

/**
 * Variação percentual entre dois períodos.
 *
 * Devolve `undefined` quando não há base de comparação — mês anterior zerado.
 * `0%` ali seria uma afirmação ("ficou igual") sobre um mês que não existiu, e
 * é a mesma escolha que o painel da plataforma faz com a série de MRR.
 */
function variacao(atual: number, anterior: number): number | undefined {
  if (!anterior) return undefined;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

/** Soma faturável de uma janela, lendo a mesma agenda que todo o resto lê. */
function faturamentoDe(from: Date, to: Date): number {
  let total = 0;
  for (const { appointment } of listRangeDated(from, to)) {
    if (isBillable(appointment)) total += appointment.priceCents;
  }
  return total;
}

/** Distância em meses entre a data e o mês corrente (0 = mês atual). */
function monthOffset(date: Date) {
  const now = new Date();
  return (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
}

// --- geradores --------------------------------------------------------------

function buildProfessionals(dayState: DayState, appointments: Appointment[]): Professional[] {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (a.status === 'cancelado' || a.status === 'falta') continue;
    counts.set(a.professionalId, (counts.get(a.professionalId) ?? 0) + 1);
  }

  return getState()
    .professionals.map(toProfessional)
    .map((p) => {
      const appointmentsToday = counts.get(p.id) ?? 0;

      // Só o dia corrente tem estado ao vivo. Passado é turno encerrado,
      // futuro é escala prevista — inventar "atendendo" num dia futuro seria mentira.
      let status = p.status;
      if (dayState === 'past') status = 'offline';
      else if (dayState === 'future') status = appointmentsToday > 0 ? 'disponivel' : 'offline';

      return { ...p, status, appointmentsToday };
    });
}

/**
 * Reparte o faturamento do mês entre os serviços e deriva a quantidade a partir
 * do preço de cada um.
 *
 * A ordem importa: se as quantidades viessem primeiro e a receita fosse
 * `count × price`, o total do painel de serviços não bateria com o card de
 * faturamento — dois números na mesma tela discordando é o tipo de detalhe que
 * faz o usuário deixar de confiar no sistema inteiro.
 *
 * Usa as sementes, e não o catálogo editável, pelo mesmo motivo que o gerador
 * da agenda: mexer no preço hoje não pode reescrever o mês passado.
 */
/**
 * Serviços do mês, contados um a um na agenda.
 *
 * O caminho da demonstração reparte um total; este conta. A diferença aparece
 * na clínica nova: repartir R$ 0 entre sete serviços dá sete linhas de zero,
 * e contar dá lista vazia — que é a verdade, e o que `EmptyState` sabe exibir.
 */
function servicosReais(date: Date): ServiceStat[] {
  const { from, to } = mesDe(date);
  const catalogo = new Map(getState().services.map((s) => [s.id, s.name]));
  const porServico = new Map<string, ServiceStat>();

  for (const { appointment } of listRangeDated(from, to)) {
    if (!isBillable(appointment)) continue;

    const ids = appointment.serviceIds?.length ? appointment.serviceIds : [];
    const rotulos = appointment.services;

    // O preço do atendimento é um só, mesmo com três serviços. Rateio por
    // quantidade mantém a soma das linhas igual ao card de faturamento — a
    // razão de existir desta função é justamente as duas não divergirem.
    const fatia = Math.round(appointment.priceCents / Math.max(ids.length || rotulos.length, 1));

    const chaves = ids.length ? ids : rotulos;
    chaves.forEach((chave, i) => {
      const nome = ids.length ? (catalogo.get(chave) ?? rotulos[i] ?? 'Serviço') : chave;
      const atual = porServico.get(chave) ?? { id: chave, name: nome, count: 0, revenueCents: 0 };
      atual.count += 1;
      atual.revenueCents += fatia;
      porServico.set(chave, atual);
    });
  }

  return [...porServico.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

function buildServiceStats(date: Date, monthRevenueCents: number): ServiceStat[] {
  const catalog = SERVICE_SEED.filter((s) => s.weight > 0);
  const rnd = seeded(`svc-${date.getFullYear()}-${date.getMonth()}`);

  const weights = catalog.map((s) => s.weight * between(rnd, 0.88, 1.12));
  const sum = weights.reduce((acc, w) => acc + w, 0) || 1;

  const stats = catalog.map((s, i) => {
    const revenueCents = Math.round((weights[i] / sum) * monthRevenueCents);
    return {
      id: s.id,
      name: s.name,
      count: Math.max(1, Math.round(revenueCents / s.priceCents)),
      revenueCents,
    };
  });

  // Joga a sobra do arredondamento no maior serviço para fechar exatamente.
  const drift = monthRevenueCents - stats.reduce((acc, s) => acc + s.revenueCents, 0);
  if (drift !== 0) {
    const top = stats.reduce((a, b) => (a.revenueCents >= b.revenueCents ? a : b));
    top.revenueCents += drift;
  }

  return stats;
}

/**
 * Faturamento dia a dia do mês, somado da agenda.
 *
 * Um `Map` por dia e uma varredura só: com 31 chamadas a `listByDate` o
 * resultado seria o mesmo, e o custo, 31 filtragens da janela inteira.
 */
function serieReal(date: Date): { series: RevenuePoint[]; monthTotal: number } {
  const { from, to } = mesDe(date);
  const daysInMonth = to.getDate();
  const porDia = new Map<number, number>();
  let monthTotal = 0;

  for (const { date: dia, appointment } of listRangeDated(from, to)) {
    if (!isBillable(appointment)) continue;
    const n = dia.getDate();
    porDia.set(n, (porDia.get(n) ?? 0) + appointment.priceCents);
    monthTotal += appointment.priceCents;
  }

  const series = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    label: `${i + 1}`.padStart(2, '0'),
    value: porDia.get(i + 1) ?? 0,
  }));

  return { series, monthTotal };
}

function buildRevenueSeries(date: Date): { series: RevenuePoint[]; monthTotal: number } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = monthOffset(date);
  const rnd = seeded(`rev-${year}-${month}`);

  const monthTotal =
    offset === 0 ? CANONICAL.monthRevenueCents : Math.round(between(rnd, 3_800_000, 5_900_000));

  // Pesos por dia: domingo fechado, sábado forte, sexta acima da média.
  const weights = Array.from({ length: daysInMonth }, (_, i) => {
    const weekday = new Date(year, month, i + 1).getDay();
    if (weekday === 0) return 0;
    const base = weekday === 6 ? 1.85 : weekday === 5 ? 1.4 : 1;
    return base * between(rnd, 0.75, 1.25);
  });

  const sum = weights.reduce((acc, w) => acc + w, 0) || 1;

  const series = weights.map((w, i) => ({
    day: i + 1,
    label: `${i + 1}`.padStart(2, '0'),
    value: Math.round((w / sum) * monthTotal),
  }));

  return { series, monthTotal };
}

// --- API pública ------------------------------------------------------------

/**
 * Carga relativa (0–1) de cada dia do mês, para o calendário.
 * Deriva da mesma série do gráfico — as duas visões nunca se contradizem.
 */
export function getMonthLoad(date: Date): number[] {
  const { series } = modoDemonstracao() ? buildRevenueSeries(date) : serieReal(date);
  const max = Math.max(...series.map((s) => s.value), 1);
  return series.map((s) => s.value / max);
}

export function getDashboardSnapshot(date: Date): DashboardSnapshot {
  const dayState = resolveDayState(date);
  const offset = monthOffset(date);
  const rnd = seeded(`snap-${dateKey(date)}`);
  const demo = modoDemonstracao();

  const appointments = listByDate(date);
  const professionals = buildProfessionals(dayState, appointments);

  const { series: revenueSeries, monthTotal } = demo
    ? buildRevenueSeries(date)
    : serieReal(date);
  const serviceStats = demo ? buildServiceStats(date, monthTotal) : servicosReais(date);

  // Falta e cancelamento não faturam: quem não sentou na cadeira não paga.
  const billable = appointments.filter((a) => a.status !== 'cancelado' && a.status !== 'falta');
  const dayRevenueCents = billable.reduce((acc, a) => acc + a.priceCents, 0);

  const clients = getState().clients;
  const servicesDone = serviceStats.reduce((acc, s) => acc + s.count, 0);

  if (demo) {
    const occupancyPct =
      dayState === 'today' && offset === 0
        ? CANONICAL.occupancy
        : Math.min(98, Math.round((billable.length / DAILY_CAPACITY) * 100 * 2.6));

    return {
      date,
      dayState,
      revenueCents: monthTotal,
      revenueDeltaPct:
        offset === 0 ? CANONICAL.monthRevenueDelta : Number(between(rnd, -9, 22).toFixed(1)),
      dayRevenueCents,
      totalCustomers:
        offset === 0
          ? CANONICAL.totalCustomers + (clients.length - 84)
          : Math.max(420, CANONICAL.totalCustomers + offset * 31),
      newCustomers: offset === 0 ? CANONICAL.newCustomers : Math.round(between(rnd, 14, 44)),
      occupancyPct,
      occupancyDeltaPct: Number(between(rnd, -6, 11).toFixed(1)),
      servicesDone,
      servicesDeltaPct: Number(between(rnd, -4, 18).toFixed(1)),
      appointments,
      professionals,
      inventory: getState().products.filter((p) => p.active).map(toProduct),
      serviceStats,
      revenueSeries,
    };
  }

  /* ---------------------------------------------------------------------
     Com banco, todo número desta tela sai da mesma agenda que as outras
     telas leem. Nenhuma constante, nenhum `random`.
     ------------------------------------------------------------------- */

  const mesAnterior = mesDe(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const totalAnterior = faturamentoDe(mesAnterior.from, mesAnterior.to);

  // Capacidade do dia é cadeira × horário, não uma constante: uma clínica
  // com dois dentistas não tem a mesma agenda de uma com seis.
  const cadeiras = professionals.filter((p) => p.status !== 'offline').length || professionals.length;
  const capacidadeDia = Math.max(cadeiras, 1) * DAILY_CAPACITY;
  const occupancyPct = Math.min(100, Math.round((billable.length / capacidadeDia) * 100));

  // "Novos" é quem entrou na base nos últimos 30 dias — a mesma janela que os
  // relatórios chamam de "últimos 30 dias" (regra 8 vale para rótulo também).
  const trintaDias = Date.now() - 30 * 86400000;
  const novos = clients.filter((c) => new Date(c.createdAt).getTime() >= trintaDias).length;

  return {
    date,
    dayState,
    revenueCents: monthTotal,
    revenueDeltaPct: variacao(monthTotal, totalAnterior),
    dayRevenueCents,
    totalCustomers: clients.length,
    newCustomers: novos,
    occupancyPct,
    // Sem histórico de ocupação por dia, não há o que comparar. A ausência é a
    // resposta honesta — e o card sabe não desenhar a seta.
    occupancyDeltaPct: undefined,
    servicesDone,
    servicesDeltaPct: undefined,
    appointments,
    professionals,
    inventory: getState().products.filter((p) => p.active).map(toProduct),
    serviceStats,
    revenueSeries,
  };
}
