import type { LucideIcon } from 'lucide-react';
import { ADMIN_NAV, APP_NAV } from './navigation';
import type { Capability } from './permissions';

export interface ModuleSpec {
  path: string;
  code: string;
  title: string;
  icon: LucideIcon;
  capability?: Capability;
  description: string;
  /** O que o módulo vai fazer quando for implementado. */
  capabilities: string[];
}

/**
 * Rotas do PRODENT que já têm tela própria e não usam o stub.
 *
 * O esqueleto entrega dashboard, agenda, pacientes, procedimentos, equipe,
 * financeiro, itens de consultório, tema e configurações — os módulos que
 * cobrem "gestão do dia a dia". Relatórios e assinatura ficam de fora de
 * propósito: o primeiro depende de uma janela histórica maior do que este
 * corte construiu, o segundo depende de um gateway de cobrança que este
 * projeto não integrou (ver `docs/02-estado-do-projeto.md`). `ModulePage`
 * é o contrato para os dois: a navegação funciona, o escopo previsto fica
 * declarado, e nenhuma tela finge ter dado que não tem.
 */
const IMPLEMENTED = new Set([
  '/app/dashboard',
  '/app/theme',
  '/app/appointments',
  '/app/clients',
  '/app/services',
  '/app/professionals',
  '/app/financial',
  '/app/products',
  '/app/settings',
]);

const DETAILS: Record<string, { description: string; capabilities: string[] }> = {
  '/app/reports': {
    description: 'Séries históricas, comparativos e exportação.',
    capabilities: [
      'Faturamento por período, procedimento e dentista',
      'Retenção: pacientes novos x recorrentes',
      'Ocupação por faixa de horário',
      'Exportação em CSV e PDF',
    ],
  },
  '/app/subscription': {
    description: 'O que a clínica contratou com o PRODENT — plano, cobrança e faturas.',
    capabilities: [
      'Checkout e portal de cobrança (Stripe)',
      'Histórico de faturas',
      'Troca de plano',
      'Alerta de teto do plano',
    ],
  },
};

export const MODULES: ModuleSpec[] = APP_NAV.filter((item) => !IMPLEMENTED.has(item.to)).map(
  (item) => ({
    path: item.to,
    code: item.code,
    title: item.label,
    icon: item.icon,
    capability: item.capability,
    ...DETAILS[item.to],
  }),
);

/**
 * O mesmo contrato, um andar acima: o SAAS CONTROL CENTER.
 *
 * Visão geral, clínicas e planos têm tela própria porque são o que o
 * administrador precisa para responder "quem está usando o quê" sem entrar
 * no ambiente de ninguém. Usuários, assinaturas, suporte, logs e o editor de
 * temas dependem de infraestrutura que este esqueleto não levantou (gateway
 * de cobrança, fila de e-mail, tabela de sessão) — `docs/02-estado-do-projeto.md`
 * lista o que falta para cada um.
 */
const ADMIN_IMPLEMENTED = new Set(['/admin/dashboard', '/admin/companies', '/admin/plans', '/admin/settings']);

const ADMIN_DETAILS: Record<string, { description: string; capabilities: string[] }> = {
  '/admin/users': {
    description: 'Todas as pessoas com acesso a alguma clínica, por papel.',
    capabilities: [
      'Busca por nome, e-mail e clínica',
      'Suspender acesso sem remover o histórico',
      'Auditoria de troca de papel',
      'Convite direto pela plataforma',
    ],
  },
  '/admin/subscriptions': {
    description: 'Assinaturas de todas as clínicas, com status de cobrança.',
    capabilities: [
      'Status por gateway (Stripe)',
      'Fila de cobranças que falharam',
      'Reenvio manual de cobrança',
      'Histórico de troca de plano',
    ],
  },
  '/admin/support': {
    description: 'Fila de tickets abertos pelas clínicas.',
    capabilities: [
      'Prioridade e SLA por ticket',
      'Resposta direto pela plataforma',
      'Vínculo com o histórico da clínica',
      'Métricas de tempo de resposta',
    ],
  },
  '/admin/logs': {
    description: 'Trilha de auditoria de toda a plataforma.',
    capabilities: [
      'Filtro por clínica, papel e tipo de evento',
      'Exportação para investigação',
      'Retenção configurável',
      'Alerta em ação sensível',
    ],
  },
  '/admin/themes': {
    description: 'Editor de tema por clínica, com base na identidade da plataforma.',
    capabilities: [
      'Escolher a base entre os temas prontos',
      'Ajustar cor e efeitos por cima',
      'Rascunho antes de publicar',
      'Pré-visualização sem aplicar no próprio painel',
    ],
  },
};

export const ADMIN_MODULES: ModuleSpec[] = ADMIN_NAV.filter((item) => !ADMIN_IMPLEMENTED.has(item.to)).map(
  (item) => ({
    path: item.to,
    code: item.code,
    title: item.label,
    icon: item.icon,
    capability: item.capability,
    ...ADMIN_DETAILS[item.to],
  }),
);
