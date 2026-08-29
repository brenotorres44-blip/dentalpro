import type { Role } from '@/data/saas';

/**
 * MATRIZ DE PERMISSÕES — fonte única de verdade.
 *
 * Nenhum componente decide sozinho o que um papel pode fazer: todos perguntam
 * a `can()`. Quando o Supabase entrar, esta matriz vira a especificação das
 * policies de RLS, e a checagem no cliente continua sendo apenas conveniência
 * de UX — a barreira real fica no banco.
 */
export type Capability =
  // plataforma (somente super admin)
  | 'platform.view'
  | 'platform.companies.manage'
  | 'platform.plans.manage'
  | 'platform.subscriptions.manage'
  | 'platform.users.manage'
  | 'platform.support.manage'
  | 'platform.logs.view'
  | 'platform.impersonate'
  // empresa
  //
  // Ler e administrar são capacidades separadas. Ver o catálogo é pré-requisito
  // de ver a agenda — sem os serviços, um atendimento é um retângulo sem nome —
  // enquanto mexer no preço é outra conversa. Enquanto tudo vinha do mesmo mock
  // a distinção não aparecia; com RLS no banco, `services.view` ausente faria a
  // agenda do profissional carregar vazia.
  | 'company.dashboard.view'
  | 'company.appointments.view'
  | 'company.appointments.manage'
  | 'company.clients.view'
  | 'company.clients.manage'
  | 'company.services.view'
  | 'company.services.manage'
  | 'company.professionals.view'
  | 'company.professionals.manage'
  | 'company.financial.view'
  | 'company.financial.manage'
  | 'company.products.view'
  | 'company.products.manage'
  | 'company.reports.view'
  | 'company.settings.manage'
  | 'company.theme.manage';

const OWNER: Capability[] = [
  'company.dashboard.view',
  'company.appointments.view',
  'company.appointments.manage',
  'company.clients.view',
  'company.clients.manage',
  'company.services.view',
  'company.services.manage',
  'company.professionals.view',
  'company.professionals.manage',
  'company.financial.view',
  'company.financial.manage',
  'company.products.view',
  'company.products.manage',
  'company.reports.view',
  'company.settings.manage',
  'company.theme.manage',
];

const MANAGER: Capability[] = [
  'company.dashboard.view',
  'company.appointments.view',
  'company.appointments.manage',
  'company.clients.view',
  'company.clients.manage',
  'company.services.view',
  'company.services.manage',
  'company.professionals.view',
  'company.professionals.manage',
  'company.financial.view',
  'company.financial.manage',
  'company.products.view',
  'company.products.manage',
  'company.reports.view',
];

// Opera o balcão: marca, atende e cobra. Lê o catálogo e o estoque porque a
// agenda e o painel os exibem; não mexe em preço, equipe nem caixa.
const ATTENDANT: Capability[] = [
  'company.dashboard.view',
  'company.appointments.view',
  'company.appointments.manage',
  'company.clients.view',
  'company.clients.manage',
  'company.services.view',
  'company.professionals.view',
  'company.products.view',
];

// O profissional enxerga a própria rotina; não mexe em preço, equipe ou caixa.
const PROFESSIONAL: Capability[] = [
  'company.dashboard.view',
  'company.appointments.view',
  'company.clients.view',
  'company.services.view',
  'company.professionals.view',
  'company.products.view',
];

const SUPER_ADMIN: Capability[] = [
  'platform.view',
  'platform.companies.manage',
  'platform.plans.manage',
  'platform.subscriptions.manage',
  'platform.users.manage',
  'platform.support.manage',
  'platform.logs.view',
  'platform.impersonate',
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: SUPER_ADMIN,
  owner: OWNER,
  manager: MANAGER,
  attendant: ATTENDANT,
  professional: PROFESSIONAL,
};

/**
 * Ao entrar no ambiente de um cliente, o super admin recebe os poderes de
 * `owner` — mas nunca as capacidades de plataforma dentro daquele contexto.
 * É o que faz a faixa de "modo administrador" ser uma troca real de papel e
 * não um crachá decorativo.
 */
export function capabilitiesFor(role: Role, impersonating: boolean): Capability[] {
  if (role === 'super_admin') return impersonating ? [...OWNER, 'platform.view'] : SUPER_ADMIN;
  return ROLE_CAPABILITIES[role];
}

export function can(capabilities: Capability[], capability: Capability) {
  return capabilities.includes(capability);
}
