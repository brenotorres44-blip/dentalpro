-- =============================================================================
-- PRODENT — 0003 · FUNÇÕES
--
-- Regra: se a operação tem uma invariante que a RLS sozinha não expressa, ela
-- vira função. Agendar é o caso clássico — "não pode haver dois no mesmo
-- horário" não é uma condição sobre a linha sendo escrita, é uma condição sobre
-- as outras linhas.
--
-- Disponibilidade também é do servidor. Se o cliente calculasse os horários
-- livres a partir de regras locais, cada bug de fuso viraria um agendamento
-- fantasma — e o fuso do navegador de quem olha não é o da clínica.
-- =============================================================================

-- =============================================================================
-- APOIO
-- =============================================================================

/*
 * Preço praticado: tabela do profissional quando existe, preço de balcão quando
 * não. Uma função só, para o orçamento na tela e o valor gravado no banco não
 * saírem de duas contas diferentes.
 */
create or replace function public.service_price_for(
  p_service uuid,
  p_professional uuid
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select sp.price_cents
       from public.service_prices sp
      where sp.service_id = p_service
        and sp.professional_id = p_professional),
    (select s.price_cents from public.services s where s.id = p_service)
  );
$$;

/*
 * Duração total do atendimento.
 *
 * As durações somam; o preparo, não. Dois serviços seguidos usam a mesma
 * higienização no fim — cobrar o buffer duas vezes inflaria a agenda e
 * derrubaria artificialmente a taxa de ocupação.
 */
create or replace function public.services_duration(p_services uuid[])
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(s.duration_min), 0)::integer
       + coalesce(max(s.buffer_min), 0)::integer
    from public.services s
   where s.id = any(p_services);
$$;

-- =============================================================================
-- VALIDAÇÃO
--
-- Devolve o motivo da recusa, ou `null` se o horário está livre. É a mesma
-- lista de `validateSlot()` no frontend — lá é conveniência de UX, aqui é a
-- barreira. As duas existem de propósito: a de cima evita a ida ao servidor,
-- a de baixo é a que vale.
-- =============================================================================

create or replace function public.validate_slot(
  p_company       uuid,
  p_professional  uuid,
  p_services      uuid[],
  p_starts_at     timestamptz,
  p_ignore        uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings   public.company_settings%rowtype;
  v_company    public.companies%rowtype;
  v_pro        public.professionals%rowtype;
  v_hours      public.business_hours%rowtype;
  v_duration   integer;
  v_ends_at    timestamptz;
  v_local      timestamp;      -- o mesmo instante, no fuso da clínica
  v_local_end  timestamp;
  v_weekday    smallint;
  v_sched      public.professional_schedules%rowtype;
  v_clash      record;
  v_missing    text;
begin
  select * into v_company from public.companies where id = p_company;
  if not found then return 'Empresa não encontrada.'; end if;

  select * into v_settings from public.company_settings where company_id = p_company;

  if coalesce(array_length(p_services, 1), 0) = 0 then
    return 'Selecione ao menos um procedimento.';
  end if;

  select * into v_pro from public.professionals
   where id = p_professional and company_id = p_company;
  if not found then return 'Profissional não encontrado.'; end if;
  if not v_pro.is_active then
    return format('%s está inativo na equipe.', v_pro.name);
  end if;

  -- Serviço desativado ou de outra empresa.
  select s.name into v_missing
    from unnest(p_services) as sid
    left join public.services s on s.id = sid and s.company_id = p_company
   where s.id is null or not s.is_active
   limit 1;
  if found then
    return coalesce(
      format('%s está desativado no catálogo.', v_missing),
      'Serviço inválido para esta clínica.'
    );
  end if;

  -- Serviço que este profissional não executa. Nenhuma linha em
  -- professional_services significa "executa todos", que é o caso comum.
  if exists (select 1 from public.professional_services where professional_id = p_professional) then
    select s.name into v_missing
      from unnest(p_services) as sid
      join public.services s on s.id = sid
     where not exists (
       select 1 from public.professional_services ps
        where ps.professional_id = p_professional and ps.service_id = sid)
     limit 1;
    if found then
      return format('%s não executa %s.', split_part(v_pro.name, ' ', 1), v_missing);
    end if;
  end if;

  v_duration := public.services_duration(p_services);
  v_ends_at  := p_starts_at + make_interval(mins => v_duration);

  v_local     := p_starts_at at time zone v_company.timezone;
  v_local_end := v_ends_at   at time zone v_company.timezone;
  v_weekday   := extract(dow from v_local)::smallint;

  -- Funcionamento
  select * into v_hours from public.business_hours
   where company_id = p_company and weekday = v_weekday;
  if not found or v_hours.is_closed then
    return 'A clínica não abre nesse dia.';
  end if;
  if v_local::time < v_hours.opens_at or v_local_end::time > v_hours.closes_at then
    return format('Fora do horário de funcionamento (%s às %s).',
                  to_char(v_hours.opens_at, 'HH24:MI'), to_char(v_hours.closes_at, 'HH24:MI'));
  end if;

  if exists (select 1 from public.holidays h
              where h.company_id = p_company and h.date = v_local::date) then
    return 'A data está marcada como feriado.';
  end if;

  -- Jornada do profissional
  select * into v_sched from public.professional_schedules
   where professional_id = p_professional and weekday = v_weekday;
  if not found then
    return format('%s folga nesse dia.', split_part(v_pro.name, ' ', 1));
  end if;
  if v_local::time < v_sched.starts_at or v_local_end::time > v_sched.ends_at then
    return format('Fora da jornada de %s nesse dia.', split_part(v_pro.name, ' ', 1));
  end if;
  if v_sched.break_start is not null
     and v_local::time < v_sched.break_end
     and v_sched.break_start < v_local_end::time then
    return format('%s está em intervalo nesse horário.', split_part(v_pro.name, ' ', 1));
  end if;

  -- Antecedência. Só vale para o futuro: lançar um atendimento de ontem no
  -- sistema é registro, não agendamento.
  if v_settings.company_id is not null and p_starts_at > now() then
    if p_starts_at < now() + make_interval(hours => v_settings.min_advance_hours) then
      return format('É preciso agendar com %s hora(s) de antecedência.',
                    v_settings.min_advance_hours);
    end if;
    if p_starts_at > now() + make_interval(days => v_settings.max_advance_days) then
      return format('A agenda só abre com %s dias de antecedência.',
                    v_settings.max_advance_days);
    end if;
  end if;

  -- Bloqueios
  select * into v_clash from public.schedule_blocks b
   where b.company_id = p_company
     and (b.professional_id is null or b.professional_id = p_professional)
     and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
   limit 1;
  if found then
    return format('Conflito com bloqueio: %s.',
                  coalesce(nullif(v_clash.reason, ''), 'horário indisponível'));
  end if;

  -- Outro atendimento
  if not coalesce(v_settings.allow_overbooking, false) then
    select a.starts_at, c.name into v_clash
      from public.appointments a
      join public.clients c on c.id = a.client_id
     where a.professional_id = p_professional
       and a.status in ('agendado', 'em_andamento', 'concluido')
       and (p_ignore is null or a.id <> p_ignore)
       and a.slot && tstzrange(p_starts_at, v_ends_at, '[)')
     limit 1;
    if found then
      return format('%s já atende %s às %s.',
                    split_part(v_pro.name, ' ', 1),
                    v_clash.name,
                    to_char(v_clash.starts_at at time zone v_company.timezone, 'HH24:MI'));
    end if;
  end if;

  return null;
end;
$$;

-- =============================================================================
-- AGENDAR
-- =============================================================================

/*
 * O `pg_advisory_xact_lock` serializa por profissional.
 *
 * Sem ele, duas transações simultâneas passam pela validação antes de qualquer
 * uma inserir, e a segunda só é barrada pela constraint — o que funciona, mas
 * devolve um erro de banco cru. Com o lock, a segunda espera, revalida e recebe
 * a mensagem em português. A constraint continua ali como rede definitiva: o
 * lock é conveniência, não é a garantia.
 */
create or replace function public.book_appointment(
  p_company       uuid,
  p_professional  uuid,
  p_client        uuid,
  p_services      uuid[],
  p_starts_at     timestamptz,
  p_status        appointment_status default 'agendado',
  p_payment       payment_method default null,
  p_notes         text default ''
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_error     text;
  v_duration  integer;
  v_total     bigint;
  v_appt      public.appointments%rowtype;
begin
  if not public.has_capability(p_company, 'company.appointments.manage') then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001',
      detail = 'Você não tem permissão para agendar nesta clínica.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional::text, 0));

  v_error := public.validate_slot(p_company, p_professional, p_services, p_starts_at);
  if v_error is not null then
    raise exception 'SLOT_INVALIDO' using errcode = 'P0001', detail = v_error;
  end if;

  if not exists (select 1 from public.clients
                  where id = p_client and company_id = p_company) then
    raise exception 'CLIENTE_INVALIDO' using errcode = 'P0001',
      detail = 'O paciente não pertence a esta clínica.';
  end if;

  v_duration := public.services_duration(p_services);

  select coalesce(sum(public.service_price_for(sid, p_professional)), 0)
    into v_total
    from unnest(p_services) as sid;

  insert into public.appointments (
    company_id, professional_id, client_id,
    starts_at, ends_at, status, price_cents, payment_method, notes
  ) values (
    p_company, p_professional, p_client,
    p_starts_at, p_starts_at + make_interval(mins => v_duration),
    p_status, v_total, p_payment, coalesce(p_notes, '')
  )
  returning * into v_appt;

  -- Congela preço e duração de cada serviço no ato.
  insert into public.appointment_services (appointment_id, service_id, price_cents, duration_min)
  select v_appt.id, s.id, public.service_price_for(s.id, p_professional), s.duration_min
    from public.services s
   where s.id = any(p_services);

  return v_appt;

exception
  when exclusion_violation then
    -- A constraint pegou o que o lock não pegou. Acontece se dois nós
    -- escreverem sem passar por esta função.
    raise exception 'SLOT_OCUPADO' using errcode = 'P0001',
      detail = 'Esse horário acabou de ser preenchido.';
end;
$$;

-- =============================================================================
-- REMARCAR
-- =============================================================================

create or replace function public.reschedule_appointment(
  p_appointment   uuid,
  p_professional  uuid,
  p_starts_at     timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt      public.appointments%rowtype;
  v_services  uuid[];
  v_error     text;
  v_duration  integer;
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not public.has_capability(v_appt.company_id, 'company.appointments.manage') then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  -- Concluído não remarca: reescrever o que já aconteceu mudaria o faturamento
  -- de um dia fechado.
  if v_appt.status = 'concluido' then
    raise exception 'JA_CONCLUIDO' using errcode = 'P0001',
      detail = 'Atendimento concluído não pode ser remarcado.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional::text, 0));

  select array_agg(service_id) into v_services
    from public.appointment_services where appointment_id = p_appointment;

  v_error := public.validate_slot(
    v_appt.company_id, p_professional, v_services, p_starts_at, p_appointment
  );
  if v_error is not null then
    raise exception 'SLOT_INVALIDO' using errcode = 'P0001', detail = v_error;
  end if;

  v_duration := public.services_duration(v_services);

  update public.appointments
     set professional_id = p_professional,
         starts_at = p_starts_at,
         ends_at = p_starts_at + make_interval(mins => v_duration)
   where id = p_appointment
  returning * into v_appt;

  return v_appt;

exception
  when exclusion_violation then
    raise exception 'SLOT_OCUPADO' using errcode = 'P0001',
      detail = 'Esse horário acabou de ser preenchido.';
end;
$$;

-- =============================================================================
-- CANCELAR
-- =============================================================================

create or replace function public.cancel_appointment(
  p_appointment uuid,
  p_reason      text default ''
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt     public.appointments%rowtype;
  v_settings public.company_settings%rowtype;
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  if not public.has_capability(v_appt.company_id, 'company.appointments.manage') then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001';
  end if;

  select * into v_settings from public.company_settings
   where company_id = v_appt.company_id;

  -- A janela de cancelamento vale para o futuro. Cancelar um horário que já
  -- passou é acerto de registro, e travar isso deixaria o histórico errado
  -- para sempre.
  if v_appt.starts_at > now()
     and v_appt.starts_at < now() + make_interval(hours => coalesce(v_settings.cancel_window_hours, 0))
     and not public.has_capability(v_appt.company_id, 'company.settings.manage') then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001',
      detail = format('O cancelamento exige %s hora(s) de antecedência.',
                      v_settings.cancel_window_hours);
  end if;

  update public.appointments
     set status = 'cancelado',
         notes = case when coalesce(p_reason, '') = '' then notes
                      else btrim(notes || E'\n' || p_reason) end
   where id = p_appointment
  returning * into v_appt;

  return v_appt;
end;
$$;

-- =============================================================================
-- HORÁRIOS LIVRES
--
-- Percorre a grade do dia no fuso da clínica e devolve só o que passa em
-- `validate_slot`. Uma fonte de verdade: o que a página pública oferece é
-- exatamente o que o banco aceitaria.
-- =============================================================================

create or replace function public.get_available_slots(
  p_company       uuid,
  p_professional  uuid,
  p_services      uuid[],
  p_date          date
)
returns table (starts_at timestamptz, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company  public.companies%rowtype;
  v_step     integer;
  v_hours    public.business_hours%rowtype;
  v_weekday  smallint;
  v_cursor   timestamp;
  v_limit    timestamp;
  v_abs      timestamptz;
begin
  select * into v_company from public.companies where id = p_company;
  if not found then return; end if;

  select coalesce(cs.slot_minutes, 30) into v_step
    from public.company_settings cs where cs.company_id = p_company;
  v_step := coalesce(v_step, 30);

  v_weekday := extract(dow from p_date)::smallint;

  select * into v_hours from public.business_hours
   where company_id = p_company and weekday = v_weekday;
  if not found or v_hours.is_closed then return; end if;

  v_cursor := p_date + v_hours.opens_at;
  v_limit  := p_date + v_hours.closes_at;

  while v_cursor < v_limit loop
    v_abs := v_cursor at time zone v_company.timezone;

    starts_at := v_abs;
    reason := public.validate_slot(p_company, p_professional, p_services, v_abs);
    return next;

    v_cursor := v_cursor + make_interval(mins => v_step);
  end loop;
end;
$$;

-- =============================================================================
-- LEITURA PÚBLICA
--
-- `anon` não lê tabela nenhuma (0002). O que a página da clínica mostra sai
-- daqui, com os campos escolhidos a dedo. Sem isso, um concorrente varreria a
-- base de clientes de todas as clínicas com uma requisição.
-- =============================================================================

create or replace function public.public_company(p_slug text)
returns table (
  id uuid, slug text, name text, theme_id text, timezone text,
  phone text, street text, number text, district text,
  city text, state char(2), status company_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.slug, c.name, c.theme_id, c.timezone,
         c.phone, c.street, c.number, c.district, c.city, c.state, c.status
    from public.companies c
   where lower(c.slug) = lower(p_slug)
     and c.status in ('active', 'trial');
$$;

create or replace function public.public_services(p_company uuid)
returns table (
  id uuid, name text, description text, category service_category,
  price_cents bigint, duration_min integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.description, s.category, s.price_cents, s.duration_min
    from public.services s
   where s.company_id = p_company and s.is_active
   order by s.name;
$$;

create or replace function public.public_professionals(p_company uuid)
returns table (id uuid, name text, role text, rating numeric, hue smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.role, p.rating, p.hue
    from public.professionals p
   where p.company_id = p_company and p.is_active
   order by p.name;
$$;

grant execute on function public.public_company(text) to anon, authenticated;
grant execute on function public.public_services(uuid) to anon, authenticated;
grant execute on function public.public_professionals(uuid) to anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, uuid[], date) to anon, authenticated;

grant execute on function public.book_appointment(uuid, uuid, uuid, uuid[], timestamptz, appointment_status, payment_method, text) to authenticated;
grant execute on function public.reschedule_appointment(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;
grant execute on function public.validate_slot(uuid, uuid, uuid[], timestamptz, uuid) to authenticated;

-- O agendamento pelo cliente final entra por Edge Function (Turnstile, rate
-- limit, checagem de plano) e só então chama `book_appointment` com
-- `service_role`. Por isso `anon` não recebe execute aqui.
