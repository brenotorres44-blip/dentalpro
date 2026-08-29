import type { Appointment, ClientInsights, ProfessionalRecord } from '@/data/types';
import { dateKey } from '@/utils/format';
import { toMinutes } from '@/utils/time';
import { listRangeDated } from './agendaService';
import { getState } from './store';

/**
 * DERIVAÇÕES
 *
 * Nada aqui é digitado nem guardado: tudo sai da agenda. É o que garante a
 * regra de que dois números na mesma tela não se contradizem — o total de
 * visitas na ficha do cliente, o ranking do profissional e a receita do
 * relatório são três leituras da mesma lista de atendimentos.
 *
 * Quando o Supabase entrar, cada função destas vira uma view ou uma agregação
 * no banco. A assinatura é o contrato.
 */

/** Janela padrão do histórico de clientes. */
export const HISTORY_DAYS = 180;

/** Janela padrão de desempenho — um mês fechado é o que a equipe compara. */
export const PERFORMANCE_DAYS = 30;

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Janela dos últimos N dias **corridos, incluindo hoje**.
 *
 * Existe para que "últimos 30 dias" signifique a mesma coisa em toda a
 * aplicação. Antes, o módulo de profissionais contava a partir de `hoje − 30` e
 * o de relatórios a partir de `hoje − 29`: as duas telas exibiam o mesmo rótulo
 * com faturamentos diferentes, que é exatamente o tipo de contradição que faz
 * o usuário parar de confiar nos números.
 */
export function lastNDays(days: number): { from: Date; to: Date } {
  return { from: daysAgo(days - 1), to: new Date() };
}

/** Atendimento que gerou receita: quem não sentou na cadeira não conta. */
export const isBillable = (a: Appointment) =>
  a.status === 'concluido' || a.status === 'em_andamento';

/* ==========================================================================
   DESEMPENHO POR PROFISSIONAL
   ========================================================================= */

export interface ProfessionalPerformance {
  appointments: number;
  revenueCents: number;
  avgTicketCents: number;
  /** Minutos de cadeira efetivamente ocupados. */
  bookedMinutes: number;
  /** Minutos de jornada disponíveis no período. */
  availableMinutes: number;
  occupancyPct: number;
  noShows: number;
  cancellations: number;
  serviceCommissionCents: number;
  productCommissionCents: number;
}

const EMPTY_PERFORMANCE: ProfessionalPerformance = {
  appointments: 0,
  revenueCents: 0,
  avgTicketCents: 0,
  bookedMinutes: 0,
  availableMinutes: 0,
  occupancyPct: 0,
  noShows: 0,
  cancellations: 0,
  serviceCommissionCents: 0,
  productCommissionCents: 0,
};

/** Minutos de jornada de um profissional entre duas datas, descontado o intervalo. */
function availableMinutes(record: ProfessionalRecord, from: Date, to: Date) {
  const { settings } = getState();
  let total = 0;

  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor.getTime() <= last.getTime()) {
    const shift = record.schedule[cursor.getDay()];
    const closed = settings.hours[cursor.getDay()]?.closed;
    const holiday = settings.holidays.includes(dateKey(cursor));

    if (shift && !closed && !holiday) {
      let minutes = toMinutes(shift.end) - toMinutes(shift.start);
      if (shift.breakStart && shift.breakEnd) {
        minutes -= toMinutes(shift.breakEnd) - toMinutes(shift.breakStart);
      }
      total += Math.max(0, minutes);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function performanceByProfessional(
  from: Date,
  to: Date,
): Map<string, ProfessionalPerformance> {
  const { professionals, movements } = getState();
  const result = new Map<string, ProfessionalPerformance>();

  for (const record of professionals) {
    result.set(record.id, {
      ...EMPTY_PERFORMANCE,
      availableMinutes: availableMinutes(record, from, to),
    });
  }

  for (const { appointment } of listRangeDated(from, to)) {
    const entry = result.get(appointment.professionalId);
    if (!entry) continue;

    if (appointment.status === 'falta') entry.noShows += 1;
    else if (appointment.status === 'cancelado') entry.cancellations += 1;

    if (!isBillable(appointment)) continue;

    entry.appointments += 1;
    entry.revenueCents += appointment.priceCents;
    entry.bookedMinutes += appointment.durationMin ?? 30;
  }

  // Comissão sobre produto sai das vendas registradas no estoque, não da agenda.
  const fromKey = dateKey(from);
  const toKey = dateKey(to);
  for (const movement of movements) {
    if (movement.kind !== 'venda' || !movement.professionalId) continue;
    if (movement.date < fromKey || movement.date > toKey) continue;

    const entry = result.get(movement.professionalId);
    const record = professionals.find((p) => p.id === movement.professionalId);
    if (!entry || !record) continue;

    const product = getState().products.find((p) => p.id === movement.productId);
    const gross = (product?.priceCents ?? 0) * movement.qty;
    entry.productCommissionCents += Math.round((gross * record.productCommissionPct) / 100);
  }

  for (const [id, entry] of result) {
    const record = professionals.find((p) => p.id === id);
    entry.avgTicketCents = entry.appointments
      ? Math.round(entry.revenueCents / entry.appointments)
      : 0;
    entry.occupancyPct = entry.availableMinutes
      ? Math.min(100, Math.round((entry.bookedMinutes / entry.availableMinutes) * 100))
      : 0;
    entry.serviceCommissionCents = record
      ? Math.round((entry.revenueCents * record.serviceCommissionPct) / 100)
      : 0;
  }

  return result;
}

/* ==========================================================================
   HISTÓRICO POR CLIENTE
   ========================================================================= */

export interface ClientHistoryEntry {
  date: Date;
  appointment: Appointment;
}

const EMPTY_INSIGHTS: ClientInsights = {
  visits: 0,
  noShows: 0,
  cancellations: 0,
  spentCents: 0,
  avgTicketCents: 0,
  lastVisitAt: null,
  daysSinceLastVisit: null,
  topServiceName: null,
  topProfessionalId: null,
  cadenceDays: null,
};

/**
 * Uma varredura, todos os clientes.
 *
 * Chamar por cliente custaria uma releitura da janela inteira para cada linha
 * da tabela — com 84 fichas e 180 dias seriam 15 mil regerações da agenda a
 * cada tecla digitada na busca.
 */
export function insightsByClient(from: Date, to: Date): Map<string, ClientInsights> {
  const result = new Map<string, ClientInsights>();
  const visitDates = new Map<string, number[]>();
  const serviceTally = new Map<string, Map<string, number>>();
  const staffTally = new Map<string, Map<string, number>>();

  const bump = (tally: Map<string, Map<string, number>>, clientId: string, key: string) => {
    const inner = tally.get(clientId) ?? new Map<string, number>();
    inner.set(key, (inner.get(key) ?? 0) + 1);
    tally.set(clientId, inner);
  };

  for (const { date, appointment } of listRangeDated(from, to)) {
    const clientId = appointment.clientId;
    if (!clientId) continue;

    const entry = result.get(clientId) ?? { ...EMPTY_INSIGHTS };

    if (appointment.status === 'falta') entry.noShows += 1;
    if (appointment.status === 'cancelado') entry.cancellations += 1;

    if (isBillable(appointment)) {
      entry.visits += 1;
      entry.spentCents += appointment.priceCents;

      const stamp = date.getTime();
      visitDates.set(clientId, [...(visitDates.get(clientId) ?? []), stamp]);

      for (const name of appointment.services) bump(serviceTally, clientId, name);
      bump(staffTally, clientId, appointment.professionalId);
    }

    result.set(clientId, entry);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [clientId, entry] of result) {
    entry.avgTicketCents = entry.visits ? Math.round(entry.spentCents / entry.visits) : 0;

    const stamps = (visitDates.get(clientId) ?? []).sort((a, b) => a - b);
    if (stamps.length > 0) {
      const last = stamps[stamps.length - 1];
      entry.lastVisitAt = new Date(last).toISOString();
      entry.daysSinceLastVisit = Math.max(
        0,
        Math.round((today.getTime() - last) / 86_400_000),
      );
    }

    // Cadência: média dos intervalos entre visitas. Com uma visita só não há
    // intervalo nenhum, e inventar um número aqui viraria alerta falso.
    if (stamps.length > 1) {
      const gaps = stamps.slice(1).map((stamp, i) => (stamp - stamps[i]) / 86_400_000);
      entry.cadenceDays = Math.round(gaps.reduce((acc, g) => acc + g, 0) / gaps.length);
    }

    const services = serviceTally.get(clientId);
    if (services) {
      entry.topServiceName = [...services.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const staff = staffTally.get(clientId);
    if (staff) {
      entry.topProfessionalId = [...staff.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return result;
}

/** Ficha completa de um cliente, com a lista de atendimentos em ordem decrescente. */
export function clientHistory(clientId: string, from: Date, to: Date): ClientHistoryEntry[] {
  return listRangeDated(from, to)
    .filter(({ appointment }) => appointment.clientId === clientId)
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.appointment.time.localeCompare(a.appointment.time));
}

/** Sem visita há mais de 45 dias, tendo já sido cliente de verdade. */
export const LAPSED_DAYS = 45;

export function isLapsed(insights: ClientInsights | undefined) {
  if (!insights || insights.visits === 0) return false;
  return (insights.daysSinceLastVisit ?? 0) > LAPSED_DAYS;
}

/* ==========================================================================
   AGREGADOS DE PERÍODO
   ========================================================================= */

export interface PeriodTotals {
  appointments: number;
  revenueCents: number;
  avgTicketCents: number;
  noShows: number;
  cancellations: number;
  uniqueClients: number;
}

export function periodTotals(from: Date, to: Date): PeriodTotals {
  const clients = new Set<string>();
  let appointments = 0;
  let revenueCents = 0;
  let noShows = 0;
  let cancellations = 0;

  for (const { appointment } of listRangeDated(from, to)) {
    if (appointment.status === 'falta') noShows += 1;
    if (appointment.status === 'cancelado') cancellations += 1;
    if (!isBillable(appointment)) continue;

    appointments += 1;
    revenueCents += appointment.priceCents;
    if (appointment.clientId) clients.add(appointment.clientId);
  }

  return {
    appointments,
    revenueCents,
    avgTicketCents: appointments ? Math.round(revenueCents / appointments) : 0,
    noShows,
    cancellations,
    uniqueClients: clients.size,
  };
}
