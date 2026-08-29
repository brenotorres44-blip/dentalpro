import { useSyncExternalStore } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { loadCompanyData } from './companyData';
import { isRemoteKey, REMOTE, type RemoteKey } from './remote';
import {
  CLIENT_SEED,
  DEFAULT_SETTINGS,
  PRODUCT_SEED,
  PROFESSIONAL_SEED,
  SERVICE_SEED,
} from '@/data/mock';
import type {
  Appointment,
  CashClosing,
  CashEntry,
  ClientRecord,
  ProductRecord,
  ProfessionalRecord,
  ScheduleBlock,
  ServiceItem,
  ShopSettings,
  StockMovement,
  WaitlistEntry,
} from '@/data/types';

/**
 * ESTADO OPERACIONAL DA CLÍNICA
 *
 * Espelho em memória do que a empresa tem no banco: catálogo, equipe, clientes,
 * estoque, caixa e configurações. Toda escrita dos oito módulos passa por aqui,
 * e a notificação para o React sai do `useSyncExternalStore`.
 *
 * ## Dois modos, uma interface
 *
 * **Com Supabase**, `hydrateCompany()` carrega os dados da empresa ativa e cada
 * escrita vai para a tabela correspondente. Uma clínica nova nasce vazia,
 * como tem que ser.
 *
 * **Sem `.env.local`**, o conteúdo vem das sementes e mora no `localStorage`.
 * É o que mantém o repositório clonável sem provisionar nada.
 *
 * As oito telas não sabem em qual modo estão — foi por isso que a migração para
 * o banco não precisou tocar em nenhuma delas.
 *
 * ## Por que a agenda não está aqui
 *
 * Listas fechadas cabem inteiras em memória. A agenda não: o calendário navega
 * por qualquer mês, e carregar um ano de atendimentos para exibir uma terça não
 * se justifica. Ela é consultada por data em `agendaService`. O `overlay`
 * abaixo é a diferença que o modo mock aplica sobre o gerador determinístico —
 * com banco, fica vazio.
 */

/** Diferença aplicada sobre a agenda gerada de um dia. */
export interface DayOverlay {
  created: Appointment[];
  patched: Record<string, Partial<Appointment>>;
  removed: string[];
}

export interface OperationsState {
  /**
   * Empresa dona destes dados. `null` no modo mock.
   *
   * Guardado no estado para que toda escrita saiba onde gravar sem depender da
   * sessão — o store não conhece autenticação, e não deveria.
   */
  companyId: string | null;
  /** Fuso da clínica, necessário para converter horários de bloqueio. */
  timezone: string;
  /** Carga inicial em andamento. */
  loading: boolean;
  /** Última falha de escrita, para a interface poder avisar. */
  lastError: string | null;
  services: ServiceItem[];
  professionals: ProfessionalRecord[];
  clients: ClientRecord[];
  products: ProductRecord[];
  movements: StockMovement[];
  entries: CashEntry[];
  closings: CashClosing[];
  blocks: ScheduleBlock[];
  waitlist: WaitlistEntry[];
  /**
   * Janela de atendimentos vinda do banco — 180 dias para trás, 90 para frente.
   *
   * Vazia no modo mock, onde a agenda é gerada por data. É o que permite
   * `listByDate` continuar síncrona: as oito telas leem de memória, e só a
   * escrita vai ao servidor.
   */
  appointments: Appointment[];
  /** dateKey (YYYY-MM-DD) → diferença daquele dia. */
  agenda: Record<string, DayOverlay>;
  settings: ShopSettings;
}

const STORAGE_KEY = 'prodent.operations.v1';

/**
 * Chave única, sem recorte por empresa — de propósito.
 *
 * Fingir isolamento no `localStorage` daria a impressão de uma barreira que não
 * existe. O isolamento real é responsabilidade do RLS no banco; até lá, o
 * ambiente é de demonstração e a documentação diz isso com todas as letras.
 */
function initialState(): OperationsState {
  return {
    companyId: null,
    timezone: 'America/Sao_Paulo',
    loading: false,
    lastError: null,
    services: SERVICE_SEED,
    professionals: PROFESSIONAL_SEED,
    clients: CLIENT_SEED,
    products: PRODUCT_SEED,
    movements: [],
    entries: [],
    closings: [],
    blocks: [],
    waitlist: [],
    appointments: [],
    agenda: {},
    settings: DEFAULT_SETTINGS,
  };
}

/**
 * Recupera o estado gravado.
 *
 * Cada chave é validada isoladamente: se uma versão anterior gravou um formato
 * que não existe mais, só aquele pedaço volta para a semente em vez de o
 * usuário perder tudo — ou, pior, a aplicação quebrar no boot.
 */
function hydrate(): OperationsState {
  const base = initialState();
  if (typeof window === 'undefined') return base;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;

    const saved = JSON.parse(raw) as Partial<OperationsState>;

    return {
      ...base,
      services: Array.isArray(saved.services) ? saved.services : base.services,
      professionals: Array.isArray(saved.professionals) ? saved.professionals : base.professionals,
      clients: Array.isArray(saved.clients) ? saved.clients : base.clients,
      products: Array.isArray(saved.products) ? saved.products : base.products,
      movements: Array.isArray(saved.movements) ? saved.movements : base.movements,
      entries: Array.isArray(saved.entries) ? saved.entries : base.entries,
      closings: Array.isArray(saved.closings) ? saved.closings : base.closings,
      blocks: Array.isArray(saved.blocks) ? saved.blocks : base.blocks,
      waitlist: Array.isArray(saved.waitlist) ? saved.waitlist : base.waitlist,
      agenda: saved.agenda && typeof saved.agenda === 'object' ? saved.agenda : base.agenda,
      settings: saved.settings
        ? {
            ...base.settings,
            ...saved.settings,
            address: { ...base.settings.address, ...saved.settings.address },
            booking: { ...base.settings.booking, ...saved.settings.booking },
            notifications: { ...base.settings.notifications, ...saved.settings.notifications },
            hours: Array.isArray(saved.settings.hours) ? saved.settings.hours : base.settings.hours,
            holidays: Array.isArray(saved.settings.holidays)
              ? saved.settings.holidays
              : base.settings.holidays,
          }
        : base.settings,
    };
  } catch {
    return base;
  }
}

let state = hydrate();
const listeners = new Set<() => void>();

function persist() {
  // Com banco, o `localStorage` seria uma segunda cópia dos mesmos dados — e a
  // que ficaria velha. A fonte é o servidor; a memória é só o espelho da sessão.
  if (isSupabaseConfigured) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Cota estourada ou modo privativo: a sessão continua em memória. Perder a
    // gravação é aceitável; derrubar a tela do usuário não é.
  }
}

/** Aplica uma transformação e notifica. A identidade do estado só muda aqui. */
export function mutate(recipe: (current: OperationsState) => Partial<OperationsState>) {
  state = { ...state, ...recipe(state) };
  persist();
  for (const listener of listeners) listener();
}

export function getState() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Estado completo, com identidade estável entre mutações.
 *
 * Não há seletor: devolver um recorte novo a cada chamada faria o
 * `useSyncExternalStore` acusar loop infinito. Os componentes fatiam com
 * `useMemo` sobre o que recebem.
 */
export function useOperations(): OperationsState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Volta tudo ao estado de fábrica — usado pelo botão de restaurar. */
export function resetOperations() {
  state = initialState();
  persist();
  for (const listener of listeners) listener();
}

/* ==========================================================================
   IDENTIFICADORES
   ========================================================================= */

let counter = 0;

/**
 * Id local de registro novo.
 *
 * O prefixo `n` marca o que nasceu nesta instalação, distinguindo das sementes
 * (`s1`, `p1`, `c001`). O carimbo de tempo mais o contador evitam colisão
 * mesmo em criações no mesmo milissegundo.
 */
export function nextId(prefix: string) {
  counter += 1;
  return `${prefix}n${Date.now().toString(36)}${counter.toString(36)}`;
}

/* ==========================================================================
   CARGA A PARTIR DO BANCO
   ========================================================================= */

/**
 * Troca o conteúdo do store pelos dados reais de uma empresa.
 *
 * Chamado quando a sessão define a empresa ativa — inclusive na troca de
 * ambiente do administrador. Sem isso, uma clínica recém-criada abriria com o
 * catálogo e os 84 clientes da demonstração, que é exatamente o defeito que
 * esta migração existe para corrigir.
 */
export async function hydrateCompany(companyId: string) {
  if (!isSupabaseConfigured) return;
  if (state.companyId === companyId && !state.loading) return;

  mutate(() => ({ companyId, loading: true, lastError: null }));

  try {
    const data = await loadCompanyData(companyId);
    mutate(() => ({
      ...data,
      companyId,
      loading: false,
      // Agenda vem por data, direto do banco: o overlay é do modo mock.
      agenda: {},
    }));

    // Depois da carga, não antes: um evento que chegasse durante o carregamento
    // seria sobrescrito pelo `mutate` acima, e o bloco recém-marcado sumiria da
    // grade sem que ninguém tivesse desmarcado nada.
    const { subscribeToAgenda } = await import('./realtime');
    subscribeToAgenda(companyId);
  } catch (error) {
    mutate(() => ({
      loading: false,
      lastError: error instanceof Error ? error.message : 'Falha ao carregar os dados.',
    }));
  }
}

/** Volta ao estado neutro no logout, para o próximo login não ver o anterior. */
export function clearCompany() {
  if (!isSupabaseConfigured) return;

  // A assinatura precisa cair junto: uma sessão encerrada que continua ouvindo
  // a agenda escreveria no store do próximo login.
  void import('./realtime').then((m) => m.unsubscribeFromAgenda());

  state = { ...initialState(), services: [], professionals: [], clients: [], products: [] };
  for (const listener of listeners) listener();
}

export function dismissError() {
  if (state.lastError) mutate(() => ({ lastError: null }));
}

/* ==========================================================================
   ATALHOS DE ESCRITA POR COLEÇÃO
   ========================================================================= */

type Collections = Pick<
  OperationsState,
  | 'services'
  | 'professionals'
  | 'clients'
  | 'products'
  | 'movements'
  | 'entries'
  | 'closings'
  | 'blocks'
  | 'waitlist'
>;

/**
 * As três escritas seguem o mesmo desenho: aplicam localmente na hora e mandam
 * para o banco em seguida.
 *
 * O otimismo é deliberado. A alternativa — esperar a resposta antes de mexer na
 * tela — deixaria cada clique com meio segundo de nada acontecendo, e as telas
 * fecham o painel lateral logo após salvar. Quando a gravação falha, o estado
 * volta ao que era e `lastError` acende o aviso: o usuário perde o clique, não
 * a confiança no que está vendo.
 */
function push(
  key: RemoteKey,
  action: (companyId: string, timezone: string) => Promise<{ error: { message: string } | null }>,
  rollback: OperationsState,
) {
  if (!isSupabaseConfigured || !supabase) return;

  const { companyId, timezone } = state;
  if (!companyId) return;

  void action(companyId, timezone)
    .then(({ error }) => {
      if (!error) return;
      state = { ...rollback, lastError: traduzir(error.message, key) };
      for (const listener of listeners) listener();
    })
    .catch((error: unknown) => {
      state = {
        ...rollback,
        lastError: error instanceof Error ? error.message : 'Falha ao gravar.',
      };
      for (const listener of listeners) listener();
    });
}

/** As mensagens do Postgres são precisas e ilegíveis. */
function traduzir(message: string, key: RemoteKey): string {
  const m = message.toLowerCase();
  if (m.includes('violates row-level security')) {
    return 'Você não tem permissão para essa alteração.';
  }
  if (m.includes('duplicate key')) return 'Já existe um registro com esses dados.';
  if (m.includes('violates foreign key')) {
    return 'O registro está vinculado a outro e não pode ser removido assim.';
  }
  if (m.includes('saldo_insuficiente')) return 'Saldo insuficiente em estoque.';
  return `Não foi possível gravar em ${key}: ${message}`;
}

export function insert<K extends keyof Collections>(key: K, record: Collections[K][number]) {
  const before = state;
  mutate((current) => ({ [key]: [...(current[key] as unknown[]), record] }) as Partial<OperationsState>);

  if (!isRemoteKey(key as string)) return;
  const spec = REMOTE[key as RemoteKey];

  push(
    key as RemoteKey,
    async (companyId, timezone) => {
      const row = spec.toRow(record as never, companyId, timezone);
      // O id definitivo é do banco. O local (`nextId`) só serve para a tela ter
      // uma chave estável até a resposta chegar.
      const { data, error } = await supabase!.from(spec.table).insert(row).select('id').single();

      if (!error && data) {
        mutate((current) => ({
          [key]: (current[key] as Array<{ id: string }>).map((item) =>
            item.id === (record as { id: string }).id ? { ...item, id: data.id } : item,
          ),
        }) as Partial<OperationsState>);
      }
      return { error };
    },
    before,
  );
}

export function update<K extends keyof Collections>(
  key: K,
  id: string,
  patch: Partial<Collections[K][number]>,
) {
  const before = state;
  mutate((current) => {
    const list = current[key] as Array<{ id: string }>;
    return {
      [key]: list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    } as Partial<OperationsState>;
  });

  if (!isRemoteKey(key as string)) return;
  const spec = REMOTE[key as RemoteKey];
  if (spec.immutable) return;

  const merged = (state[key] as Array<{ id: string }>).find((item) => item.id === id);
  if (!merged) return;

  push(
    key as RemoteKey,
    async (companyId, timezone) =>
      supabase!.from(spec.table).update(spec.toRow(merged as never, companyId, timezone)).eq('id', id),
    before,
  );
}

export function remove<K extends keyof Collections>(key: K, id: string) {
  const before = state;
  mutate((current) => {
    const list = current[key] as Array<{ id: string }>;
    return { [key]: list.filter((item) => item.id !== id) } as Partial<OperationsState>;
  });

  if (!isRemoteKey(key as string)) return;
  const spec = REMOTE[key as RemoteKey];

  push(key as RemoteKey, async () => supabase!.from(spec.table).delete().eq('id', id), before);
}

/* ==========================================================================
   ATENDIMENTOS (modo banco)
   ========================================================================= */

/**
 * Aplica na janela em memória o atendimento que o banco acabou de confirmar.
 *
 * Diferente das nove coleções acima, a agenda **não** escreve otimista: quem
 * decide se o horário está livre é a constraint de exclusão do Postgres, e
 * pintar o bloco na grade antes da resposta seria afirmar o que ainda não se
 * sabe. Estas funções rodam depois do `await`, com a linha já gravada.
 */
export function upsertAppointment(appointment: Appointment) {
  mutate((current) => {
    const known = current.appointments.some((a) => a.id === appointment.id);
    return {
      appointments: known
        ? current.appointments.map((a) => (a.id === appointment.id ? appointment : a))
        : [...current.appointments, appointment],
    };
  });
}

export function dropAppointment(id: string) {
  mutate((current) => ({ appointments: current.appointments.filter((a) => a.id !== id) }));
}

/* ==========================================================================
   OVERLAY DA AGENDA
   ========================================================================= */

export const EMPTY_OVERLAY: DayOverlay = { created: [], patched: {}, removed: [] };

export function getOverlay(dateKey: string): DayOverlay {
  return state.agenda[dateKey] ?? EMPTY_OVERLAY;
}

export function patchOverlay(dateKey: string, recipe: (day: DayOverlay) => DayOverlay) {
  mutate((current) => ({
    agenda: {
      ...current.agenda,
      [dateKey]: recipe(current.agenda[dateKey] ?? EMPTY_OVERLAY),
    },
  }));
}
