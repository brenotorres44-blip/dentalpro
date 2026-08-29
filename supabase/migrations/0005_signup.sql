-- =============================================================================
-- PRODENT — 0005 · CADASTRO AUTÔNOMO
--
-- A RLS de `companies` só deixa administrador de plataforma inserir. Isso está
-- certo: se qualquer usuário autenticado pudesse criar empresa direto pela API,
-- um script criaria dez mil em um minuto.
--
-- Mas então quem acabou de se cadastrar não consegue criar a própria clínica.
-- A saída é esta função `security definer`: ela cria a empresa, as
-- configurações, os horários e o vínculo de dono numa transação só, com as
-- regras que a policy não consegue expressar.
--
-- É o padrão da decisão D5: invariante que a RLS não expressa vira função.
-- =============================================================================

/*
 * Slug a partir do nome.
 *
 * `translate` em vez da extensão `unaccent`: uma função imutável e sem
 * dependência externa, que roda igual em qualquer instância. "Clínica do Zé"
 * vira "clinica-do-ze".
 */
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      translate(
        lower(coalesce(p_text, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

/**
 * Cria a clínica e torna quem chamou o dono dela.
 *
 * Devolve o `company_id`. Erros são em português e com `errcode` próprio,
 * porque esta é a primeira coisa que um cliente novo faz no produto — falhar
 * aqui com jargão de banco seria perder a pessoa na porta.
 */
create or replace function public.create_company_and_owner(
  p_name      text,
  p_document  text default null,
  p_phone     text default null,
  p_city      text default null,
  p_state     text default null,
  p_email     text default null,
  -- O tema é escolhido no cadastro e pertence à empresa, não a quem criou.
  p_theme_id  text default 'clinic-clean'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := (select auth.uid());
  v_base    text;
  v_slug    text;
  v_suffix  integer := 1;
  v_company uuid;
begin
  if v_user is null then
    raise exception 'NAO_AUTENTICADO' using errcode = 'P0001',
      detail = 'É preciso estar autenticado para criar uma clínica.';
  end if;

  /*
   * A conta ainda existe?
   *
   * O JWT continua válido até expirar mesmo depois de o usuário ser apagado no
   * painel — cenário comum enquanto se testa o cadastro. Sem esta checagem, a
   * falha só apareceria lá na frente como violação de chave estrangeira em
   * `memberships`, uma mensagem de banco que não diz o que fazer.
   */
  if not exists (select 1 from auth.users u where u.id = v_user) then
    raise exception 'CONTA_REMOVIDA' using errcode = 'P0001',
      detail = 'Sua sessão aponta para uma conta que não existe mais. Saia e entre novamente.';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'NOME_INVALIDO' using errcode = 'P0001',
      detail = 'Informe o nome da clínica.';
  end if;

  -- Uma clínica por conta nesta fase. Múltiplas unidades são do plano
  -- Premium e precisam de um fluxo próprio, não do cadastro inicial.
  if exists (select 1 from public.memberships m where m.user_id = v_user) then
    raise exception 'JA_TEM_EMPRESA' using errcode = 'P0001',
      detail = 'Esta conta já está vinculada a uma clínica.';
  end if;

  -- Slug único. O sufixo numérico resolve homônimos sem pedir nada ao usuário,
  -- que nem sabe que slug existe no momento do cadastro.
  v_base := public.slugify(p_name);
  if v_base = '' then v_base := 'clinica'; end if;
  v_slug := v_base;

  while exists (select 1 from public.companies c where lower(c.slug) = v_slug)
     or exists (select 1 from public.reserved_slugs r where r.slug = v_slug)
  loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;

  insert into public.companies (
    slug, name, document, phone, email, city, state, status, plan_id, theme_id
  ) values (
    v_slug, btrim(p_name), nullif(btrim(coalesce(p_document, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''), nullif(upper(btrim(coalesce(p_state, ''))), ''),
    'trial', 'essencial', coalesce(nullif(btrim(p_theme_id), ''), 'clinic-clean')
  )
  returning id into v_company;

  insert into public.company_settings (company_id) values (v_company);

  -- Horário padrão: domingo fechado, sábado mais cedo. Um cadastro que nasce
  -- sem horário nenhum tem a agenda inteira bloqueada, e o usuário não teria
  -- como adivinhar o motivo.
  insert into public.business_hours (company_id, weekday, is_closed, opens_at, closes_at)
  select v_company, d.weekday, d.weekday = 0,
         case when d.weekday = 6 then '08:00'::time else '09:00'::time end,
         case when d.weekday = 6 then '19:00'::time else '20:00'::time end
    from generate_series(0, 6) as d(weekday);

  insert into public.memberships (user_id, company_id, role)
  values (v_user, v_company, 'owner');

  return v_company;
end;
$$;

revoke execute on function public.create_company_and_owner(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_company_and_owner(text, text, text, text, text, text, text) to authenticated;

grant execute on function public.slugify(text) to authenticated;
