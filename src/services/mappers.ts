import type {
  Appointment,
  AppointmentStatus,
  PaymentMethod,
  CashClosing,
  CashEntry,
  ClientRecord,
  ProductRecord,
  ProfessionalRecord,
  ScheduleBlock,
  ServiceItem,
  StockMovement,
  WaitlistEntry,
} from '@/data/types';

/**
 * TRADUÇÃO ENTRE O BANCO E O APP
 *
 * O Postgres usa `snake_case` porque é a convenção que evita aspas em toda
 * consulta escrita à mão; o TypeScript usa `camelCase` porque é a do
 * ecossistema. Converter numa camada só é mais barato que ceder num dos dois
 * lados — e muito mais barato que espalhar `price_cents` por 40 componentes.
 *
 * Cada par `fromRow`/`toRow` é o contrato de uma tabela. Quando o schema mudar,
 * o compilador aponta exatamente aqui.
 */

/* Dinheiro vem como `bigint`, que o supabase-js entrega como number ou string
   conforme a magnitude. Normalizar na entrada evita `"5500" + 100 = "5500100"`
   num total de caixa. */
const money = (value: unknown): number => Number(value ?? 0);

/* ==========================================================================
   SERVIÇOS
   ========================================================================= */

export interface ServiceRow {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category: ServiceItem['category'];
  price_cents: number | string;
  duration_min: number;
  buffer_min: number;
  is_active: boolean;
  service_prices?: Array<{ professional_id: string; price_cents: number | string }>;
  service_components?: Array<{ component_id: string }>;
}

export function serviceFromRow(row: ServiceRow): ServiceItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category,
    priceCents: money(row.price_cents),
    durationMin: row.duration_min,
    bufferMin: row.buffer_min,
    active: row.is_active,
    priceOverrides: Object.fromEntries(
      (row.service_prices ?? []).map((p) => [p.professional_id, money(p.price_cents)]),
    ),
    comboOf: (row.service_components ?? []).map((c) => c.component_id),
    // O peso só existe para repartir o faturamento na vitrine mockada; com
    // dados reais a repartição vem dos atendimentos.
    weight: 0,
  };
}

export function serviceToRow(item: ServiceItem, companyId: string) {
  return {
    company_id: companyId,
    name: item.name,
    description: item.description,
    category: item.category,
    price_cents: item.priceCents,
    duration_min: item.durationMin,
    buffer_min: item.bufferMin,
    is_active: item.active,
  };
}

/* ==========================================================================
   EQUIPE
   ========================================================================= */

export interface ProfessionalRow {
  id: string;
  company_id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  hired_at: string | null;
  is_active: boolean;
  rating: number | string;
  hue: number;
  photo_path: string | null;
  service_commission_pct: number | string;
  product_commission_pct: number | string;
  professional_schedules?: Array<{
    weekday: number;
    starts_at: string;
    ends_at: string;
    break_start: string | null;
    break_end: string | null;
  }>;
  professional_services?: Array<{ service_id: string }>;
}

/** `HH:MM:SS` do Postgres para o `HH:MM` que os campos de hora usam. */
const clock = (value: string) => value.slice(0, 5);

export function professionalFromRow(row: ProfessionalRow): ProfessionalRecord {
  const schedule: ProfessionalRecord['schedule'] = [null, null, null, null, null, null, null];

  for (const s of row.professional_schedules ?? []) {
    schedule[s.weekday] = {
      start: clock(s.starts_at),
      end: clock(s.ends_at),
      ...(s.break_start && s.break_end
        ? { breakStart: clock(s.break_start), breakEnd: clock(s.break_end) }
        : {}),
    };
  }

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email ?? '',
    phone: row.phone ?? '',
    hiredAt: row.hired_at ?? '',
    active: row.is_active,
    rating: Number(row.rating),
    hue: row.hue,
    photoPath: row.photo_path ?? null,
    serviceCommissionPct: Number(row.service_commission_pct),
    productCommissionPct: Number(row.product_commission_pct),
    schedule,
    serviceIds: (row.professional_services ?? []).map((s) => s.service_id),
  };
}

export function professionalToRow(record: ProfessionalRecord, companyId: string) {
  return {
    company_id: companyId,
    name: record.name,
    role: record.role,
    email: record.email || null,
    phone: record.phone || null,
    hired_at: record.hiredAt || null,
    is_active: record.active,
    rating: record.rating,
    hue: record.hue,
    photo_path: record.photoPath,
    service_commission_pct: record.serviceCommissionPct,
    product_commission_pct: record.productCommissionPct,
  };
}

/* ==========================================================================
   CLIENTES
   ========================================================================= */

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  preferred_professional_id: string | null;
  is_active: boolean;
}

export function clientFromRow(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    birthDate: row.birth_date,
    tags: row.tags ?? [],
    notes: row.notes ?? '',
    createdAt: row.created_at,
    preferredProfessionalId: row.preferred_professional_id,
    active: row.is_active,
  };
}

export function clientToRow(record: ClientRecord, companyId: string) {
  return {
    company_id: companyId,
    name: record.name,
    phone: record.phone || null,
    email: record.email || null,
    birth_date: record.birthDate,
    tags: record.tags,
    notes: record.notes,
    preferred_professional_id: record.preferredProfessionalId,
    is_active: record.active,
  };
}

/* ==========================================================================
   PRODUTOS
   ========================================================================= */

export interface ProductRow {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: ProductRecord['category'];
  qty: number;
  min_qty: number;
  capacity: number;
  unit: string;
  cost_cents: number | string;
  price_cents: number | string;
  is_active: boolean;
}

export function productFromRow(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? '',
    sku: row.sku ?? '',
    category: row.category,
    qty: row.qty,
    min: row.min_qty,
    capacity: row.capacity,
    unit: row.unit,
    costCents: money(row.cost_cents),
    priceCents: money(row.price_cents),
    active: row.is_active,
  };
}

export function productToRow(record: ProductRecord, companyId: string) {
  return {
    company_id: companyId,
    name: record.name,
    brand: record.brand,
    sku: record.sku,
    category: record.category,
    // `qty` e `cost_cents` ficam de fora: são mantidos pelo trigger de
    // movimentação. Escrevê-los aqui apagaria o rastro que justifica o saldo.
    min_qty: record.min,
    capacity: record.capacity,
    unit: record.unit,
    price_cents: record.priceCents,
    is_active: record.active,
  };
}

/* ==========================================================================
   MOVIMENTAÇÕES E CAIXA
   ========================================================================= */

export interface MovementRow {
  id: string;
  product_id: string;
  professional_id: string | null;
  kind: StockMovement['kind'];
  qty: number;
  unit_cost_cents: number | string;
  occurred_on: string;
  note: string | null;
}

export function movementFromRow(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    professionalId: row.professional_id,
    kind: row.kind,
    qty: row.qty,
    unitCostCents: money(row.unit_cost_cents),
    date: row.occurred_on,
    note: row.note ?? '',
  };
}

export function movementToRow(record: StockMovement, companyId: string) {
  return {
    company_id: companyId,
    product_id: record.productId,
    professional_id: record.professionalId,
    kind: record.kind,
    qty: record.qty,
    unit_cost_cents: record.unitCostCents,
    occurred_on: record.date,
    note: record.note,
  };
}

export interface CashEntryRow {
  id: string;
  professional_id: string | null;
  occurred_on: string;
  direction: CashEntry['direction'];
  category: CashEntry['category'];
  description: string;
  amount_cents: number | string;
  method: CashEntry['method'];
  shift: CashEntry['shift'];
  created_at: string;
}

export function cashEntryFromRow(row: CashEntryRow): CashEntry {
  return {
    id: row.id,
    date: row.occurred_on,
    direction: row.direction,
    category: row.category,
    description: row.description,
    amountCents: money(row.amount_cents),
    method: row.method,
    shift: row.shift,
    professionalId: row.professional_id,
    createdAt: row.created_at,
  };
}

export function cashEntryToRow(record: CashEntry, companyId: string) {
  return {
    company_id: companyId,
    professional_id: record.professionalId,
    occurred_on: record.date,
    direction: record.direction,
    category: record.category,
    description: record.description,
    amount_cents: record.amountCents,
    method: record.method,
    shift: record.shift,
  };
}

export interface CashClosingRow {
  id: string;
  occurred_on: string;
  shift: CashClosing['shift'];
  expected_cents: number | string;
  counted_cents: number | string;
  note: string | null;
  closed_at: string;
}

export function cashClosingFromRow(row: CashClosingRow): CashClosing {
  return {
    id: row.id,
    date: row.occurred_on,
    shift: row.shift,
    expectedCents: money(row.expected_cents),
    countedCents: money(row.counted_cents),
    note: row.note ?? '',
    closedAt: row.closed_at,
    closedBy: '',
  };
}

export function cashClosingToRow(record: CashClosing, companyId: string) {
  return {
    company_id: companyId,
    occurred_on: record.date,
    shift: record.shift,
    expected_cents: record.expectedCents,
    counted_cents: record.countedCents,
    note: record.note,
  };
}

/* ==========================================================================
   AGENDA
   ========================================================================= */

export interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number | string;
  payment_method: PaymentMethod | null;
  notes: string | null;
  professional_id: string;
  /**
   * `client_id` é obrigatório no schema; o `null` aqui cobre o caso em que a
   * RLS esconde a ficha de quem lê o atendimento. Melhor um rótulo genérico
   * que uma linha em branco na grade.
   */
  clients: { id: string; name: string } | null;
  appointment_services?: Array<{
    service_id: string;
    price_cents: number | string;
    duration_min: number;
    services: { name: string } | null;
  }>;
}

/**
 * O atendimento é a única linha que o app lê em duas formas: o instante do
 * banco e o par data/hora que a grade da agenda desenha.
 *
 * A duração sai do intervalo gravado, não da soma dos serviços. São a mesma
 * conta na hora de agendar, mas só o intervalo continua verdadeiro depois: é
 * ele que a constraint de exclusão usa para barrar dois clientes na mesma
 * cadeira, e é ele que sobrevive a uma mudança de duração no catálogo.
 *
 * Preço e nome do serviço também vêm congelados da linha filha — o catálogo de
 * hoje não pode reescrever o que foi cobrado em março (mesma razão pela qual o
 * gerador determinístico lia as sementes, e não o store).
 */
export function appointmentFromRow(row: AppointmentRow, timezone: string): Appointment {
  const start = isoToLocal(row.starts_at, timezone);
  const items = row.appointment_services ?? [];

  const durationMin = Math.round(
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000,
  );

  return {
    id: row.id,
    date: start.date,
    time: start.time,
    client: row.clients?.name ?? 'Cliente',
    clientId: row.clients?.id,
    services: items.map((i) => i.services?.name ?? 'Serviço'),
    serviceIds: items.map((i) => i.service_id),
    professionalId: row.professional_id,
    status: row.status,
    priceCents: money(row.price_cents),
    durationMin,
    paymentMethod: row.payment_method ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export interface BlockRow {
  id: string;
  professional_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface WaitlistRow {
  id: string;
  client_id: string;
  professional_id: string | null;
  service_ids: string[] | null;
  from_date: string;
  to_date: string;
  day_window: WaitlistEntry['window'] | null;
  note: string | null;
  created_at: string;
}

export function waitlistFromRow(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    professionalId: row.professional_id ?? 'any',
    serviceIds: row.service_ids ?? [],
    fromDate: row.from_date,
    toDate: row.to_date,
    window: row.day_window ?? 'qualquer',
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

export function waitlistToRow(record: WaitlistEntry, companyId: string) {
  return {
    company_id: companyId,
    client_id: record.clientId,
    professional_id: record.professionalId === 'any' ? null : record.professionalId,
    service_ids: record.serviceIds,
    from_date: record.fromDate,
    to_date: record.toDate,
    day_window: record.window === 'qualquer' ? null : record.window,
    note: record.note,
  };
}

/** Bloqueios guardam data e hora separadas no app, e um instante no banco. */
export function blockToRow(record: ScheduleBlock, companyId: string, timezone: string) {
  return {
    company_id: companyId,
    professional_id: record.professionalId === 'all' ? null : record.professionalId,
    starts_at: localToISO(record.date, record.start, timezone),
    ends_at: localToISO(record.date, record.end, timezone),
    reason: record.reason,
  };
}

export function blockFromRow(row: BlockRow, timezone: string): ScheduleBlock {
  const start = isoToLocal(row.starts_at, timezone);
  const end = isoToLocal(row.ends_at, timezone);
  return {
    id: row.id,
    date: start.date,
    professionalId: row.professional_id ?? 'all',
    start: start.time,
    end: end.time,
    reason: row.reason ?? '',
  };
}

/* ==========================================================================
   FUSO
   ========================================================================= */

/**
 * "2026-08-11" + "14:30" no fuso da clínica → instante absoluto.
 *
 * O fuso do navegador de quem olha não é o da clínica: um dono viajando vê a
 * agenda deslocada se a conversão usar a máquina local. `Intl` é a única fonte
 * confiável de offset, porque conhece horário de verão histórico.
 */
export function localToISO(date: string, time: string, timezone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);

  // Chute inicial em UTC, corrigido pelo offset que aquele instante realmente
  // tem naquele fuso. Uma iteração basta: o offset não muda dentro de um dia,
  // salvo na hora exata da virada do horário de verão.
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = offsetAt(new Date(guess), timezone);
  return new Date(guess - offset).toISOString();
}

export function isoToLocal(iso: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

  // O locale sueco formata como "2026-08-11 14:30" — ISO sem esforço.
  const [date, time] = parts.split(' ');
  return { date, time };
}

/** Offset do fuso, em milissegundos, para um instante específico. */
function offsetAt(instant: Date, timezone: string): number {
  const asUTC = new Date(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(instant)
      .replace(' ', 'T') + 'Z',
  );
  return asUTC.getTime() - instant.getTime();
}
