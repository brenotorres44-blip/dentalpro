import { useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { loadPlatformData, type PlatformInvoice } from './platformData';
import type { ThemeOverride } from '@/themes/tokens';
import {
  COMPANIES,
  LOGS,
  MRR_SERIES,
  PLANS,
  PLATFORM_METRICS,
  SUBSCRIPTIONS,
  TICKETS,
  USERS,
  setPlanRegistry,
  type Company,
  type CompanyStatus,
  type MrrPoint,
  type Plan,
  type PlanLimits,
  type PlatformMetrics,
  type SaasUser,
  type Subscription,
  type SystemLog,
  type Ticket,
  type TicketStatus,
} from '@/data/saas';

/**
 * ESTADO DO SAAS CONTROL CENTER
 *
 * Mesmo desenho do `store.ts` da clínica, um andar acima: espelho em memória,
 * notificação por `useSyncExternalStore`, escrita otimista com rollback.
 *
 * ## Por que um store e não um `useEffect` por tela
 *
 * As nove telas do centro de comando leem os mesmos seis conjuntos. Com carga
 * por tela, navegar de "empresas" para "planos" refaria sete consultas — e as
 * duas telas poderiam mostrar contagens diferentes da mesma base, que é
 * exatamente o que a regra 8 proíbe. Uma carga, uma fonte.
 *
 * ## Os dois modos
 *
 * **Sem `.env.local`**, o estado nasce com as sementes de `data/saas.ts` e
 * `loadPlatform()` não faz nada — é o que mantém o painel navegável sem
 * provisionar banco.
 *
 * **Com Supabase**, nasce vazio e `loadPlatform()` preenche. Diferente do store
 * da clínica, aqui **não há `localStorage`**: dado de plataforma no navegador
 * de quem administra seria uma segunda cópia da base inteira, e a que ficaria
 * velha.
 */

export interface PlatformState {
  loading: boolean;
  /** Já houve uma carga bem-sucedida? Distingue "vazio" de "ainda não veio". */
  loaded: boolean;
  lastError: string | null;
  plans: Plan[];
  companies: Company[];
  users: SaasUser[];
  subscriptions: Subscription[];
  logs: SystemLog[];
  tickets: Ticket[];
  metrics: PlatformMetrics;
  mrrSeries: MrrPoint[];
  invoices: PlatformInvoice[];
}

const EMPTY_METRICS: PlatformMetrics = {
  activeCompanies: 0,
  totalCompanies: 0,
  newCompanies: 0,
  users: 0,
  mrrCents: 0,
  billedMonthCents: 0,
  failedInvoices: 0,
  billingIntegrated: false,
  churnPct: 0,
  openTickets: 0,
  statusCounts: { active: 0, trial: 0, suspended: 0, canceled: 0 },
};

function initialState(): PlatformState {
  if (isSupabaseConfigured) {
    return {
      loading: false,
      loaded: false,
      lastError: null,
      plans: [],
      companies: [],
      users: [],
      subscriptions: [],
      logs: [],
      tickets: [],
      metrics: EMPTY_METRICS,
      mrrSeries: [],
      invoices: [],
    };
  }

  return {
    loading: false,
    loaded: true,
    lastError: null,
    plans: PLANS,
    companies: COMPANIES,
    users: USERS,
    subscriptions: SUBSCRIPTIONS,
    logs: LOGS,
    tickets: TICKETS,
    metrics: PLATFORM_METRICS,
    mrrSeries: MRR_SERIES,
    // Vazio de propósito: no modo demonstração ninguém foi cobrado, e a tela
    // de assinaturas diz isso em vez de exibir faturas de mentira.
    invoices: [],
  };
}

let state = initialState();
const listeners = new Set<() => void>();

function commit(patch: Partial<PlatformState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getState = () => state;

export function usePlatform(): PlatformState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function dismissPlatformError() {
  if (state.lastError) commit({ lastError: null });
}

/* ==========================================================================
   CARGA
   ========================================================================= */

/**
 * Carrega a plataforma inteira numa ida só.
 *
 * Idempotente de propósito: o `AdminLayout` chama a cada montagem, e navegar
 * entre as nove telas não pode disparar nove cargas. Recarregar de verdade é o
 * `refreshPlatform()`.
 */
export async function loadPlatform() {
  if (!isSupabaseConfigured) return;
  if (state.loaded || state.loading) return;
  await refreshPlatform();
}

export async function refreshPlatform() {
  if (!isSupabaseConfigured) return;

  commit({ loading: true, lastError: null });

  try {
    const data = await loadPlatformData();
    // Antes de notificar: `getPlan()` é consultado durante o render das telas,
    // e um plano criado pelo centro de comando não existe nas constantes.
    setPlanRegistry(data.plans);
    commit({ ...data, loading: false, loaded: true });
  } catch (error) {
    commit({
      loading: false,
      lastError:
        error instanceof Error
          ? traduzir(error.message)
          : 'Falha ao carregar os dados da plataforma.',
    });
  }
}

function traduzir(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('sem_permissao') || m.includes('violates row-level security')) {
    return 'Sua conta não é administradora da plataforma.';
  }
  if (m.includes('could not find the function') || m.includes('does not exist')) {
    return 'O banco está numa versão anterior: falta rodar a migration 0007_platform.sql.';
  }
  return message;
}

/* ==========================================================================
   ESCRITA
   ========================================================================= */

/**
 * Aplica na tela e manda para o banco; se o banco recusa, volta e avisa.
 *
 * Mesmo raciocínio do store da clínica: as três escritas daqui são ajustes
 * pontuais de administrador — mudar um preço, suspender uma empresa, triar um
 * chamado — e esperar meio segundo olhando para nada a cada clique custa mais
 * do que o raro rollback.
 */
function push(
  action: () => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  /** Estado de **antes** da alteração otimista — quem chama captura, não o push. */
  rollback: PlatformState,
) {
  if (!isSupabaseConfigured || !supabase) return;

  void Promise.resolve(action()).then(
    ({ data, error }) => {
      if (error) {
        commit({ ...rollback, lastError: traduzirEscrita(error.message) });
        return;
      }

      /*
       * Sucesso com zero linhas é o fracasso mais perigoso que existe aqui.
       *
       * A policy de escrita da plataforma filtra pelo `using`, e um `update`
       * que não casa com nenhuma linha **não é erro** para o Postgres nem para
       * o PostgREST: volta 204, sem mensagem. Sem esta checagem, quem não é
       * administrador de plataforma editava o preço de um plano, via o número
       * mudar na tela, e encontrava o valor antigo no próximo carregamento —
       * sem nunca ter recebido um "não".
       *
       * É o motivo de todo chamador usar `.select()`: sem ele não há como
       * distinguir "gravou" de "não achou o que gravar".
       */
      if (!data || data.length === 0) {
        commit({
          ...rollback,
          lastError:
            'A alteração não foi aplicada — sua conta não tem permissão de administrador da plataforma.',
        });
      }
    },
    (error: unknown) => {
      commit({
        ...rollback,
        lastError: error instanceof Error ? error.message : 'Falha ao gravar.',
      });
    },
  );
}

/**
 * O mesmo desenho, para quem escreve por RPC.
 *
 * `push()` trata lista vazia como recusa, e está certo para `update` — mas uma
 * função `returns void` devolve `data: null` **quando dá certo**. Passar uma
 * pela outra faria toda gravação de tema acusar falta de permissão e desfazer
 * uma alteração que o banco tinha acabado de aceitar.
 *
 * Aqui quem recusa levanta exceção, e a exceção chega como `error`. É por isso
 * que `set_company_theme` faz `raise` em vez de simplesmente não achar a linha.
 */
function pushRpc(
  action: () => PromiseLike<{ error: { message: string } | null }>,
  rollback: PlatformState,
) {
  if (!isSupabaseConfigured || !supabase) return;

  void Promise.resolve(action()).then(
    ({ error }) => {
      if (error) commit({ ...rollback, lastError: traduzirEscrita(error.message) });
    },
    (error: unknown) => {
      commit({
        ...rollback,
        lastError: error instanceof Error ? error.message : 'Falha ao gravar.',
      });
    },
  );
}

function traduzirEscrita(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('sem_permissao_tema')) {
    return 'Sua conta não tem permissão para alterar o tema desta clínica.';
  }
  if (m.includes('empresa_nao_encontrada')) {
    return 'Esta clínica não existe mais. Recarregue o painel.';
  }
  if (m.includes('violates row-level security')) {
    return 'Somente o administrador da plataforma pode fazer essa alteração.';
  }
  if (m.includes('violates foreign key')) {
    return 'Há empresas usando este registro — ele não pode ser removido.';
  }
  return message;
}

/** Colunas booleanas e numéricas do plano, na ordem em que o `0007` as criou. */
const PLAN_LIMIT_COLUMN: Record<keyof PlanLimits, string> = {
  users: 'max_users',
  professionals: 'max_professionals',
  appointmentsMonth: 'max_appointments_month',
  clients: 'max_clients',
  storageGb: 'storage_gb',
  financial: 'has_financial',
  inventory: 'has_inventory',
  reports: 'has_reports',
  automations: 'has_automations',
  themeBuilder: 'has_theme_builder',
  prioritySupport: 'has_priority_support',
};

export function updatePlan(id: string, patch: { priceCents?: number; limits?: Partial<PlanLimits> }) {
  const before = state;
  commit({
    plans: state.plans.map((p) =>
      p.id === id
        ? {
            ...p,
            priceCents: patch.priceCents ?? p.priceCents,
            limits: { ...p.limits, ...patch.limits },
          }
        : p,
    ),
  });
  setPlanRegistry(state.plans);

  const row: Record<string, unknown> = {};
  if (patch.priceCents !== undefined) row.price_cents = patch.priceCents;
  for (const [key, value] of Object.entries(patch.limits ?? {})) {
    row[PLAN_LIMIT_COLUMN[key as keyof PlanLimits]] = value;
  }
  if (!Object.keys(row).length) return;

  push(() => supabase!.from('plans').update(row).eq('id', id).select('id'), before);
}

/**
 * O que o centro de comando altera numa empresa.
 *
 * Nome, endereço e horários são da clínica — quem edita é ela, na tela de
 * configurações. O administrador mexe no que é contrato: status e plano. Deixar
 * ele reescrever o cadastro daqui criaria um segundo caminho de escrita para os
 * mesmos campos, e o `saveCompanySettings` deixaria de ser a fonte única.
 */
export function updateCompany(id: string, patch: { status?: CompanyStatus; planId?: string }) {
  const before = state;
  commit({ companies: state.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.planId) row.plan_id = patch.planId;
  if (!Object.keys(row).length) return;

  push(() => supabase!.from('companies').update(row).eq('id', id).select('id'), before);
}

/**
 * O tema de uma clínica, alterado do centro de comando.
 *
 * Existe porque o suporte precisava dele: quem liga dizendo "ficou ilegível" ou
 * "sumiram as bordas" não sabe descrever qual slider mexeu, e até aqui a única
 * saída era entrar no ambiente e procurar. A escrita passa pela mesma RPC que a
 * clínica usa — `has_capability` deixa o administrador de plataforma passar,
 * e o `audit_log` registra que foi ele, não o dono.
 */
export function updateCompanyTheme(id: string, theme: ThemeOverride) {
  const before = state;
  commit({ companies: state.companies.map((c) => (c.id === id ? { ...c, theme } : c)) });

  const { baseThemeId, ...override } = theme;

  pushRpc(
    () =>
      supabase!.rpc('set_company_theme', {
        p_company: id,
        p_theme_id: baseThemeId,
        p_override: override,
      }),
    before,
  );
}

export function updateTicket(id: string, patch: { status?: TicketStatus; priority?: Ticket['priority'] }) {
  const before = state;
  commit({ tickets: state.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  // A contagem do topo é derivada dos tickets: triar um chamado tem que mexer
  // nela na mesma hora, senão o card diz "3 abertos" com dois na coluna.
  commit({
    metrics: {
      ...state.metrics,
      openTickets: state.tickets.filter((t) => t.status === 'open').length,
    },
  });

  const row: Record<string, unknown> = { ...patch };
  if (patch.status === 'resolved') row.resolved_at = new Date().toISOString();

  push(() => supabase!.from('support_tickets').update(row).eq('id', id).select('id'), before);
}
