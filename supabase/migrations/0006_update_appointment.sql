-- =============================================================================
-- PRODENT — 0006 · EDITAR ATENDIMENTO
--
-- `reschedule_appointment` move horário e profissional; `cancel_appointment`
-- encerra. Faltava o caso do meio: o formulário da agenda deixa trocar os
-- serviços, e trocar serviço muda preço e duração — logo muda `ends_at`, logo
-- muda o intervalo que a constraint de exclusão vigia.
--
-- Fazer isso do cliente exigiria três statements sem transação: apagar as
-- linhas filhas, inserir as novas e atualizar o total. Uma falha no meio
-- deixaria um atendimento com serviços de um preço e total de outro — e o preço
-- viria do catálogo do navegador, não de `service_price_for`, que é a conta que
-- vale. Por isso é função.
-- =============================================================================

create or replace function public.update_appointment(
  p_appointment   uuid,
  p_professional  uuid,
  p_client        uuid,
  p_services      uuid[],
  p_starts_at     timestamptz,
  p_status        appointment_status,
  p_payment       payment_method default null,
  p_notes         text default ''
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt      public.appointments%rowtype;
  v_error     text;
  v_duration  integer;
  v_total     bigint;
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'NAO_ENCONTRADO' using errcode = 'P0001',
      detail = 'O atendimento não existe mais.';
  end if;

  if not public.has_capability(v_appt.company_id, 'company.appointments.manage') then
    raise exception 'SEM_PERMISSAO' using errcode = 'P0001',
      detail = 'Você não tem permissão para alterar esta agenda.';
  end if;

  if array_length(p_services, 1) is null then
    raise exception 'SEM_SERVICO' using errcode = 'P0001',
      detail = 'Selecione ao menos um procedimento.';
  end if;

  if not exists (select 1 from public.clients
                  where id = p_client and company_id = v_appt.company_id) then
    raise exception 'CLIENTE_INVALIDO' using errcode = 'P0001',
      detail = 'O paciente não pertence a esta clínica.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional::text, 0));

  -- Passa o próprio id para que o atendimento não conflite consigo mesmo.
  v_error := public.validate_slot(
    v_appt.company_id, p_professional, p_services, p_starts_at, p_appointment
  );
  if v_error is not null then
    raise exception 'SLOT_INVALIDO' using errcode = 'P0001', detail = v_error;
  end if;

  v_duration := public.services_duration(p_services);

  select coalesce(sum(public.service_price_for(sid, p_professional)), 0)
    into v_total
    from unnest(p_services) as sid;

  update public.appointments
     set professional_id = p_professional,
         client_id       = p_client,
         starts_at       = p_starts_at,
         ends_at         = p_starts_at + make_interval(mins => v_duration),
         status          = p_status,
         price_cents     = v_total,
         payment_method  = p_payment,
         notes           = coalesce(p_notes, ''),
         updated_at      = now()
   where id = p_appointment
  returning * into v_appt;

  -- Substitui as linhas filhas por inteiro. São no máximo meia dúzia, e
  -- comparar o que mudou custaria mais do que reescrever — mesma razão pela
  -- qual `saveCompanySettings` troca os horários de funcionamento em bloco.
  delete from public.appointment_services where appointment_id = p_appointment;

  insert into public.appointment_services (appointment_id, service_id, price_cents, duration_min)
  select p_appointment, s.id, public.service_price_for(s.id, p_professional), s.duration_min
    from public.services s
   where s.id = any(p_services);

  return v_appt;

exception
  when exclusion_violation then
    raise exception 'SLOT_OCUPADO' using errcode = 'P0001',
      detail = 'Esse horário acabou de ser preenchido.';
end;
$$;

grant execute on function public.update_appointment(uuid, uuid, uuid, uuid[], timestamptz, appointment_status, payment_method, text) to authenticated;
