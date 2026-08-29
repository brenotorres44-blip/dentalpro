-- =============================================================================
-- PRODENT — 0001 · SCHEMA
--
-- Multi-tenant por `company_id`. Toda tabela de negócio carrega a coluna, e
-- todo índice começa por ela — é o que faz a RLS ser barata em vez de varrer
-- a tabela inteira a cada consulta.
--
-- Dinheiro é sempre `bigint` em centavos. Nunca float: 0.1 + 0.2 não é 0.3, e
-- um centavo perdido por atendimento vira divergência no fechamento do mês.
--
-- Rodar no SQL Editor do Supabase, em ordem: 0001 → 0002 → ... → 0007.
-- =============================================================================

create extension if not exists btree_gist;

-- =============================================================================
-- ENUMS
-- Espelham os tipos de `src/data/types.ts`. Os valores são os mesmos strings
-- que o frontend já usa, para o TypeScript gerado bater sem tradução no meio.
-- =============================================================================

create type company_role as enum ('owner', 'manager', 'professional', 'attendant');
create type company_status as enum ('active', 'trial', 'suspended', 'canceled');

create type appointment_status as enum (
  'agendado', 'em_andamento', 'concluido', 'cancelado', 'falta'
);

create type payment_method as enum ('dinheiro', 'pix', 'debito', 'credito');
create type service_category as enum ('avaliacao', 'preventivo', 'restaurador', 'estetico', 'cirurgico', 'combo');
create type product_category as enum ('descartavel', 'material', 'medicamento', 'instrumental', 'protecao');
create type movement_kind as enum ('entrada', 'venda', 'consumo', 'perda', 'ajuste');
create type cash_direction as enum ('entrada', 'saida');
create type work_shift as enum ('manha', 'tarde', 'noite');

create type cash_category as enum (
  'servico', 'produto', 'comissao', 'aluguel', 'insumo',
  'salario', 'marketing', 'imposto', 'manutencao', 'outro'
);

-- =============================================================================
-- UTILITÁRIOS
-- =============================================================================

-- `updated_at` mantido por trigger, não pela aplicação: aplicação esquece.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- PLANOS E EMPRESAS
-- =============================================================================

create table public.plans (
  id            text primary key,
  name          text not null,
  price_cents   bigint not null check (price_cents >= 0),
  -- Limites do plano. `null` = ilimitado; 0 seria "nenhum", que é diferente.
  max_users     integer,
  max_professionals integer,
  max_appointments_month integer,
  features      text[] not null default '{}',
  is_public     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  name          text not null,
  document      text,
  email         text,
  phone         text,
  status        company_status not null default 'trial',
  plan_id       text not null references public.plans(id),

  -- Endereço
  street        text,
  number        text,
  district      text,
  city          text,
  state         char(2),
  zip           text,

  -- O fuso é da clínica, não do servidor nem do navegador de quem olha.
  -- Sem isso, uma agenda de Rio Branco exibida em São Paulo desloca 2 horas.
  timezone      text not null default 'America/Sao_Paulo',

  theme_id      text not null default 'clinic-clean',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint companies_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

-- Slug é a chave pública da clínica (`prodent.app/<slug>`): case-insensitive.
create unique index companies_slug_key on public.companies (lower(slug));

create trigger companies_touch
  before update on public.companies
  for each row execute function public.touch_updated_at();

-- Reservados: colidiriam com rotas do próprio produto.
create table public.reserved_slugs (slug text primary key);

insert into public.reserved_slugs (slug) values
  ('app'), ('api'), ('www'), ('admin'), ('blog'), ('ajuda'), ('precos'),
  ('login'), ('signup'), ('cadastro'), ('checkout'), ('assets'), ('static'),
  ('cdn'), ('status'), ('suporte'), ('conta'), ('painel');

create or replace function public.reject_reserved_slug()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.reserved_slugs r where r.slug = lower(new.slug)) then
    raise exception 'SLUG_RESERVADO' using errcode = 'P0001',
      detail = format('O endereço "%s" é reservado pelo sistema.', new.slug);
  end if;
  return new;
end;
$$;

create trigger companies_reject_reserved_slug
  before insert or update of slug on public.companies
  for each row execute function public.reject_reserved_slug();

-- Regras de agendamento e notificação. Tabela 1:1 para não inchar `companies`,
-- que é lida em toda resolução de tenant.
create table public.company_settings (
  company_id            uuid primary key references public.companies(id) on delete cascade,

  slot_minutes          integer not null default 30 check (slot_minutes between 5 and 120),
  min_advance_hours     integer not null default 2  check (min_advance_hours >= 0),
  max_advance_days      integer not null default 60 check (max_advance_days >= 1),
  cancel_window_hours   integer not null default 4  check (cancel_window_hours >= 0),
  allow_overbooking     boolean not null default false,
  no_show_fee_pct       numeric(5,2) not null default 0 check (no_show_fee_pct between 0 and 100),

  email_confirmation    boolean not null default true,
  email_reminder        boolean not null default true,
  whatsapp_confirmation boolean not null default false,
  whatsapp_reminder     boolean not null default false,
  reminder_hours_before integer not null default 24 check (reminder_hours_before between 1 and 72),
  marketing_opt_in      boolean not null default false,

  updated_at            timestamptz not null default now()
);

create trigger company_settings_touch
  before update on public.company_settings
  for each row execute function public.touch_updated_at();

-- Horário de funcionamento. Uma linha por dia da semana (0 = domingo).
create table public.business_hours (
  company_id  uuid not null references public.companies(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  is_closed   boolean not null default false,
  opens_at    time not null default '09:00',
  closes_at   time not null default '20:00',
  primary key (company_id, weekday),
  -- Fechado não zera o horário: preserva o que estava configurado para quando
  -- o dia voltar a abrir.
  constraint business_hours_order check (is_closed or closes_at > opens_at)
);

create table public.holidays (
  company_id  uuid not null references public.companies(id) on delete cascade,
  date        date not null,
  reason      text not null default '',
  primary key (company_id, date)
);

-- =============================================================================
-- ACESSO
-- =============================================================================

-- Quem administra a plataforma. Fora de `memberships` de propósito: poder de
-- plataforma não é um papel dentro de uma empresa.
create table public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        company_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, company_id)
);

create index memberships_company_idx on public.memberships (company_id, role);
create index memberships_user_idx on public.memberships (user_id);

-- =============================================================================
-- EQUIPE
-- =============================================================================

create table public.professionals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- Nem todo profissional tem login. O barbeiro que não usa o sistema existe
  -- na agenda do mesmo jeito.
  user_id       uuid references auth.users(id) on delete set null,

  name          text not null check (length(btrim(name)) >= 2),
  role          text not null default 'Barbeiro',
  email         text,
  phone         text,
  hired_at      date,
  is_active     boolean not null default true,
  rating        numeric(2,1) not null default 5 check (rating between 0 and 5),
  hue           smallint not null default 190 check (hue between 0 and 360),

  service_commission_pct numeric(5,2) not null default 40 check (service_commission_pct between 0 and 100),
  product_commission_pct numeric(5,2) not null default 8  check (product_commission_pct between 0 and 100),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index professionals_company_idx on public.professionals (company_id, is_active);

create trigger professionals_touch
  before update on public.professionals
  for each row execute function public.touch_updated_at();

-- Jornada semanal. Ausência de linha = folga naquele dia.
create table public.professional_schedules (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  starts_at       time not null,
  ends_at         time not null,
  break_start     time,
  break_end       time,
  primary key (professional_id, weekday),
  constraint schedule_order check (ends_at > starts_at),
  constraint break_pair check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  )
);

-- =============================================================================
-- CATÁLOGO
-- =============================================================================

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  name          text not null check (length(btrim(name)) >= 2),
  description   text not null default '',
  category      service_category not null default 'avaliacao',
  price_cents   bigint not null check (price_cents >= 0),
  duration_min  integer not null check (duration_min between 5 and 480),
  -- Preparo depois do atendimento: ocupa a agenda, não é cobrado.
  buffer_min    integer not null default 0 check (buffer_min between 0 and 120),
  -- Desativar preserva o histórico; excluir deixaria atendimentos órfãos.
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index services_company_idx on public.services (company_id, is_active);

create trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

-- Tabela própria por profissional. Ausência = cobra o preço base.
create table public.service_prices (
  service_id      uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  price_cents     bigint not null check (price_cents >= 0),
  primary key (service_id, professional_id)
);

-- Composição de combo.
create table public.service_components (
  combo_id      uuid not null references public.services(id) on delete cascade,
  component_id  uuid not null references public.services(id) on delete cascade,
  primary key (combo_id, component_id),
  constraint combo_not_self check (combo_id <> component_id)
);

-- Quais serviços o profissional executa. Nenhuma linha = executa todos, que é
-- o caso comum — obrigar a marcar oito itens no cadastro só geraria omissão.
create table public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  primary key (professional_id, service_id)
);

-- =============================================================================
-- CLIENTES
-- =============================================================================

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  name          text not null check (length(btrim(name)) >= 2),
  phone         text,
  email         text,
  birth_date    date,
  tags          text[] not null default '{}',
  notes         text not null default '',
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index clients_company_idx on public.clients (company_id, is_active);
-- Busca por telefone é como o balcão encontra alguém no atendimento.
create index clients_phone_idx on public.clients (company_id, phone);
create index clients_name_idx on public.clients (company_id, lower(name));

create trigger clients_touch
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- AGENDA
-- =============================================================================

create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  client_id       uuid not null references public.clients(id) on delete restrict,

  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  -- Intervalo semiaberto: um atendimento que acaba 15:00 e outro que começa
  -- 15:00 não se sobrepõem. Com '[]' o Postgres barraria agendas coladas.
  slot            tstzrange generated always as
                    (tstzrange(starts_at, ends_at, '[)')) stored,

  status          appointment_status not null default 'agendado',
  -- Preço praticado, congelado no ato. Mudar a tabela amanhã não pode
  -- reescrever o faturamento de ontem.
  price_cents     bigint not null check (price_cents >= 0),
  payment_method  payment_method,
  notes           text not null default '',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint appointments_order check (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- A rede de segurança contra double-booking.
--
-- Realtime não previne conflito: é notificação pós-commit, e dois clientes
-- clicando no mesmo horário com 200ms de diferença passam ambos por qualquer
-- checagem feita na aplicação. Aqui é fisicamente impossível o Postgres aceitar
-- dois atendimentos sobrepostos para o mesmo profissional.
--
-- Cancelado e falta ficam de fora: o horário volta a ficar livre para remarcar.
-- ---------------------------------------------------------------------------
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    slot with &&
  ) where (status in ('agendado', 'em_andamento', 'concluido'));

create index appointments_company_starts_idx
  on public.appointments (company_id, starts_at desc);
create index appointments_professional_starts_idx
  on public.appointments (company_id, professional_id, starts_at desc);
create index appointments_client_idx
  on public.appointments (company_id, client_id, starts_at desc);

create trigger appointments_touch
  before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Serviços do atendimento, com o preço e a duração praticados no dia.
create table public.appointment_services (
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete restrict,
  price_cents     bigint not null check (price_cents >= 0),
  duration_min    integer not null check (duration_min > 0),
  primary key (appointment_id, service_id)
);

create table public.schedule_blocks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  -- `null` bloqueia a clínica inteira.
  professional_id uuid references public.professionals(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text not null default '',
  created_at      timestamptz not null default now(),
  constraint blocks_order check (ends_at > starts_at)
);

create index schedule_blocks_company_idx
  on public.schedule_blocks (company_id, starts_at desc);

create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  -- `null` = aceita qualquer profissional.
  professional_id uuid references public.professionals(id) on delete set null,
  service_ids     uuid[] not null default '{}',
  from_date       date not null,
  to_date         date not null,
  day_window      work_shift,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  constraint waitlist_range check (to_date >= from_date)
);

create index waitlist_company_idx on public.waitlist (company_id, from_date);

-- =============================================================================
-- ESTOQUE
-- =============================================================================

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  name          text not null check (length(btrim(name)) >= 2),
  brand         text not null default '',
  sku           text not null default '',
  category      product_category not null default 'descartavel',

  -- Saldo é consequência das movimentações, mantido por trigger. Corrigir na
  -- mão esconderia a diferença — e é a diferença que revela furto e quebra.
  qty           integer not null default 0 check (qty >= 0),
  min_qty       integer not null default 0 check (min_qty >= 0),
  capacity      integer not null default 1 check (capacity > 0),
  unit          text not null default 'un.',

  cost_cents    bigint not null default 0 check (cost_cents >= 0),
  -- Zero = uso interno, não vendido ao cliente.
  price_cents   bigint not null default 0 check (price_cents >= 0),
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index products_company_idx on public.products (company_id, is_active);

create trigger products_touch
  before update on public.products
  for each row execute function public.touch_updated_at();

create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,

  kind            movement_kind not null,
  qty             integer not null check (qty > 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0),
  occurred_on     date not null default current_date,
  note            text not null default '',
  created_at      timestamptz not null default now()
);

create index stock_movements_product_idx
  on public.stock_movements (company_id, product_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Saldo e custo médio como consequência do movimento.
--
-- Na entrada o custo é reponderado pelo volume: sem isso, comprar 10 unidades
-- mais caras não moveria o custo, e a margem exibida ficaria otimista até o
-- estoque antigo acabar.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_next_qty integer;
  v_next_cost bigint;
begin
  select * into v_product from public.products where id = new.product_id for update;

  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if v_product.company_id <> new.company_id then
    raise exception 'EMPRESA_DIVERGENTE' using errcode = 'P0001',
      detail = 'O produto pertence a outra empresa.';
  end if;

  v_next_qty := case new.kind
    when 'entrada' then v_product.qty + new.qty
    when 'ajuste'  then new.qty          -- define o saldo em vez de somar
    else v_product.qty - new.qty
  end;

  if v_next_qty < 0 then
    raise exception 'SALDO_INSUFICIENTE' using errcode = 'P0001',
      detail = format('Há %s %s em estoque.', v_product.qty, v_product.unit);
  end if;

  v_next_cost := v_product.cost_cents;
  if new.kind = 'entrada' and (v_product.qty + new.qty) > 0 then
    v_next_cost := round(
      (v_product.qty * v_product.cost_cents + new.qty * new.unit_cost_cents)::numeric
      / (v_product.qty + new.qty)
    );
  end if;

  update public.products
     set qty = v_next_qty, cost_cents = v_next_cost
   where id = new.product_id;

  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- =============================================================================
-- CAIXA
--
-- Só o que NÃO deriva da operação. Receita de serviço sai da agenda, receita de
-- produto sai das movimentações, comissão sai do desempenho — lançar essas três
-- aqui criaria duas fontes para o mesmo número, e elas divergiriam.
-- =============================================================================

create table public.cash_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,

  occurred_on     date not null default current_date,
  direction       cash_direction not null,
  category        cash_category not null default 'outro',
  description     text not null check (length(btrim(description)) >= 3),
  amount_cents    bigint not null check (amount_cents > 0),
  method          payment_method not null default 'pix',
  shift           work_shift not null default 'manha',

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index cash_entries_company_idx
  on public.cash_entries (company_id, occurred_on desc);

create table public.cash_closings (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  occurred_on     date not null,
  shift           work_shift not null,
  expected_cents  bigint not null,
  counted_cents   bigint not null check (counted_cents >= 0),
  note            text not null default '',
  closed_by       uuid references auth.users(id) on delete set null,
  closed_at       timestamptz not null default now(),
  -- Um fechamento por turno por dia: o segundo é correção, não novo registro.
  unique (company_id, occurred_on, shift)
);

-- =============================================================================
-- ASSINATURAS
-- =============================================================================

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null unique references public.companies(id) on delete cascade,
  plan_id               text not null references public.plans(id),
  status                text not null default 'trialing',
  gateway               text not null default 'stripe',
  -- Identificadores do gateway. A liberação de acesso vem do webhook, nunca do
  -- retorno do checkout, que é manipulável pelo cliente.
  external_customer_id  text,
  external_subscription_id text,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- AUDITORIA
-- Por trigger, não por chamada da aplicação: a aplicação esquece.
-- =============================================================================

create table public.audit_log (
  id          bigserial primary key,
  company_id  uuid,
  actor_id    uuid,
  table_name  text not null,
  operation   text not null,
  record_id   uuid,
  changes     jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_log_company_idx on public.audit_log (company_id, occurred_at desc);

create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record jsonb;
begin
  v_record := to_jsonb(coalesce(new, old));

  insert into public.audit_log (company_id, actor_id, table_name, operation, record_id, changes)
  values (
    nullif(v_record ->> 'company_id', '')::uuid,
    auth.uid(),
    tg_table_name,
    tg_op,
    nullif(v_record ->> 'id', '')::uuid,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
      else v_record
    end
  );

  return coalesce(new, old);
end;
$$;

-- Auditar o que tem consequência financeira ou de acesso. Auditar tudo faria a
-- tabela crescer mais rápido que o próprio negócio.
create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.write_audit();

create trigger memberships_audit
  after insert or update or delete on public.memberships
  for each row execute function public.write_audit();

create trigger cash_entries_audit
  after insert or update or delete on public.cash_entries
  for each row execute function public.write_audit();

create trigger services_audit
  after update or delete on public.services
  for each row execute function public.write_audit();
