import type { ThemeOverride } from '@/themes/tokens';

// ============================================================================
// TIPOS DO NÚCLEO SAAS
// ============================================================================

export type Role = 'super_admin' | 'owner' | 'manager' | 'professional' | 'attendant';

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'SUPER ADMIN',
  owner: 'OWNER',
  manager: 'MANAGER',
  professional: 'PROFISSIONAL',
  attendant: 'ATENDENTE',
};

export type CompanyStatus = 'active' | 'trial' | 'suspended' | 'canceled';
export type SubscriptionStatus = 'active' | 'overdue' | 'canceled' | 'trial';

/**
 * O id do plano é do banco, não uma união fechada aqui.
 *
 * Enquanto os planos moravam neste arquivo, `'starter' | 'pro' | 'premium'`
 * era verdade. Com a tabela `plans` no Supabase, criar um plano novo pelo
 * centro de comando é uma linha no banco — e um tipo que exige recompilar o
 * frontend para reconhecer o plano que o administrador acabou de criar não é
 * segurança de tipo, é uma trava.
 */
export type PlanId = string;

/**
 * Limites do plano. `null` é **ilimitado**, nunca "nenhum" — mesma convenção
 * das colunas do banco. Zero seria um plano que não deixa cadastrar ninguém.
 */
export interface PlanLimits {
  users: number | null;
  professionals: number | null;
  appointmentsMonth: number | null;
  clients: number | null;
  storageGb: number | null;
  financial: boolean;
  inventory: boolean;
  reports: boolean;
  automations: boolean;
  themeBuilder: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceCents: number;
  tagline: string;
  sortOrder: number;
  isPublic: boolean;
  limits: PlanLimits;
  /**
   * O plano tem preço cadastrado no gateway — é cobrável.
   *
   * Booleano, e não o identificador: `price_…` não é segredo (ele aparece na
   * própria URL do checkout), mas dentro do sistema ninguém precisa dele além
   * da Edge Function. O que as telas perguntam é "dá para assinar este plano?",
   * e essa é a pergunta que o campo responde.
   */
  chargeable: boolean;
}

/** "ilimitado" é a leitura de `null` em toda tela que mostra um limite. */
export const limitLabel = (n: number | null, unlimited = 'ilimitado') =>
  n === null ? unlimited : n.toLocaleString('pt-BR');

export interface Company {
  id: string;
  name: string;
  slug: string;
  document: string;
  email: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  state: string;
  status: CompanyStatus;
  planId: PlanId;
  users: number;
  professionals: number;
  clients: number;
  monthlyRevenueCents: number;
  createdAt: string;
  /**
   * Última atividade, não último login.
   *
   * O banco não tem tabela de sessões — o que ele sabe é quando alguém desta
   * clínica gravou algo pela última vez (`audit_log`). Chamar isso de "último
   * acesso" seria dizer mais do que o dado sustenta, e a coluna da tela diz o
   * nome certo.
   */
  lastActivityAt: string;
  theme: ThemeOverride;
}

export interface SaasUser {
  id: string;
  name: string;
  email: string;
  companyId: string | null;
  companyName: string | null;
  role: Role;
  /** Aqui é login de verdade: vem de `auth.users.last_sign_in_at`. */
  lastAccessAt: string;
  active: boolean;
}

export interface Subscription {
  id: string;
  companyId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  amountCents: number;
  startedAt: string;
  /**
   * Fim do período pago — `null` quando não há cobrança programada.
   *
   * Nulo é a resposta certa, e não uma data qualquer: sem assinatura no
   * gateway ninguém vai cobrar nada, e uma data ali seria a tela afirmando uma
   * cobrança futura que não existe. Antes o campo caía em `created_at` quando o
   * banco não sabia — o que exibia a data de contratação sob o rótulo "próxima
   * cobrança".
   */
  nextChargeAt: string | null;
  gateway: 'none' | 'stripe' | 'mercadopago';
  externalId: string | null;
}

export type LogKind =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'admin_login'
  | 'plan_change'
  | 'theme_change'
  | 'permission_change';

export interface SystemLog {
  id: string;
  at: string;
  kind: LogKind;
  actor: string;
  actorRole: Role;
  companyId: string | null;
  companyName: string | null;
  message: string;
}

export type TicketStatus = 'open' | 'reviewing' | 'answered' | 'resolved';

export interface Ticket {
  id: string;
  companyId: string;
  subject: string;
  status: TicketStatus;
  priority: 'low' | 'normal' | 'high';
  openedAt: string;
  lastReplyAt: string;
  messages: number;
}

// ============================================================================
// PLANOS
// ============================================================================

/**
 * Os mesmos três planos do `0004_seed.sql`, com os mesmos ids e preços.
 *
 * Não é coincidência que estejam duplicados: são os dois modos do produto. O
 * que **não** pode acontecer é divergirem — a landing mostraria um preço no
 * modo demonstração e outro com banco. Ao mexer aqui, mexa no seed também.
 */
export const PLANS: Plan[] = [
  {
    id: 'essencial',
    name: 'ESSENCIAL',
    priceCents: 9900,
    tagline: 'Para quem está começando sozinho ou com um parceiro',
    sortOrder: 1,
    isPublic: true,
    // Sem gateway no modo demonstração: nenhum plano é cobrável, e a tela de
    // planos mostra isso em vez de um botão que levaria a lugar nenhum.
    chargeable: false,
    limits: {
      users: 3,
      professionals: 3,
      appointmentsMonth: 400,
      clients: 500,
      storageGb: 1,
      financial: true,
      inventory: false,
      reports: false,
      automations: false,
      themeBuilder: false,
      prioritySupport: false,
    },
  },
  {
    id: 'profissional',
    name: 'PROFISSIONAL',
    priceCents: 19900,
    tagline: 'Para consultórios em operação, com equipe formada',
    sortOrder: 2,
    isPublic: true,
    chargeable: false,
    limits: {
      users: 10,
      professionals: 10,
      appointmentsMonth: 2000,
      clients: 5000,
      storageGb: 10,
      financial: true,
      inventory: true,
      reports: true,
      automations: true,
      themeBuilder: true,
      prioritySupport: false,
    },
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    priceCents: 39900,
    tagline: 'Para clínicas com múltiplos consultórios',
    sortOrder: 3,
    isPublic: true,
    chargeable: false,
    limits: {
      users: null,
      professionals: null,
      appointmentsMonth: null,
      clients: null,
      storageGb: 100,
      financial: true,
      inventory: true,
      reports: true,
      automations: true,
      themeBuilder: true,
      prioritySupport: true,
    },
  },
];

/**
 * Plano por id, com queda para o primeiro.
 *
 * A lista consultada é a que estiver carregada — com banco, os planos vêm de
 * `plans`, e um plano criado pelo centro de comando precisa ser encontrado
 * aqui. Sem essa indireção, `getPlan` responderia sempre pelas três constantes
 * acima e a tabela de empresas mostraria o plano errado.
 */
let planRegistry: Plan[] = PLANS;

export const setPlanRegistry = (plans: Plan[]) => {
  if (plans.length) planRegistry = plans;
};

export const getPlan = (id: PlanId): Plan =>
  planRegistry.find((p) => p.id === id) ?? planRegistry[0];

export const listPlans = (): Plan[] => planRegistry;

// ============================================================================
// CLÍNICAS
// ============================================================================

const CITIES: Array<[string, string]> = [
  ['São Paulo', 'SP'], ['Campinas', 'SP'], ['Rio de Janeiro', 'RJ'], ['Niterói', 'RJ'],
  ['Belo Horizonte', 'MG'], ['Uberlândia', 'MG'], ['Curitiba', 'PR'], ['Londrina', 'PR'],
  ['Porto Alegre', 'RS'], ['Caxias do Sul', 'RS'], ['Salvador', 'BA'], ['Recife', 'PE'],
  ['Fortaleza', 'CE'], ['Goiânia', 'GO'], ['Florianópolis', 'SC'], ['Joinville', 'SC'],
];

const SHOP_NAMES = [
  'Clínica OdontoVida', 'Consultório Sorriso Pleno', 'Dental Prime', 'OdontoCare Clínica',
  'Sorriso & Saúde', 'Clínica Dental Bella', 'OdontoExcellence', 'Boa Forma Dental',
  'Clínica Sorridental', 'Dental House', 'OdontoLife Clínica', 'Clínica Dente São',
  'Sorriso Ideal Odontologia', 'Clínica Odonto Premium', 'Studio Dental', 'Clínica Bem Dental',
  'OdontoNova', 'Clínica Raiz Forte', 'Sorriso Clean Odontologia', 'Clínica Odontológica Vitalle',
  'Dental Center SP', 'Clínica Odonto Norte', 'Sorriso Urbano', 'Clínica Odonto Atlas',
  'Consultório Dental Real', 'Clínica Odonto Sete', 'OdontoZero', 'Clínica Odonto Vertex',
];

const OWNERS = [
  'Ricardo Menezes', 'Fernanda Prado', 'Marcelo Dias', 'Juliana Castro', 'Paulo Vitor Nunes',
  'Camila Moreira', 'Rodrigo Salles', 'Bianca Teixeira', 'Henrique Lopes', 'Patrícia Amaral',
  'Gustavo Reis', 'Larissa Fontes', 'Anderson Melo', 'Tatiane Braga', 'Wagner Pires',
  'Simone Duarte', 'Rafael Coutinho', 'Vanessa Lima', 'Eduardo Bastos', 'Priscila Nogueira',
  'Márcio Vasques', 'Aline Ferraz', 'Leonardo Prado', 'Carolina Beltrão', 'Fábio Quintela',
  'Renata Aguiar', 'Thiago Barreto', 'Mariana Ventura',
];

// Precisa conter só ids que existem em `themes/tokens.ts`: um id órfão aqui
// faria as clínicas de demonstração nascerem com o tema caindo no fallback, e
// o painel de adoção mostraria uma coluna que ninguém escolheu.
const THEME_IDS = ['clinic-clean', 'clinic-night'];

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (daysAgo: number, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function buildCompanies(): Company[] {
  return SHOP_NAMES.map((name, i) => {
    const r = rng(hash(`company-${name}`));
    const [city, state] = CITIES[i % CITIES.length];

    // As duas primeiras são fixas: são as que aparecem nos exemplos e nas
    // demonstrações, então não podem mudar a cada ajuste no gerador.
    const status: CompanyStatus =
      i === 0 ? 'active'
      : i === 1 ? 'active'
      : r() > 0.86 ? 'suspended'
      : r() > 0.78 ? 'trial'
      : r() > 0.94 ? 'canceled'
      : 'active';

    const planId: PlanId =
      i === 0 ? 'premium'
      : i === 1 ? 'premium'
      : r() > 0.66 ? 'profissional'
      : r() > 0.3 ? 'essencial'
      : 'profissional';

    // c1 usa o tema padrão da plataforma; c2 fica no CLEAN NOTURNO para que a
    // troca de ambiente do administrador mostre visualmente duas clínicas
    // distintas.
    const themeId = i === 0 ? 'clinic-clean' : i === 1 ? 'clinic-night' : THEME_IDS[Math.floor(r() * THEME_IDS.length)];
    // O plano PREMIUM não tem teto (`null`): a demonstração usa 12 como número
    // plausível de equipe, não como limite.
    const capProfessionals = getPlan(planId).limits.professionals ?? 12;
    const capUsers = getPlan(planId).limits.users ?? 20;
    const professionals = Math.max(1, Math.round(r() * capProfessionals));

    return {
      id: `c${i + 1}`,
      name: name.toUpperCase(),
      slug: slugify(name),
      document: `${10 + (i % 89)}.${100 + i}.${(i * 7) % 900 + 100}/0001-${(i * 13) % 90 + 10}`,
      email: `contato@${slugify(name)}.com.br`,
      ownerName: OWNERS[i % OWNERS.length],
      ownerEmail: `${slugify(OWNERS[i % OWNERS.length]).split('-')[0]}@${slugify(name)}.com.br`,
      phone: `(${11 + (i % 78)}) 9${8000 + i}-${1000 + i * 7}`,
      city,
      state,
      status,
      planId,
      users: Math.max(1, Math.round(r() * capUsers)),
      professionals,
      clients: Math.round(180 + r() * 2400),
      monthlyRevenueCents: Math.round((18000 + r() * 62000) * 100),
      createdAt: iso(Math.round(20 + r() * 700)),
      lastActivityAt: status === 'canceled' ? iso(Math.round(40 + r() * 120)) : iso(r() * 6, r() * 20),
      theme: { baseThemeId: themeId },
    };
  });
}

export const COMPANIES: Company[] = buildCompanies();

/** A clínica usada nas demonstrações e no ambiente operacional padrão. */
export const DEMO_COMPANY_ID = 'c1';

// ============================================================================
// USUÁRIOS
// ============================================================================

const ODONTOVIDA = COMPANIES[0].name;

export const USERS: SaasUser[] = [
  {
    id: 'u0',
    name: 'Breno Torres',
    email: 'admin@prodent.app',
    companyId: null,
    companyName: null,
    role: 'super_admin',
    lastAccessAt: iso(0, 1),
    active: true,
  },
  {
    id: 'u1',
    name: COMPANIES[0].ownerName,
    email: 'owner@odontovida.com.br',
    companyId: 'c1',
    companyName: ODONTOVIDA,
    role: 'owner',
    lastAccessAt: iso(0, 2),
    active: true,
  },
  {
    id: 'u2',
    name: 'Camila Vasconcelos',
    email: 'camila@odontovida.com.br',
    companyId: 'c1',
    companyName: ODONTOVIDA,
    role: 'professional',
    lastAccessAt: iso(0, 4),
    active: true,
  },
  {
    id: 'u3',
    name: 'Sabrina Alves',
    email: 'recepcao@odontovida.com.br',
    companyId: 'c1',
    companyName: ODONTOVIDA,
    role: 'attendant',
    lastAccessAt: iso(1, 3),
    active: true,
  },
  {
    id: 'u4',
    name: 'Roberta Pinheiro',
    email: 'gerencia@odontovida.com.br',
    companyId: 'c1',
    companyName: ODONTOVIDA,
    role: 'manager',
    lastAccessAt: iso(0, 7),
    active: true,
  },
  ...COMPANIES.slice(1, 18).map((c, i) => ({
    id: `u${10 + i}`,
    name: c.ownerName,
    email: c.ownerEmail,
    companyId: c.id,
    companyName: c.name,
    role: 'owner' as Role,
    lastAccessAt: c.lastActivityAt,
    active: c.status !== 'canceled',
  })),
];

/**
 * Credenciais de demonstração.
 * Qualquer senha é aceita nesta fase — a validação real vem com o Supabase.
 */
export const DEMO_ACCOUNTS = [
  { email: 'admin@prodent.app', label: 'Super admin da plataforma', role: 'super_admin' as Role },
  { email: 'owner@odontovida.com.br', label: 'Dono da Clínica OdontoVida', role: 'owner' as Role },
  { email: 'recepcao@odontovida.com.br', label: 'Recepção da Clínica OdontoVida', role: 'attendant' as Role },
];

// ============================================================================
// ASSINATURAS
// ============================================================================

export const SUBSCRIPTIONS: Subscription[] = COMPANIES.map((c, i) => {
  const r = rng(hash(`sub-${c.id}`));
  const status: SubscriptionStatus =
    c.status === 'canceled' ? 'canceled'
    : c.status === 'trial' ? 'trial'
    : c.status === 'suspended' ? 'overdue'
    : 'active';

  return {
    id: `s${i + 1}`,
    companyId: c.id,
    planId: c.planId,
    status,
    amountCents: getPlan(c.planId).priceCents,
    startedAt: c.createdAt,
    // Sem gateway não há próxima cobrança. A data sorteada que ficava aqui
    // aparecia na mesma linha do selo "não integrado" — duas afirmações
    // contrárias, lado a lado, sobre o mesmo contrato.
    nextChargeAt: null,
    gateway: 'none' as const,
    externalId: null,
  };
});

// ============================================================================
// LOGS
// ============================================================================

const LOG_TEMPLATES: Array<[LogKind, string]> = [
  ['admin_login', 'acessou o ambiente de {company}'],
  ['plan_change', 'alterou o plano de {company} para {plan}'],
  ['theme_change', 'alterou o tema de {company}'],
  ['create', 'criou um novo profissional em {company}'],
  ['update', 'atualizou os horários de atendimento de {company}'],
  ['login', 'entrou no sistema'],
  ['logout', 'encerrou a sessão'],
  ['delete', 'removeu um procedimento do catálogo de {company}'],
  ['permission_change', 'alterou as permissões de um usuário de {company}'],
];

export const LOGS: SystemLog[] = Array.from({ length: 60 }, (_, i) => {
  const r = rng(hash(`log-${i}`));
  const [kind, template] = LOG_TEMPLATES[Math.floor(r() * LOG_TEMPLATES.length)];
  const company = COMPANIES[Math.floor(r() * COMPANIES.length)];
  const isAdmin = kind === 'admin_login' || kind === 'plan_change';
  const actor = isAdmin ? USERS[0] : USERS[Math.floor(r() * Math.min(USERS.length, 12))];

  return {
    id: `l${i + 1}`,
    at: iso(Math.floor(i / 8), (i % 8) * 1.7 + r()),
    kind,
    actor: actor.name,
    actorRole: actor.role,
    companyId: company.id,
    companyName: company.name,
    message: template
      .replace('{company}', company.name)
      .replace('{plan}', getPlan(company.planId).name),
  };
});

// ============================================================================
// SUPORTE
// ============================================================================

const TICKET_SUBJECTS = [
  'Não consigo emitir o relatório mensal',
  'Paciente recebeu lembrete duplicado',
  'Erro ao importar lista de pacientes',
  'Como alterar a comissão de um profissional?',
  'Cobrança duplicada no cartão',
  'Quero migrar do plano PROFISSIONAL para PREMIUM',
  'Agenda não sincroniza no celular',
  'Solicito exclusão de dados de um paciente',
  'Logo aparece cortado na página pública',
  'Preciso de mais um usuário no plano',
  'Item de consultório não baixa após o uso',
  'Dúvida sobre a nota fiscal',
];

export const TICKETS: Ticket[] = TICKET_SUBJECTS.map((subject, i) => {
  const r = rng(hash(`ticket-${subject}`));
  const status: TicketStatus =
    r() > 0.72 ? 'open' : r() > 0.55 ? 'reviewing' : r() > 0.3 ? 'answered' : 'resolved';

  return {
    id: `t${i + 1}`,
    companyId: COMPANIES[Math.floor(r() * COMPANIES.length)].id,
    subject,
    status,
    priority: r() > 0.82 ? 'high' : r() > 0.4 ? 'normal' : 'low',
    openedAt: iso(Math.round(r() * 14), r() * 20),
    lastReplyAt: iso(Math.round(r() * 3), r() * 20),
    messages: 1 + Math.round(r() * 7),
  };
});

// ============================================================================
// MÉTRICAS DA PLATAFORMA
// ============================================================================

export interface PlatformMetrics {
  activeCompanies: number;
  totalCompanies: number;
  newCompanies: number;
  /** Pessoas com acesso a algum consultório — não "sessões nos últimos 7 dias". */
  users: number;
  /** Valor recorrente contratado hoje. Não é caixa do mês — ver `billedMonthCents`. */
  mrrCents: number;
  /** Faturas pagas no mês corrente. Dinheiro que entrou, não valor contratado. */
  billedMonthCents: number;
  /** Cobranças que falharam — a fila de trabalho de quem cuida de inadimplência. */
  failedInvoices: number;
  /**
   * Existe alguma fatura registrada.
   *
   * O que decide se a série do painel é histórico de faturamento ou outra
   * coisa. Sem faturas, doze barras zeradas afirmariam "faturamento nulo"
   * quando a verdade é "cobrança não integrada" — e são coisas diferentes.
   */
  billingIntegrated: boolean;
  churnPct: number;
  openTickets: number;
  statusCounts: Record<CompanyStatus, number>;
}

export interface MrrPoint {
  /** `YYYY-MM` — o rótulo do eixo é derivado, não gravado. */
  month: string;
  valueCents: number;
  companies: number;
}

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** `2026-08` → `AGO`. Uma regra só, para os dois modos rotularem igual. */
export const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

/**
 * Números do topo do painel administrativo, **derivados da própria amostra**.
 *
 * Antes eram constantes redondas (1.284 empresas, 5.842 usuários) sobre uma
 * tabela de 28 linhas, e o painel precisava de uma nota de rodapé explicando
 * por que os dois números discordavam. Contando a amostra, a nota some: o modo
 * demonstração passa a obedecer à regra 8 como o modo com banco obedece.
 */
function buildMetrics(): PlatformMetrics {
  const counts: Record<CompanyStatus, number> = { active: 0, trial: 0, suspended: 0, canceled: 0 };
  for (const c of COMPANIES) counts[c.status] += 1;

  const thirtyDaysAgo = Date.now() - 30 * 86400000;

  return {
    activeCompanies: counts.active,
    totalCompanies: COMPANIES.length,
    newCompanies: COMPANIES.filter((c) => new Date(c.createdAt).getTime() >= thirtyDaysAgo).length,
    users: USERS.filter((u) => u.companyId !== null).length,
    // MRR conta assinatura ativa, não empresa ativa: quem está em trial ainda
    // não paga. Mesma regra do `platform_overview()` no banco.
    mrrCents: SUBSCRIPTIONS.filter((s) => s.status === 'active').reduce(
      (sum, s) => sum + s.amountCents,
      0,
    ),
    // Zero, e não uma amostra: sem gateway não houve cobrança nenhuma. Inventar
    // faturamento seria a única tela do sistema afirmando que dinheiro mudou de
    // mãos por causa de uma semente.
    billedMonthCents: 0,
    failedInvoices: 0,
    billingIntegrated: false,
    churnPct: Number(((counts.canceled / COMPANIES.length) * 100).toFixed(1)),
    openTickets: TICKETS.filter((t) => t.status === 'open').length,
    statusCounts: counts,
  };
}

export const PLATFORM_METRICS: PlatformMetrics = buildMetrics();

/**
 * Valor contratado nos últimos 12 meses.
 *
 * Para cada mês, a soma do plano **atual** das clínicas que já existiam naquele
 * mês. Quem trocou de plano em março aparece em janeiro com o preço de hoje —
 * é o defeito conhecido de uma reconstrução, e o motivo de o modo com banco ter
 * deixado de usá-la desde o `0013`: lá a série sai das faturas.
 *
 * Aqui ela fica, porque no modo demonstração não existe fatura nenhuma e um
 * gráfico zerado não é mais honesto que um reconstruído — desde que o rótulo
 * diga qual dos dois está na tela, que é o que `billingIntegrated` decide.
 */
export const MRR_SERIES: MrrPoint[] = Array.from({ length: 12 }, (_, i) => {
  const end = new Date();
  end.setDate(1);
  end.setMonth(end.getMonth() - (11 - i) + 1);

  const existing = COMPANIES.filter(
    (c) => new Date(c.createdAt) < end && c.status !== 'canceled',
  );

  const month = new Date(end);
  month.setMonth(month.getMonth() - 1);

  return {
    month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
    valueCents: existing.reduce((sum, c) => sum + getPlan(c.planId).priceCents, 0),
    companies: existing.length,
  };
});
