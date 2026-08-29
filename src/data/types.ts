export type AppointmentStatus =
  | 'concluido'
  | 'em_andamento'
  | 'agendado'
  | 'cancelado'
  | 'falta';

export interface Appointment {
  id: string;
  time: string; // HH:MM no fuso da clínica
  client: string;
  services: string[];
  professionalId: string;
  status: AppointmentStatus;
  priceCents: number;
  /**
   * YYYY-MM-DD no fuso da clínica.
   *
   * O gerador determinístico não precisava — a data era a chave da consulta.
   * Vindo do banco, uma janela de meses fica em memória de uma vez, e cada
   * atendimento precisa dizer a que dia pertence.
   */
  date?: string;
  /** Vínculo com a ficha do cliente. Agendamentos antigos podem não ter. */
  clientId?: string;
  /** Vínculo com o catálogo — `services` continua sendo o rótulo exibido. */
  serviceIds?: string[];
  /** Soma das durações mais o intervalo de preparo, em minutos. */
  durationMin?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export type ProfessionalStatus = 'atendendo' | 'disponivel' | 'descanso' | 'offline';

export interface Professional {
  id: string;
  name: string;
  role: string;
  status: ProfessionalStatus;
  shift: string;
  appointmentsToday: number;
  rating: number;
  /** Matiz do avatar holográfico — mantém cada profissional reconhecível. */
  hue: number;
}

export interface Product {
  id: string;
  name: string;
  qty: number;
  /** Abaixo disso o item entra em alerta crítico. */
  min: number;
  capacity: number;
  unit: string;
}

export interface ServiceStat {
  id: string;
  name: string;
  count: number;
  revenueCents: number;
}

export interface RevenuePoint {
  day: number;
  label: string;
  /** Em centavos. */
  value: number;
}

export type DayState = 'past' | 'today' | 'future';

export interface DashboardSnapshot {
  date: Date;
  dayState: DayState;
  /** Faturamento do mês da data selecionada, em centavos. */
  revenueCents: number;
  /**
   * Variação contra o mês anterior. **Opcional de propósito.**
   *
   * `undefined` quando não há base de comparação — clínica no primeiro mês.
   * Zero ali seria a afirmação "ficou igual" sobre um mês que não existiu.
   */
  revenueDeltaPct?: number;
  /** Faturamento apenas do dia selecionado. */
  dayRevenueCents: number;
  totalCustomers: number;
  newCustomers: number;
  occupancyPct: number;
  occupancyDeltaPct?: number;
  servicesDone: number;
  servicesDeltaPct?: number;
  appointments: Appointment[];
  professionals: Professional[];
  inventory: Product[];
  serviceStats: ServiceStat[];
  revenueSeries: RevenuePoint[];
}

/* ==========================================================================
   CATÁLOGO DE SERVIÇOS
   ========================================================================= */

export type ServiceCategory = 'avaliacao' | 'preventivo' | 'restaurador' | 'estetico' | 'cirurgico' | 'combo';

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Preço base. Sobreposto por `priceOverrides` quando o profissional tem tabela própria. */
  priceCents: number;
  /** Tempo de cadeira. */
  durationMin: number;
  /** Preparo e limpeza depois do atendimento — ocupa a agenda, não é cobrado. */
  bufferMin: number;
  /** Desativar preserva o histórico; excluir o apagaria dos relatórios. */
  active: boolean;
  /** professionalId → preço em centavos. */
  priceOverrides: Record<string, number>;
  /** Serviços que compõem o combo. Vazio em serviço simples. */
  comboOf: string[];
  /** Peso histórico na distribuição de receita do mês. */
  weight: number;
}

/* ==========================================================================
   EQUIPE
   ========================================================================= */

export interface DayShift {
  start: string; // HH:MM
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

/**
 * Ficha completa do profissional.
 *
 * Não estende `Professional` de propósito: aquele é a projeção que o dashboard
 * consome (com `status` e `appointmentsToday` calculados no dia), este é o
 * registro persistido. `toProfessional()` faz a ponte.
 */
export interface ProfessionalRecord {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  hiredAt: string; // ISO
  active: boolean;
  rating: number;
  /**
   * Matiz do avatar gerado, usado quando não há foto.
   *
   * Continua existindo depois da foto entrar: é o retrato de quem ainda não
   * enviou uma, e some sozinho quando `photoPath` é preenchido.
   */
  hue: number;
  /**
   * Caminho da foto no bucket — nunca a URL.
   *
   * O domínio do storage muda ao migrar de projeto; uma base cheia de URLs
   * absolutas viraria migração de string em vez de troca de configuração. Quem
   * transforma em endereço é `mediaService.publicUrl()`.
   */
  photoPath: string | null;
  /** Comissão em pontos percentuais sobre o serviço executado. */
  serviceCommissionPct: number;
  /** Comissão sobre produto vendido. */
  productCommissionPct: number;
  /** Jornada por dia da semana, índice 0 = domingo. `null` = folga. */
  schedule: Array<DayShift | null>;
  /** Serviços que executa. Vazio = executa todos. */
  serviceIds: string[];
}

/* ==========================================================================
   CLIENTES
   ========================================================================= */

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD. */
  birthDate: string | null;
  tags: string[];
  notes: string;
  createdAt: string; // ISO
  preferredProfessionalId: string | null;
  active: boolean;
}

/** Tudo aqui é derivado dos agendamentos — nunca digitado, nunca divergente. */
export interface ClientInsights {
  visits: number;
  noShows: number;
  cancellations: number;
  spentCents: number;
  avgTicketCents: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  topServiceName: string | null;
  topProfessionalId: string | null;
  /** Média de dias entre visitas — base para dizer se sumiu. */
  cadenceDays: number | null;
}

/* ==========================================================================
   ESTOQUE
   ========================================================================= */

export type ProductCategory = 'descartavel' | 'material' | 'medicamento' | 'instrumental' | 'protecao';

export interface ProductRecord {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: ProductCategory;
  qty: number;
  min: number;
  capacity: number;
  unit: string;
  /** Custo médio de aquisição. */
  costCents: number;
  /** Preço de venda ao cliente. */
  priceCents: number;
  active: boolean;
}

export type MovementKind = 'entrada' | 'venda' | 'consumo' | 'perda' | 'ajuste';

export interface StockMovement {
  id: string;
  productId: string;
  kind: MovementKind;
  /** Sempre positiva; o sinal vem de `kind`. */
  qty: number;
  unitCostCents: number;
  /** YYYY-MM-DD. */
  date: string;
  note: string;
  professionalId: string | null;
}

/* ==========================================================================
   CAIXA
   ========================================================================= */

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito';

export type CashDirection = 'entrada' | 'saida';

export type CashCategory =
  | 'servico'
  | 'produto'
  | 'comissao'
  | 'aluguel'
  | 'insumo'
  | 'salario'
  | 'marketing'
  | 'imposto'
  | 'manutencao'
  | 'outro';

export type Shift = 'manha' | 'tarde' | 'noite';

export interface CashEntry {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  direction: CashDirection;
  category: CashCategory;
  description: string;
  amountCents: number;
  method: PaymentMethod;
  shift: Shift;
  professionalId: string | null;
  createdAt: string;
}

/** Fechamento de turno: o que o sistema esperava contra o que foi contado. */
export interface CashClosing {
  id: string;
  date: string;
  shift: Shift;
  expectedCents: number;
  countedCents: number;
  note: string;
  closedAt: string;
  closedBy: string;
}

/* ==========================================================================
   AGENDA
   ========================================================================= */

export interface ScheduleBlock {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  /** `all` bloqueia a clínica inteira. */
  professionalId: string | 'all';
  start: string; // HH:MM
  end: string;
  reason: string;
}

/**
 * Fila de espera.
 *
 * Quem quer um horário que não existe hoje. Fica registrado com a janela que
 * aceita, e a agenda oferece a vaga quando alguém desmarca.
 */
export interface WaitlistEntry {
  id: string;
  clientId: string;
  serviceIds: string[];
  /** `any` aceita qualquer profissional. */
  professionalId: string | 'any';
  /** YYYY-MM-DD a partir de quando aceita. */
  fromDate: string;
  toDate: string;
  /** Faixa do dia que serve: 'manha' | 'tarde' | 'noite' | 'qualquer'. */
  window: Shift | 'qualquer';
  note: string;
  createdAt: string;
}

/* ==========================================================================
   CONFIGURAÇÕES DA CLÍNICA
   ========================================================================= */

export interface BusinessHours {
  /** Fechado ignora `open`/`close` — não os apaga, para não perder o horário anterior. */
  closed: boolean;
  open: string;
  close: string;
}

export interface ShopSettings {
  name: string;
  document: string;
  phone: string;
  email: string;
  /**
   * Caminho da logo no bucket, **não** a URL.
   *
   * O domínio do storage muda ao migrar de projeto; guardar a URL absoluta
   * transformaria essa troca de configuração numa migração de string.
   */
  logoPath: string | null;
  address: {
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
  };
  /** Índice 0 = domingo. */
  hours: BusinessHours[];
  /** YYYY-MM-DD dos dias fechados fora da rotina. */
  holidays: string[];
  booking: {
    slotMinutes: number;
    minAdvanceHours: number;
    maxAdvanceDays: number;
    cancelWindowHours: number;
    /** Permite dois atendimentos no mesmo horário do mesmo profissional. */
    allowOverbooking: boolean;
    noShowFeePct: number;
  };
  notifications: {
    emailConfirmation: boolean;
    emailReminder: boolean;
    whatsappConfirmation: boolean;
    whatsappReminder: boolean;
    reminderHoursBefore: number;
    marketingOptIn: boolean;
  };
}
