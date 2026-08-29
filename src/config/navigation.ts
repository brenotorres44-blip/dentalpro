import {
  BarChart3,
  Blocks,
  Building2,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Palette,
  ScrollText,
  Settings,
  ShieldCheck,
  Smile,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from './permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Código curto exibido no rail compacto e nos rótulos técnicos. */
  code: string;
  /** Item some do menu se o papel não tiver a capacidade. */
  capability?: Capability;
}

/** PRODENT — ambiente operacional da clínica. */
export const APP_NAV: NavItem[] = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, code: 'DSH', capability: 'company.dashboard.view' },
  { to: '/app/appointments', label: 'Agenda', icon: CalendarClock, code: 'AGD', capability: 'company.appointments.view' },
  { to: '/app/clients', label: 'Pacientes', icon: Users, code: 'PAC', capability: 'company.clients.view' },
  { to: '/app/services', label: 'Procedimentos', icon: Smile, code: 'PRC', capability: 'company.services.manage' },
  { to: '/app/professionals', label: 'Equipe', icon: UserRound, code: 'EQP', capability: 'company.professionals.manage' },
  { to: '/app/financial', label: 'Financeiro', icon: Wallet, code: 'FIN', capability: 'company.financial.view' },
  { to: '/app/products', label: 'Itens', icon: Package, code: 'ITE', capability: 'company.products.manage' },
  { to: '/app/reports', label: 'Relatórios', icon: BarChart3, code: 'REL', capability: 'company.reports.view' },
  { to: '/app/theme', label: 'Tema', icon: Palette, code: 'THM', capability: 'company.theme.manage' },
  // Assinatura fica ao lado de Configurações porque é a mesma capacidade e o
  // mesmo tipo de assunto: o que a clínica contratou, não o que ela opera.
  { to: '/app/subscription', label: 'Assinatura', icon: CreditCard, code: 'ASN', capability: 'company.settings.manage' },
  { to: '/app/settings', label: 'Configurações', icon: Settings, code: 'CFG', capability: 'company.settings.manage' },
];

/** SAAS CONTROL CENTER — ambiente do administrador da plataforma. */
export const ADMIN_NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Visão geral', icon: LayoutDashboard, code: 'OVW' },
  { to: '/admin/companies', label: 'Clínicas', icon: Building2, code: 'CLN', capability: 'platform.companies.manage' },
  { to: '/admin/users', label: 'Usuários', icon: Users, code: 'USR', capability: 'platform.users.manage' },
  { to: '/admin/plans', label: 'Planos', icon: Blocks, code: 'PLN', capability: 'platform.plans.manage' },
  { to: '/admin/subscriptions', label: 'Assinaturas', icon: CreditCard, code: 'SUB', capability: 'platform.subscriptions.manage' },
  { to: '/admin/support', label: 'Suporte', icon: LifeBuoy, code: 'SUP', capability: 'platform.support.manage' },
  { to: '/admin/logs', label: 'System logs', icon: ScrollText, code: 'LOG', capability: 'platform.logs.view' },
  { to: '/admin/themes', label: 'Temas', icon: Palette, code: 'THM' },
  { to: '/admin/settings', label: 'Plataforma', icon: ShieldCheck, code: 'PLT' },
];
