-- =============================================================================
-- PRODENT — 0002 · ROW LEVEL SECURITY
--
-- A matriz de `src/config/permissions.ts` vira a tabela `role_capabilities`, e
-- as policies perguntam a ela. Frontend e banco passam a derivar da mesma
-- lista: não existe "o app deixa mas o banco não", nem o contrário.
--
-- Deny-by-default: toda tabela liga RLS. Uma tabela sem policy é uma tabela sem
-- acesso — falha fechada, que é o único jeito seguro de falhar num produto
-- multi-tenant.
--
-- `anon` não lê tabela nenhuma. O que a página pública mostra sai das funções
-- de 0003, que devolvem exatamente os campos permitidos. Sem isso, um
-- concorrente varreria a base de clientes de todas as clínicas numa query.
-- =============================================================================

-- =============================================================================
-- PRIVILÉGIOS
--
-- RLS filtra linhas; GRANT decide se o papel enxerga a tabela. São camadas
-- diferentes, e sem a segunda o PostgREST devolve 42501 antes de qualquer
-- policy rodar.
--
-- O Supabase costuma conceder isso por `alter default privileges`, mas depender
-- de configuração implícita do projeto torna a migration não reproduzível — em
-- outra instância, ou num banco recriado do zero, o app subiria quebrado.
--
-- Conceder amplo aqui é seguro **porque** toda tabela liga RLS logo abaixo:
-- o privilégio abre a porta, a policy decide o que passa. `anon` fica de fora
-- de propósito — a página pública lê pelas funções de 0003.
-- =============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Vitrine: preço e limites de plano aparecem na landing, antes do login.
grant select on public.plans to anon;

-- Tabelas criadas por migrations futuras herdam o mesmo padrão.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- =============================================================================
-- A MATRIZ
-- =============================================================================

create table public.role_capabilities (
  role        company_role not null,
  capability  text not null,
  primary key (role, capability)
);

-- Leitura livre para quem está autenticado: é tabela de configuração do
-- produto, igual para todas as empresas, e o frontend precisa dela para montar
-- o menu.
alter table public.role_capabilities enable row level security;
create policy role_capabilities_read on public.role_capabilities
  for select to authenticated using (true);

-- =============================================================================
-- FUNÇÕES DE APOIO
--
-- Todas `security definer`: precisam ler `memberships` sem passar pela RLS da
-- própria `memberships`, senão a policy chamaria a função que consulta a tabela
-- que tem a policy — recursão infinita no primeiro SELECT.
--
-- Todas `stable`: o Postgres avalia uma vez por consulta em vez de por linha.
-- =============================================================================

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins pa
     where pa.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
     where m.company_id = p_company
       and m.user_id = (select auth.uid())
  ) or public.is_platform_admin();
$$;

/*
 * Tem a capacidade nesta empresa?
 *
 * O administrador de plataforma passa em tudo. É o que sustenta o "acessar
 * ambiente" do centro de comando — e por isso toda escrita dele fica registrada
 * na auditoria, que é o contrapeso de um poder desses.
 */
create or replace function public.has_capability(p_company uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.memberships m
      join public.role_capabilities rc on rc.role = m.role
     where m.user_id = (select auth.uid())
       and m.company_id = p_company
       and rc.capability = p_capability
  ) or public.is_platform_admin();
$$;

-- Revoga o padrão do PostgREST e concede explicitamente.
revoke execute on function public.has_capability(uuid, text) from public;
revoke execute on function public.is_member(uuid) from public;
revoke execute on function public.is_platform_admin() from public;

grant execute on function public.has_capability(uuid, text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- =============================================================================
-- PLATAFORMA
-- =============================================================================

alter table public.plans enable row level security;
-- Planos são vitrine: preço e limites aparecem na landing.
create policy plans_read on public.plans
  for select to authenticated, anon using (is_public or public.is_platform_admin());
create policy plans_write on public.plans
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.platform_admins enable row level security;
create policy platform_admins_read on public.platform_admins
  for select to authenticated using (public.is_platform_admin());

alter table public.reserved_slugs enable row level security;
create policy reserved_slugs_read on public.reserved_slugs
  for select to authenticated using (true);

alter table public.subscriptions enable row level security;
create policy subscriptions_read on public.subscriptions
  for select to authenticated using (public.is_member(company_id));
-- Assinatura nunca é escrita pelo cliente: quem escreve é o webhook do
-- gateway, via service_role. O retorno do checkout é manipulável.
create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.audit_log enable row level security;
create policy audit_log_read on public.audit_log
  for select to authenticated
  using (public.is_platform_admin() or public.has_capability(company_id, 'company.settings.manage'));
-- Ninguém escreve auditoria pela API: quem escreve é o trigger.

-- =============================================================================
-- EMPRESA
-- =============================================================================

alter table public.companies enable row level security;

create policy companies_read on public.companies
  for select to authenticated using (public.is_member(id));

create policy companies_update on public.companies
  for update to authenticated
  using (public.has_capability(id, 'company.settings.manage'))
  with check (public.has_capability(id, 'company.settings.manage'));

create policy companies_admin_write on public.companies
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.company_settings enable row level security;
create policy company_settings_read on public.company_settings
  for select to authenticated using (public.is_member(company_id));
create policy company_settings_write on public.company_settings
  for all to authenticated
  using (public.has_capability(company_id, 'company.settings.manage'))
  with check (public.has_capability(company_id, 'company.settings.manage'));

alter table public.business_hours enable row level security;
create policy business_hours_read on public.business_hours
  for select to authenticated using (public.is_member(company_id));
create policy business_hours_write on public.business_hours
  for all to authenticated
  using (public.has_capability(company_id, 'company.settings.manage'))
  with check (public.has_capability(company_id, 'company.settings.manage'));

alter table public.holidays enable row level security;
create policy holidays_read on public.holidays
  for select to authenticated using (public.is_member(company_id));
create policy holidays_write on public.holidays
  for all to authenticated
  using (public.has_capability(company_id, 'company.settings.manage'))
  with check (public.has_capability(company_id, 'company.settings.manage'));

-- ---------------------------------------------------------------------------
-- Membros.
--
-- A leitura própria vem primeiro e sem função: é o que o app consulta no boot
-- para descobrir a que empresa o usuário pertence. Se dependesse de
-- `has_capability`, precisaríamos saber a empresa antes de poder descobri-la.
-- ---------------------------------------------------------------------------
alter table public.memberships enable row level security;

create policy memberships_self on public.memberships
  for select to authenticated using (user_id = (select auth.uid()));

create policy memberships_read on public.memberships
  for select to authenticated using (public.is_member(company_id));

create policy memberships_write on public.memberships
  for all to authenticated
  using (public.has_capability(company_id, 'company.settings.manage'))
  with check (public.has_capability(company_id, 'company.settings.manage'));

-- =============================================================================
-- EQUIPE E CATÁLOGO
--
-- Ler o catálogo é pré-requisito de ver a agenda: sem os serviços, um
-- atendimento é um retângulo sem nome. Por isso a leitura exige `.view` (que
-- todos os papéis têm) e só a escrita exige `.manage`.
-- =============================================================================

alter table public.professionals enable row level security;
create policy professionals_read on public.professionals
  for select to authenticated
  using (public.has_capability(company_id, 'company.professionals.view'));
create policy professionals_write on public.professionals
  for all to authenticated
  using (public.has_capability(company_id, 'company.professionals.manage'))
  with check (public.has_capability(company_id, 'company.professionals.manage'));

alter table public.professional_schedules enable row level security;
create policy professional_schedules_all on public.professional_schedules
  for all to authenticated
  using (exists (
    select 1 from public.professionals p
     where p.id = professional_id
       and public.has_capability(p.company_id, 'company.professionals.view')))
  with check (exists (
    select 1 from public.professionals p
     where p.id = professional_id
       and public.has_capability(p.company_id, 'company.professionals.manage')));

alter table public.services enable row level security;
create policy services_read on public.services
  for select to authenticated
  using (public.has_capability(company_id, 'company.services.view'));
create policy services_write on public.services
  for all to authenticated
  using (public.has_capability(company_id, 'company.services.manage'))
  with check (public.has_capability(company_id, 'company.services.manage'));

alter table public.service_prices enable row level security;
create policy service_prices_all on public.service_prices
  for all to authenticated
  using (exists (
    select 1 from public.services s
     where s.id = service_id
       and public.has_capability(s.company_id, 'company.services.view')))
  with check (exists (
    select 1 from public.services s
     where s.id = service_id
       and public.has_capability(s.company_id, 'company.services.manage')));

alter table public.service_components enable row level security;
create policy service_components_all on public.service_components
  for all to authenticated
  using (exists (
    select 1 from public.services s
     where s.id = combo_id
       and public.has_capability(s.company_id, 'company.services.view')))
  with check (exists (
    select 1 from public.services s
     where s.id = combo_id
       and public.has_capability(s.company_id, 'company.services.manage')));

alter table public.professional_services enable row level security;
create policy professional_services_all on public.professional_services
  for all to authenticated
  using (exists (
    select 1 from public.professionals p
     where p.id = professional_id
       and public.has_capability(p.company_id, 'company.professionals.view')))
  with check (exists (
    select 1 from public.professionals p
     where p.id = professional_id
       and public.has_capability(p.company_id, 'company.professionals.manage')));

-- =============================================================================
-- CLIENTES E AGENDA
-- =============================================================================

alter table public.clients enable row level security;
create policy clients_read on public.clients
  for select to authenticated
  using (public.has_capability(company_id, 'company.clients.view'));
create policy clients_write on public.clients
  for all to authenticated
  using (public.has_capability(company_id, 'company.clients.manage'))
  with check (public.has_capability(company_id, 'company.clients.manage'));

alter table public.appointments enable row level security;
create policy appointments_read on public.appointments
  for select to authenticated
  using (public.has_capability(company_id, 'company.appointments.view'));
create policy appointments_write on public.appointments
  for all to authenticated
  using (public.has_capability(company_id, 'company.appointments.manage'))
  with check (public.has_capability(company_id, 'company.appointments.manage'));

alter table public.appointment_services enable row level security;
create policy appointment_services_all on public.appointment_services
  for all to authenticated
  using (exists (
    select 1 from public.appointments a
     where a.id = appointment_id
       and public.has_capability(a.company_id, 'company.appointments.view')))
  with check (exists (
    select 1 from public.appointments a
     where a.id = appointment_id
       and public.has_capability(a.company_id, 'company.appointments.manage')));

alter table public.schedule_blocks enable row level security;
create policy schedule_blocks_read on public.schedule_blocks
  for select to authenticated
  using (public.has_capability(company_id, 'company.appointments.view'));
create policy schedule_blocks_write on public.schedule_blocks
  for all to authenticated
  using (public.has_capability(company_id, 'company.appointments.manage'))
  with check (public.has_capability(company_id, 'company.appointments.manage'));

alter table public.waitlist enable row level security;
create policy waitlist_read on public.waitlist
  for select to authenticated
  using (public.has_capability(company_id, 'company.appointments.view'));
create policy waitlist_write on public.waitlist
  for all to authenticated
  using (public.has_capability(company_id, 'company.appointments.manage'))
  with check (public.has_capability(company_id, 'company.appointments.manage'));

-- =============================================================================
-- ESTOQUE
-- =============================================================================

alter table public.products enable row level security;
create policy products_read on public.products
  for select to authenticated
  using (public.has_capability(company_id, 'company.products.view'));
create policy products_write on public.products
  for all to authenticated
  using (public.has_capability(company_id, 'company.products.manage'))
  with check (public.has_capability(company_id, 'company.products.manage'));

alter table public.stock_movements enable row level security;
create policy stock_movements_read on public.stock_movements
  for select to authenticated
  using (public.has_capability(company_id, 'company.products.view'));
-- Movimentação não se edita nem se apaga: correção é um `ajuste`, que grava o
-- acerto como evento em vez de sumir com o rastro.
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (public.has_capability(company_id, 'company.products.manage'));

-- =============================================================================
-- CAIXA
-- =============================================================================

alter table public.cash_entries enable row level security;
create policy cash_entries_read on public.cash_entries
  for select to authenticated
  using (public.has_capability(company_id, 'company.financial.view'));
create policy cash_entries_write on public.cash_entries
  for all to authenticated
  using (public.has_capability(company_id, 'company.financial.manage'))
  with check (public.has_capability(company_id, 'company.financial.manage'));

alter table public.cash_closings enable row level security;
create policy cash_closings_read on public.cash_closings
  for select to authenticated
  using (public.has_capability(company_id, 'company.financial.view'));
create policy cash_closings_write on public.cash_closings
  for all to authenticated
  using (public.has_capability(company_id, 'company.financial.manage'))
  with check (public.has_capability(company_id, 'company.financial.manage'));
