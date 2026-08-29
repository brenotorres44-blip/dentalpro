-- =============================================================================
-- PRODENT — 0007 · PLATAFORMA
--
-- O último bolsão de dado mockado era o `/admin/*`: as nove telas do SAAS
-- CONTROL CENTER liam de `src/data/saas.ts`. Esta migration entrega o que
-- faltava no banco para elas lerem de verdade.
--
-- Duas coisas, e só elas:
--
-- 1. **Suporte** — a única entidade do centro de comando que não existia em
--    tabela nenhuma. Empresas, planos, assinaturas, usuários e auditoria já
--    estavam modelados desde o `0001`.
--
-- 2. **Quatro funções de leitura de plataforma.** Não são conveniência: o
--    PostgREST não alcança o que elas devolvem.
--
--    - `platform_companies()` agrega contagens de quatro tabelas por empresa.
--      Fazer isso no cliente seria trazer todos os clientes e atendimentos de
--      todas as clínicas para contar linhas no navegador.
--    - `platform_users()` lê `auth.users`, que não é exposto pela API. Sem ela,
--      a tela de usuários mostraria uuid no lugar de e-mail.
--    - `platform_logs()` resolve o mesmo e-mail para `audit_log.actor_id`.
--    - `platform_overview()` são seis agregados sobre a base inteira.
--
--    Todas `security definer` — precisam ver além da RLS — e todas abrem
--    checando `is_platform_admin()`. Uma função `security definer` sem essa
--    linha é um furo de isolamento com aparência de recurso.
-- =============================================================================

-- =============================================================================
-- SUPORTE
-- =============================================================================

create type ticket_status as enum ('open', 'reviewing', 'answered', 'resolved');
create type ticket_priority as enum ('low', 'normal', 'high');

create table public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- Quem abriu. `set null` porque o ticket sobrevive à saída do funcionário:
  -- apagar o histórico de suporte junto com o usuário perderia o contexto de
  -- uma cobrança contestada.
  opened_by     uuid references auth.users(id) on delete set null,
  subject       text not null check (length(btrim(subject)) between 3 and 200),
  status        ticket_status not null default 'open',
  priority      ticket_priority not null default 'normal',
  -- Mantidos por trigger a partir de `support_messages`. Guardados na própria
  -- linha porque o quadro de suporte ordena por eles: um `order by` sobre
  -- subconsulta agregada varreria as mensagens de todos os tickets a cada
  -- abertura da tela.
  message_count integer not null default 0,
  last_reply_at timestamptz not null default now(),
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz
);

create index support_tickets_company_idx on public.support_tickets (company_id, opened_at desc);
create index support_tickets_status_idx on public.support_tickets (status, last_reply_at desc);

create table public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  -- Quem escreveu: o cliente ou a plataforma. Derivar de `is_platform_admin()`
  -- na hora da leitura daria a resposta errada no dia em que o administrador
  -- deixasse de ser administrador.
  from_platform boolean not null default false,
  body        text not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

/*
 * Contador e data da última resposta.
 *
 * Pelo mesmo motivo do saldo de estoque: número derivado mantido pelo banco não
 * diverge. Se a aplicação incrementasse, uma mensagem inserida por outro
 * caminho — importação, correção manual, Edge Function — deixaria o quadro
 * mentindo sobre quantas respostas o ticket tem.
 */
create or replace function public.touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket uuid := coalesce(new.ticket_id, old.ticket_id);
begin
  update public.support_tickets t
     set message_count = (select count(*) from public.support_messages m where m.ticket_id = v_ticket),
         last_reply_at = coalesce(
           (select max(m.created_at) from public.support_messages m where m.ticket_id = v_ticket),
           t.opened_at
         )
   where t.id = v_ticket;

  return coalesce(new, old);
end;
$$;

create trigger support_messages_touch
  after insert or update or delete on public.support_messages
  for each row execute function public.touch_ticket();

-- Suporte tem consequência de acesso e de cobrança: entra na auditoria.
create trigger support_tickets_audit
  after insert or update or delete on public.support_tickets
  for each row execute function public.write_audit();

-- =============================================================================
-- PRIVILÉGIOS E RLS
--
-- O ticket é da empresa, e a empresa precisa poder abrir e acompanhar o dela.
-- Sem isso, suporte viraria um canal só de saída — o administrador veria
-- tickets que ninguém consegue criar.
-- =============================================================================

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant delete on public.support_tickets to authenticated;

alter table public.support_tickets enable row level security;

create policy support_tickets_read on public.support_tickets
  for select to authenticated using (public.is_member(company_id));

-- Abrir chamado não é privilégio de administrador da clínica: qualquer
-- membro que enxerga a empresa pode relatar um problema dela.
create policy support_tickets_insert on public.support_tickets
  for insert to authenticated with check (public.is_member(company_id));

-- Alterar status e prioridade é da plataforma. Deixar o cliente reabrir o
-- próprio ticket como "aberto" apagaria a fila de trabalho do suporte.
create policy support_tickets_manage on public.support_tickets
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

alter table public.support_messages enable row level security;

create policy support_messages_read on public.support_messages
  for select to authenticated using (
    exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id and public.is_member(t.company_id)
    )
  );

create policy support_messages_insert on public.support_messages
  for insert to authenticated with check (
    exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id and public.is_member(t.company_id)
    )
    -- `from_platform` é afirmação de identidade: só quem é da plataforma pode
    -- marcar uma resposta como vinda dela.
    and (not from_platform or public.is_platform_admin())
  );

-- =============================================================================
-- PLANO COMO ESPECIFICAÇÃO, NÃO COMO TEXTO
--
-- `plans.features` era um `text[]` de frases soltas ("Relatórios e comissões").
-- Enquanto a tela de planos vivia do mock isso passava; ligada ao banco, vira o
-- defeito que a regra 8 existe para impedir — **duas fontes para a mesma
-- pergunta**. A landing lista "Estoque" a partir de uma frase, o Theme Center
-- bloqueia a personalização a partir de outra coisa, e no dia em que as duas
-- discordarem o cliente compra um plano que não entrega o que a página
-- prometeu.
--
-- Cada capacidade que o produto realmente consulta vira coluna. O que sobra em
-- `features` é decoração, e decoração não decide acesso — por isso a coluna sai.
-- =============================================================================

alter table public.plans
  add column tagline              text    not null default '',
  -- `null` = ilimitado, mesma convenção das três colunas de limite do `0001`.
  -- Zero seria "nenhum", que é outra coisa.
  add column max_clients          integer,
  add column storage_gb           integer,
  add column has_financial        boolean not null default true,
  add column has_inventory        boolean not null default false,
  add column has_reports          boolean not null default false,
  add column has_automations      boolean not null default false,
  add column has_theme_builder    boolean not null default false,
  add column has_priority_support boolean not null default false;

alter table public.plans drop column features;

-- `update`, não `insert ... on conflict`: as três linhas vieram do `0004` e as
-- empresas já apontam para elas. Trocar o id órfãos a base inteira.
update public.plans set
  tagline = 'Para quem está começando sozinho ou com um parceiro',
  max_clients = 500, storage_gb = 1,
  has_financial = true
where id = 'essencial';

update public.plans set
  tagline = 'Para clínicas em operação, com equipe formada',
  max_clients = 5000, storage_gb = 10,
  has_financial = true, has_inventory = true, has_reports = true,
  has_automations = true, has_theme_builder = true
where id = 'profissional';

update public.plans set
  tagline = 'Para redes e unidades múltiplas',
  max_clients = null, storage_gb = 100,
  has_financial = true, has_inventory = true, has_reports = true,
  has_automations = true, has_theme_builder = true, has_priority_support = true
where id = 'premium';

-- =============================================================================
-- NOME EXIBÍVEL DE UM USUÁRIO
--
-- `auth.users` guarda o nome em `raw_user_meta_data`, que é um jsonb livre: o
-- cadastro grava `name`, o OAuth do Google grava `full_name`, e um usuário
-- criado à mão no painel não grava nada. As três telas que mostram pessoas
-- precisam da mesma regra de desempate, então ela mora num lugar só.
-- =============================================================================

create or replace function public.user_display_name(p_user auth.users)
returns text
language sql
immutable
as $$
  -- Os parênteses não são estilo: sem eles o parser lê `p_user.email` como
  -- coluna `email` da tabela `p_user`, que não está no FROM.
  select coalesce(
    nullif(btrim(($1).raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(($1).raw_user_meta_data ->> 'full_name'), ''),
    -- Último recurso: a parte local do e-mail. Melhor "ricardo.menezes" que um
    -- uuid — a tela existe para o administrador reconhecer a pessoa.
    initcap(replace(split_part(($1).email, '@', 1), '.', ' ')),
    'sem nome'
  );
$$;

-- =============================================================================
-- EMPRESAS COM OS NÚMEROS DA TELA
--
-- Uma ida ao servidor para as vinte e poucas colunas que a tabela do centro de
-- comando mostra. As contagens são subconsultas correlacionadas e não `join`:
-- com `join` + `group by`, contar usuários e profissionais na mesma consulta
-- multiplicaria as linhas de um pelo outro e inflaria os dois números.
-- =============================================================================

create or replace function public.platform_companies()
returns table (
  id                    uuid,
  slug                  text,
  name                  text,
  document              text,
  email                 text,
  phone                 text,
  city                  text,
  state                 char(2),
  status                company_status,
  plan_id               text,
  theme_id              text,
  owner_name            text,
  owner_email           text,
  users                 integer,
  professionals         integer,
  clients               integer,
  monthly_revenue_cents bigint,
  created_at            timestamptz,
  last_access_at        timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.slug,
    c.name,
    c.document,
    c.email,
    c.phone,
    c.city,
    c.state,
    c.status,
    c.plan_id,
    c.theme_id,
    (select public.user_display_name(u) from public.memberships m
       join auth.users u on u.id = m.user_id
      where m.company_id = c.id and m.role = 'owner'
      order by m.created_at limit 1),
    (select u.email::text from public.memberships m
       join auth.users u on u.id = m.user_id
      where m.company_id = c.id and m.role = 'owner'
      order by m.created_at limit 1),
    (select count(*)::integer from public.memberships m where m.company_id = c.id),
    (select count(*)::integer from public.professionals p
      where p.company_id = c.id and p.is_active),
    (select count(*)::integer from public.clients cl where cl.company_id = c.id),
    -- Faturamento do mês corrente, no fuso da clínica. Usar o fuso do
    -- servidor cortaria o mês na hora errada para quem opera em Rio Branco.
    (select coalesce(sum(a.price_cents), 0)::bigint
       from public.appointments a
      where a.company_id = c.id
        and a.status = 'concluido'
        and a.starts_at >= date_trunc('month', now() at time zone c.timezone) at time zone c.timezone),
    c.created_at,
    -- Não existe tabela de sessões: o que o banco sabe é quando alguém desta
    -- empresa gravou algo pela última vez. É menos que "último acesso" e mais
    -- honesto que inventar — a coluna da tela diz "última atividade".
    coalesce(
      (select max(al.occurred_at) from public.audit_log al where al.company_id = c.id),
      c.created_at
    )
  from public.companies c
  where public.is_platform_admin()
  order by c.name;
$$;

-- =============================================================================
-- USUÁRIOS DA PLATAFORMA
-- =============================================================================

create or replace function public.platform_users()
returns table (
  id           uuid,
  name         text,
  email        text,
  company_id   uuid,
  company_name text,
  role         text,
  created_at   timestamptz,
  last_sign_in_at timestamptz,
  active       boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Administradores de plataforma primeiro: não têm empresa, e é por isso que
  -- eles não saem de `memberships`. Poder de plataforma não é papel dentro de
  -- uma empresa — a modelagem do `0001` separou os dois de propósito.
  select
    u.id,
    public.user_display_name(u),
    u.email::text,
    null::uuid,
    null::text,
    'super_admin',
    u.created_at,
    u.last_sign_in_at,
    true
  from public.platform_admins pa
  join auth.users u on u.id = pa.user_id
  where public.is_platform_admin()

  union all

  select
    u.id,
    public.user_display_name(u),
    u.email::text,
    m.company_id,
    c.name,
    m.role::text,
    m.created_at,
    u.last_sign_in_at,
    -- Um usuário de empresa cancelada continua existindo, mas não opera.
    c.status <> 'canceled'
  from public.memberships m
  join auth.users u on u.id = m.user_id
  join public.companies c on c.id = m.company_id
  where public.is_platform_admin()

  order by 6, 2;
$$;

-- =============================================================================
-- AUDITORIA COM NOME DE GENTE
--
-- A tabela guarda `actor_id` e `table_name`; a tela mostra "Ricardo alterou os
-- horários da CLÍNICA ELITE". A tradução é aqui, não no navegador: o cliente
-- não lê `auth.users` nem deveria baixar a base de empresas para resolver um
-- nome por linha.
-- =============================================================================

create or replace function public.platform_logs(p_limit integer default 100)
returns table (
  id           bigint,
  occurred_at  timestamptz,
  operation    text,
  table_name   text,
  actor_name   text,
  actor_role   text,
  company_id   uuid,
  company_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    al.id,
    al.occurred_at,
    al.operation,
    al.table_name,
    coalesce((select public.user_display_name(u) from auth.users u where u.id = al.actor_id), 'sistema'),
    coalesce(
      (select case when exists (select 1 from public.platform_admins pa where pa.user_id = al.actor_id)
                then 'super_admin'
                else m.role::text end
         from public.memberships m
        where m.user_id = al.actor_id and m.company_id = al.company_id),
      'sistema'
    ),
    al.company_id,
    (select c.name from public.companies c where c.id = al.company_id)
  from public.audit_log al
  where public.is_platform_admin()
  order by al.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

-- =============================================================================
-- OS NÚMEROS DO TOPO
--
-- Um jsonb em vez de nove colunas: são grandezas de naturezas diferentes que a
-- tela consome juntas, e um `returns table` de uma linha só com nove colunas
-- heterogêneas é mais difícil de estender do que um objeto.
--
-- **A série de MRR é reconstruída, não histórica.** Não existe tabela de
-- faturas: o que o banco sabe é quando cada empresa foi criada e qual plano ela
-- tem hoje. A série soma, para cada mês, o plano atual das empresas que já
-- existiam naquele mês. Quem trocou de plano em março aparece em janeiro com o
-- preço de hoje. Quando o gateway entrar, a série passa a sair das faturas e
-- esta conta sai daqui — está isolada nesta CTE justamente por isso.
-- =============================================================================

create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- As três funções acima devolvem conjunto vazio para quem não é da
  -- plataforma, que é a falha fechada natural de um `returns table`. Esta
  -- devolve um escalar: filtrar por `where` a faria responder `null`, e `null`
  -- chega na tela como zero. Recusar em voz alta é a única forma honesta.
  if not public.is_platform_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001',
      detail = 'Somente o administrador da plataforma lê os números da plataforma.';
  end if;

  with meses as (
    select generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) as mes
  ),
  serie as (
    select
      m.mes,
      coalesce(sum(p.price_cents), 0)::bigint as valor,
      count(c.id)::integer as empresas
    from meses m
    left join public.companies c
      on c.created_at < m.mes + interval '1 month'
     and c.status <> 'canceled'
    left join public.plans p on p.id = c.plan_id
    group by m.mes
  )
  select jsonb_build_object(
    'activeCompanies', (select count(*) from public.companies where status = 'active'),
    'totalCompanies',  (select count(*) from public.companies),
    'newCompanies',    (select count(*) from public.companies
                         where created_at >= now() - interval '30 days'),
    -- Pessoas com acesso a alguma clínica. Não é "sessões nos últimos 7
    -- dias": sem tabela de sessões, esse número seria invenção.
    'users',           (select count(distinct user_id) from public.memberships),
    -- MRR conta assinatura ativa, não empresa ativa: quem está em trial ainda
    -- não paga, e somá-lo inflaria a receita recorrente.
    'mrrCents',        (select coalesce(sum(p.price_cents), 0)
                          from public.subscriptions s
                          join public.plans p on p.id = s.plan_id
                         where s.status = 'active'),
    'churnPct',        (
      -- Canceladas nos últimos 30 dias sobre o que havia no início da janela.
      -- Sem histórico de status, "cancelou" é a empresa cancelada cujo último
      -- toque foi dentro da janela.
      select case when base = 0 then 0
             else round((saidas::numeric / base) * 100, 1) end
        from (
          select
            (select count(*) from public.companies
              where created_at < now() - interval '30 days')::numeric as base,
            (select count(*) from public.companies
              where status = 'canceled'
                and updated_at >= now() - interval '30 days')::numeric as saidas
        ) t
    ),
    'openTickets',     (select count(*) from public.support_tickets where status = 'open'),
    'statusCounts',    (select jsonb_object_agg(status, n)
                          from (select status::text, count(*) as n
                                  from public.companies group by status) s),
    'mrrSeries',       (select jsonb_agg(jsonb_build_object(
                                'month', to_char(mes, 'YYYY-MM'),
                                'valueCents', valor,
                                'companies', empresas) order by mes)
                          from serie)
  )
  into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- PRIVILÉGIOS DAS FUNÇÕES
--
-- O PostgREST concede `execute` a todo mundo por padrão. Revogar e conceder
-- explicitamente é o mesmo cuidado do `0002`: uma função `security definer`
-- alcançável por `anon` devolveria a base inteira da plataforma para quem
-- abrisse o endereço do projeto.
-- =============================================================================

revoke execute on function public.platform_companies() from public;
revoke execute on function public.platform_users() from public;
revoke execute on function public.platform_logs(integer) from public;
revoke execute on function public.platform_overview() from public;
revoke execute on function public.user_display_name(auth.users) from public;

grant execute on function public.platform_companies() to authenticated;
grant execute on function public.platform_users() to authenticated;
grant execute on function public.platform_logs(integer) to authenticated;
grant execute on function public.platform_overview() to authenticated;
