import { requireSupabase } from '@/lib/supabase/client';
import type {
  Company,
  CompanyStatus,
  LogKind,
  MrrPoint,
  Plan,
  PlatformMetrics,
  Role,
  SaasUser,
  Subscription,
  SubscriptionStatus,
  SystemLog,
  Ticket,
  TicketStatus,
} from '@/data/saas';

/**
 * CARGA DO SAAS CONTROL CENTER
 *
 * O equivalente de `companyData.ts` para o outro ambiente. Lá o recorte é uma
 * empresa; aqui é a plataforma inteira — e é por isso que quase tudo passa por
 * RPC em vez de `supabase.from()`.
 *
 * Três coisas o PostgREST não alcança, e cada uma justifica sua função:
 *
 * - **contagens por empresa** — usuários, profissionais, clientes e faturamento
 *   do mês. Pelo cliente, seria baixar as quatro tabelas de todas as clínicas
 *   para contar linhas no navegador;
 * - **`auth.users`** — não é exposto pela API. Sem `platform_users()`, a tela de
 *   usuários mostraria uuid no lugar de e-mail;
 * - **agregados da base** — MRR, churn, série de 12 meses.
 *
 * Planos, assinaturas e tickets são leitura direta: são tabelas pequenas, com
 * RLS que já resolve quem vê o quê.
 */

export interface PlatformData {
  plans: Plan[];
  companies: Company[];
  users: SaasUser[];
  subscriptions: Subscription[];
  logs: SystemLog[];
  tickets: Ticket[];
  metrics: PlatformMetrics;
  mrrSeries: MrrPoint[];
  /**
   * As faturas da plataforma inteira.
   *
   * Leitura direta como as assinaturas: a policy do `0013` já dá tudo para o
   * administrador e nada para os outros. Não vira RPC porque não há agregação
   * a fazer — a tela de assinaturas mostra as últimas linha a linha.
   */
  invoices: PlatformInvoice[];
}

export interface PlatformInvoice {
  id: string;
  companyId: string;
  planId: string | null;
  status: string;
  amountCents: number;
  issuedOn: string;
  paidAt: string | null;
  hostedUrl: string | null;
}

/** Quantas linhas de auditoria a tela de logs traz. Ela é um terminal, não um relatório. */
const LOG_LIMIT = 200;

/** Mesma régua das linhas de auditoria: extrato recente, não contabilidade. */
const INVOICE_LIMIT = 200;

export async function loadPlatformData(): Promise<PlatformData> {
  const sb = requireSupabase();

  const [plans, companies, users, subscriptions, logs, tickets, overview, invoices] =
    await Promise.all([
      sb.from('plans').select('*').order('sort_order'),
      sb.rpc('platform_companies'),
      sb.rpc('platform_users'),
      sb.from('subscriptions').select('*'),
      sb.rpc('platform_logs', { p_limit: LOG_LIMIT }),
      sb.from('support_tickets').select('*').order('last_reply_at', { ascending: false }),
      sb.rpc('platform_overview'),
      // A tela mostra as últimas; os totais do topo vêm agregados do
      // `platform_overview()`. Baixar a tabela inteira para somar no navegador
      // seria a mesma troca que as quatro RPCs existem para evitar.
      sb.from('invoices').select('*').order('issued_on', { ascending: false }).limit(INVOICE_LIMIT),
    ]);

  // Uma falha aqui não é "a tela ficou vazia": é o administrador olhando
  // números errados sem saber. O store transforma isso em aviso visível.
  const failure =
    plans.error ?? companies.error ?? users.error ?? subscriptions.error ??
    logs.error ?? tickets.error ?? overview.error ?? invoices.error;
  if (failure) throw new Error(failure.message);

  const planList = (plans.data ?? []).map(planFromRow);
  const priceOf = new Map(planList.map((p) => [p.id, p.priceCents]));

  return {
    plans: planList,
    companies: (companies.data ?? []).map(companyFromRow),
    users: (users.data ?? []).map(userFromRow),
    subscriptions: (subscriptions.data ?? []).map((row) =>
      subscriptionFromRow(row, priceOf.get(row.plan_id) ?? 0),
    ),
    logs: (logs.data ?? []).map(logFromRow),
    tickets: (tickets.data ?? []).map(ticketFromRow),
    invoices: (invoices.data ?? []).map(invoiceFromRow),
    ...overviewFromJson(overview.data),
  };
}

/* ==========================================================================
   O PERFIL DE UMA EMPRESA

   Carga sob demanda: entra quando o administrador abre a gaveta de uma empresa,
   e não no `loadPlatformData()`. Trazer equipe, faturas e auditoria de todas as
   clínicas no boot do painel seria pagar por dezenas de perfis para ler um.
   ========================================================================= */

export interface CompanyDetail {
  /** `null` quando a clínica nunca teve assinatura criada. */
  subscription: {
    planId: string;
    planName: string;
    priceCents: number;
    status: string;
    /** `none` sem identificador do gateway — declarar intenção não é integrar. */
    gateway: string;
    externalId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    startedAt: string;
  } | null;
  invoices: Array<{
    id: string;
    status: string;
    amountCents: number;
    issuedOn: string;
    paidAt: string | null;
    hostedUrl: string | null;
  }>;
  team: Array<{
    userId: string;
    name: string;
    email: string;
    role: Role;
    /** `null` para quem recebeu acesso e nunca entrou. */
    lastSignInAt: string | null;
    joinedAt: string;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: Role;
    expiresAt: string;
    createdAt: string;
  }>;
  usage: {
    users: number;
    professionals: number;
    clients: number;
    appointmentsMonth: number;
    /** `null` em qualquer eixo significa ilimitado, como em `plans`. */
    limits: {
      users: number | null;
      professionals: number | null;
      clients: number | null;
      appointmentsMonth: number | null;
    };
  };
  /**
   * Não reusa `SystemLog` de propósito.
   *
   * Aquele tipo carrega `actorRole`, e `audit_log` **não guarda o papel de quem
   * agiu** — `platform_logs()` o deriva do vínculo atual. Aqui isso seria pior
   * que inútil: exibiria o papel de hoje ao lado de uma ação de três meses
   * atrás, feita quando a pessoa era outra coisa. Sem o campo, ninguém erra.
   */
  audit: Array<{ id: string; at: string; actor: string; message: string; kind: LogKind }>;
}

export async function loadCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const sb = requireSupabase();

  const { data, error } = await sb.rpc('platform_company_detail', { p_company: companyId });
  if (error) throw new Error(error.message);

  const raw = (data ?? {}) as Record<string, never>;

  return {
    subscription: raw.subscription ? (raw.subscription as CompanyDetail['subscription']) : null,
    invoices: (raw.invoices ?? []) as CompanyDetail['invoices'],
    team: (raw.team ?? []) as CompanyDetail['team'],
    invites: (raw.invites ?? []) as CompanyDetail['invites'],
    usage: raw.usage as CompanyDetail['usage'],
    // O mesmo vocabulário de `/admin/logs`, pelos mesmos dois mapas. A RPC
    // devolve o fato cru de propósito: o texto da interface muda, o que o banco
    // registrou não. Dentro do perfil da empresa o nome dela é o título da
    // gaveta, então a frase não o repete.
    audit: ((raw.audit ?? []) as Array<Record<string, unknown>>).map((row) => {
      const table = String(row.tableName);
      const operation = String(row.operation);
      return {
        id: String(row.id),
        at: String(row.at),
        actor: String(row.actorName),
        kind: kindOf(table, operation),
        message: `${OPERATION_VERB[operation] ?? 'alterou'} ${TABLE_LABEL[table] ?? `um registro em ${table}`}`,
      };
    }),
  };
}

function invoiceFromRow(row: Row): PlatformInvoice {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    planId: row.plan_id ? String(row.plan_id) : null,
    status: String(row.status),
    // O valor congelado no dia da cobrança, que é o que a fatura existe para
    // guardar. Nunca `plans.price_cents`: reajustar reescreveria o passado.
    amountCents: Number(row.amount_cents),
    issuedOn: String(row.issued_on),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    hostedUrl: row.hosted_url ? String(row.hosted_url) : null,
  };
}

/* ==========================================================================
   CONVERSORES
   ========================================================================= */

type Row = Record<string, never>;

/**
 * Exportado porque a landing precisa dele sem passar por aqui.
 *
 * A vitrine pública lê `plans` direto (a policy permite `anon`), e um segundo
 * conversor para a mesma tabela divergiria no dia em que uma coluna entrasse —
 * com o preço da landing certo e o do centro de comando errado, ou o contrário.
 */
export function planFromRow(row: Row): Plan {
  return {
    id: String(row.id),
    // O banco guarda "Essencial"; o centro de comando escreve em caixa alta por
    // convenção tipográfica do tema, não por dado.
    name: String(row.name).toUpperCase(),
    priceCents: Number(row.price_cents),
    tagline: String(row.tagline ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    isPublic: Boolean(row.is_public),
    chargeable: Boolean(row.external_price_id),
    limits: {
      users: nullableInt(row.max_users),
      professionals: nullableInt(row.max_professionals),
      appointmentsMonth: nullableInt(row.max_appointments_month),
      clients: nullableInt(row.max_clients),
      storageGb: nullableInt(row.storage_gb),
      financial: Boolean(row.has_financial),
      inventory: Boolean(row.has_inventory),
      reports: Boolean(row.has_reports),
      automations: Boolean(row.has_automations),
      themeBuilder: Boolean(row.has_theme_builder),
      prioritySupport: Boolean(row.has_priority_support),
    },
  };
}

/** `null` no banco é ilimitado; `undefined` seria coluna ausente. Os dois viram `null`. */
const nullableInt = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

function companyFromRow(row: Row): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    document: String(row.document ?? ''),
    email: String(row.email ?? ''),
    ownerName: String(row.owner_name ?? '—'),
    ownerEmail: String(row.owner_email ?? ''),
    phone: String(row.phone ?? ''),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    status: String(row.status) as CompanyStatus,
    planId: String(row.plan_id),
    users: Number(row.users ?? 0),
    professionals: Number(row.professionals ?? 0),
    clients: Number(row.clients ?? 0),
    monthlyRevenueCents: Number(row.monthly_revenue_cents ?? 0),
    createdAt: String(row.created_at),
    lastActivityAt: String(row.last_access_at ?? row.created_at),
    // A adoção por tema em `/admin/themes` agrupa por `baseThemeId`, mas o
    // editor precisa do override inteiro para não apagar as cores da empresa ao
    // salvar uma troca de tema base.
    theme: {
      ...((row.theme_override as object | null) ?? {}),
      baseThemeId: String(row.theme_id ?? 'clinic-clean'),
    },
  };
}

function userFromRow(row: Row): SaasUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email ?? ''),
    companyId: row.company_id ? String(row.company_id) : null,
    companyName: row.company_name ? String(row.company_name) : null,
    role: String(row.role) as Role,
    // Quem nunca entrou não tem `last_sign_in_at`. Mostrar a data do convite é
    // mais útil que um traço: diz há quanto tempo o acesso está parado.
    lastAccessAt: String(row.last_sign_in_at ?? row.created_at),
    active: Boolean(row.active),
  };
}

/**
 * Os status do gateway não são os da tela.
 *
 * `trialing` e `past_due` são vocabulário de Stripe; a interface fala em trial
 * e atrasada. A tradução fica aqui para que trocar de gateway um dia não
 * espalhe `if (status === 'past_due')` por sete componentes.
 */
const SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'trial',
  trial: 'trial',
  past_due: 'overdue',
  unpaid: 'overdue',
  canceled: 'canceled',
  incomplete_expired: 'canceled',
};

function subscriptionFromRow(row: Row, priceCents: number): Subscription {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    planId: String(row.plan_id),
    status: SUBSCRIPTION_STATUS[String(row.status)] ?? 'trial',
    // O valor é o preço do plano, não uma coluna própria: duas fontes para o
    // mesmo número divergiriam no primeiro reajuste.
    amountCents: priceCents,
    startedAt: String(row.created_at),
    // Sem `current_period_end` não há cobrança programada. A queda para
    // `created_at` que existia aqui exibia a data de contratação sob o rótulo
    // "próxima cobrança" — um número certo respondendo à pergunta errada.
    nextChargeAt: row.current_period_end ? String(row.current_period_end) : null,
    // A coluna nasce com `'stripe'` por padrão, mas gateway declarado sem
    // identificador externo é intenção, não integração — e a tela que diz
    // "stripe" sobre uma assinatura que ninguém cobra mente para o
    // administrador. Enquanto não houver id do gateway, é "não integrado".
    gateway: row.external_subscription_id
      ? (String(row.gateway) as Subscription['gateway'])
      : 'none',
    externalId: row.external_subscription_id ? String(row.external_subscription_id) : null,
  };
}

/**
 * De linha de auditoria para frase.
 *
 * `audit_log` grava `UPDATE` em `services`; a tela precisa de "alterou um
 * serviço em CLÍNICA ELITE". A tradução é aqui porque o banco registra o
 * fato, e o fato não muda quando o texto da interface mudar.
 */
const TABLE_LABEL: Record<string, string> = {
  appointments: 'um atendimento',
  memberships: 'o acesso de um usuário',
  cash_entries: 'um lançamento no caixa',
  services: 'um serviço do catálogo',
  support_tickets: 'um chamado de suporte',
};

const OPERATION_VERB: Record<string, string> = {
  INSERT: 'criou',
  UPDATE: 'alterou',
  DELETE: 'removeu',
};

/**
 * `memberships` é a única tabela auditada cuja alteração é sempre mudança de
 * permissão — merece o próprio rótulo no filtro.
 *
 * Extraído porque o perfil da empresa classifica os mesmos eventos: duas
 * cópias divergiriam no dia em que uma tabela nova entrasse na auditoria.
 */
function kindOf(table: string, operation: string): LogKind {
  if (table === 'memberships') return 'permission_change';
  if (operation === 'INSERT') return 'create';
  if (operation === 'DELETE') return 'delete';
  return 'update';
}

function logFromRow(row: Row): SystemLog {
  const table = String(row.table_name);
  const operation = String(row.operation);
  const company = row.company_name ? String(row.company_name) : null;

  const kind = kindOf(table, operation);

  const what = TABLE_LABEL[table] ?? `um registro em ${table}`;
  const verb = OPERATION_VERB[operation] ?? 'alterou';

  return {
    id: String(row.id),
    at: String(row.occurred_at),
    kind,
    actor: String(row.actor_name),
    actorRole: String(row.actor_role) as Role,
    companyId: row.company_id ? String(row.company_id) : null,
    companyName: company,
    message: company ? `${verb} ${what} em ${company}` : `${verb} ${what}`,
  };
}

function ticketFromRow(row: Row): Ticket {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    subject: String(row.subject),
    status: String(row.status) as TicketStatus,
    priority: String(row.priority) as Ticket['priority'],
    openedAt: String(row.opened_at),
    lastReplyAt: String(row.last_reply_at),
    messages: Number(row.message_count ?? 0),
  };
}

/**
 * O jsonb do `platform_overview()` chega com as chaves já em camelCase — foi
 * montado assim de propósito, para não existir um terceiro dialeto entre o
 * `jsonb_build_object` e a tela.
 */
function overviewFromJson(data: unknown): { metrics: PlatformMetrics; mrrSeries: MrrPoint[] } {
  const o = (data ?? {}) as Partial<PlatformMetrics> & { mrrSeries?: MrrPoint[] };

  return {
    metrics: {
      activeCompanies: Number(o.activeCompanies ?? 0),
      totalCompanies: Number(o.totalCompanies ?? 0),
      newCompanies: Number(o.newCompanies ?? 0),
      users: Number(o.users ?? 0),
      mrrCents: Number(o.mrrCents ?? 0),
      billedMonthCents: Number(o.billedMonthCents ?? 0),
      failedInvoices: Number(o.failedInvoices ?? 0),
      billingIntegrated: o.billingIntegrated === true,
      churnPct: Number(o.churnPct ?? 0),
      openTickets: Number(o.openTickets ?? 0),
      // `jsonb_object_agg` omite o status que não tem nenhuma empresa; a tela
      // mostra os quatro sempre, então o que falta entra como zero.
      statusCounts: {
        active: 0,
        trial: 0,
        suspended: 0,
        canceled: 0,
        ...(o.statusCounts ?? {}),
      },
    },
    mrrSeries: (o.mrrSeries ?? []).map((p) => ({
      month: String(p.month),
      valueCents: Number(p.valueCents),
      companies: Number(p.companies),
    })),
  };
}
