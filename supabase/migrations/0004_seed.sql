-- =============================================================================
-- PRODENT — 0004 · SEED
--
-- Duas partes com naturezas diferentes:
--
-- 1. **Configuração do produto** — planos e a matriz de permissões. Isto não é
--    demonstração: sem `role_capabilities` a RLS nega tudo, porque
--    `has_capability` não encontra linha nenhuma.
--
-- 2. **Clínica de demonstração** — dá o que olhar antes de existir dado real.
--    Pode ser apagada com o bloco do fim do arquivo.
--
-- Os UUIDs são fixos de propósito: rodar de novo não duplica, e dá para
-- inspecionar no painel sem procurar id.
-- =============================================================================

-- =============================================================================
-- PLANOS
-- =============================================================================

insert into public.plans (id, name, price_cents, max_users, max_professionals, max_appointments_month, features, sort_order)
values
  ('essencial', 'Essencial',  9900, 3,  3,   400,
   array['Agenda completa', 'Cadastro de pacientes', 'Controle de caixa'], 1),
  ('profissional', 'Profissional', 19900, 10, 10, 2000,
   array['Tudo do Essencial', 'Relatórios e comissões', 'Itens de consultório', 'Página pública'], 2),
  ('premium', 'Premium',      39900, null, null, null,
   array['Tudo do Profissional', 'Domínio próprio', 'Múltiplos consultórios', 'Suporte prioritário'], 3)
on conflict (id) do nothing;

-- =============================================================================
-- MATRIZ DE PERMISSÕES
--
-- Espelho exato de `src/config/permissions.ts`. As duas listas precisam andar
-- juntas: o frontend usa a matriz para montar o menu, o banco usa para decidir
-- o acesso. Se divergirem, aparece o pior tipo de bug — o menu mostra a opção e
-- a tela abre vazia.
-- =============================================================================

delete from public.role_capabilities;

insert into public.role_capabilities (role, capability) values
  -- OWNER: tudo dentro da própria clínica.
  ('owner', 'company.dashboard.view'),
  ('owner', 'company.appointments.view'),
  ('owner', 'company.appointments.manage'),
  ('owner', 'company.clients.view'),
  ('owner', 'company.clients.manage'),
  ('owner', 'company.services.view'),
  ('owner', 'company.services.manage'),
  ('owner', 'company.professionals.view'),
  ('owner', 'company.professionals.manage'),
  ('owner', 'company.financial.view'),
  ('owner', 'company.financial.manage'),
  ('owner', 'company.products.view'),
  ('owner', 'company.products.manage'),
  ('owner', 'company.reports.view'),
  ('owner', 'company.settings.manage'),
  ('owner', 'company.theme.manage'),

  -- MANAGER: opera tudo, menos configurar a clínica e trocar o tema.
  ('manager', 'company.dashboard.view'),
  ('manager', 'company.appointments.view'),
  ('manager', 'company.appointments.manage'),
  ('manager', 'company.clients.view'),
  ('manager', 'company.clients.manage'),
  ('manager', 'company.services.view'),
  ('manager', 'company.services.manage'),
  ('manager', 'company.professionals.view'),
  ('manager', 'company.professionals.manage'),
  ('manager', 'company.financial.view'),
  ('manager', 'company.financial.manage'),
  ('manager', 'company.products.view'),
  ('manager', 'company.products.manage'),
  ('manager', 'company.reports.view'),

  -- ATTENDANT: a recepção. Marca, atende e cobra; lê catálogo e itens porque a
  -- agenda e o painel os exibem. Não mexe em preço, equipe nem caixa.
  ('attendant', 'company.dashboard.view'),
  ('attendant', 'company.appointments.view'),
  ('attendant', 'company.appointments.manage'),
  ('attendant', 'company.clients.view'),
  ('attendant', 'company.clients.manage'),
  ('attendant', 'company.services.view'),
  ('attendant', 'company.professionals.view'),
  ('attendant', 'company.products.view'),

  -- PROFESSIONAL: enxerga a própria rotina, não escreve nada.
  ('professional', 'company.dashboard.view'),
  ('professional', 'company.appointments.view'),
  ('professional', 'company.clients.view'),
  ('professional', 'company.services.view'),
  ('professional', 'company.professionals.view'),
  ('professional', 'company.products.view');

-- =============================================================================
-- CLÍNICA DE DEMONSTRAÇÃO
-- =============================================================================

insert into public.companies (
  id, slug, name, document, email, phone, status, plan_id,
  street, number, district, city, state, zip, timezone, theme_id
) values (
  '00000000-0000-4000-a000-000000000001',
  'clinica-odontovida', 'Clínica OdontoVida', '21.774.309/0001-52',
  'contato@odontovida.com.br', '(11) 3255-8890', 'active', 'profissional',
  'Rua Augusta', '1421', 'Consolação', 'São Paulo', 'SP', '01305-100',
  'America/Sao_Paulo', 'clinic-clean'
) on conflict (id) do nothing;

insert into public.company_settings (company_id) values
  ('00000000-0000-4000-a000-000000000001')
on conflict (company_id) do nothing;

-- Domingo fechado; sexta até 17h; sábado meio período.
insert into public.business_hours (company_id, weekday, is_closed, opens_at, closes_at) values
  ('00000000-0000-4000-a000-000000000001', 0, true,  '08:00', '19:00'),
  ('00000000-0000-4000-a000-000000000001', 1, false, '08:00', '19:00'),
  ('00000000-0000-4000-a000-000000000001', 2, false, '08:00', '19:00'),
  ('00000000-0000-4000-a000-000000000001', 3, false, '08:00', '19:00'),
  ('00000000-0000-4000-a000-000000000001', 4, false, '08:00', '19:00'),
  ('00000000-0000-4000-a000-000000000001', 5, false, '08:00', '17:00'),
  ('00000000-0000-4000-a000-000000000001', 6, true,  '08:00', '12:00')
on conflict (company_id, weekday) do nothing;

-- ---------------------------------------------------------------------------
-- Equipe
-- ---------------------------------------------------------------------------
insert into public.professionals (
  id, company_id, name, role, email, phone, hired_at, is_active, rating, hue,
  service_commission_pct, product_commission_pct
) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001',
   'Camila Vasconcelos', 'Cirurgiã-dentista · Endodontia', 'camila@odontovida.com.br', '(11) 98812-4471',
   '2021-03-15', true, 4.9, 190, 45, 10),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001',
   'Felipe Andrade', 'Cirurgião-dentista', 'felipe@odontovida.com.br', '(11) 99145-3320',
   '2022-07-04', true, 4.8, 205, 40, 8),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001',
   'Juliana Mattos', 'Ortodontista', 'juliana@odontovida.com.br', '(11) 99730-1188',
   '2023-01-20', true, 4.7, 172, 50, 12),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000001',
   'Renato Souza', 'Cirurgião-dentista', 'renato@odontovida.com.br', '(11) 98004-7752',
   '2024-05-02', true, 4.6, 220, 38, 8)
on conflict (id) do nothing;

-- Jornadas: segunda a sábado, com intervalo no meio do dia.
insert into public.professional_schedules (professional_id, weekday, starts_at, ends_at, break_start, break_end)
select p.id, d.weekday, p.opens, p.closes, p.b_start, p.b_end
  from (values
    ('00000000-0000-4000-b000-000000000001'::uuid, '08:00'::time, '17:00'::time, '12:00'::time, '13:00'::time),
    ('00000000-0000-4000-b000-000000000002'::uuid, '09:00', '18:00', '13:00', '14:00'),
    ('00000000-0000-4000-b000-000000000003'::uuid, '10:00', '19:00', '14:00', '15:00'),
    ('00000000-0000-4000-b000-000000000004'::uuid, '09:00', '18:00', '13:00', '14:00')
  ) as p(id, opens, closes, b_start, b_end)
 cross join (values (1), (2), (3), (4), (5), (6)) as d(weekday)
on conflict (professional_id, weekday) do nothing;

-- ---------------------------------------------------------------------------
-- Catálogo de procedimentos
-- ---------------------------------------------------------------------------
insert into public.services (
  id, company_id, name, description, category, price_cents, duration_min, buffer_min, is_active
) values
  ('00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000001',
   'Consulta de Avaliação', 'Exame clínico, anamnese e plano de tratamento.', 'avaliacao', 12000, 30, 5, true),
  ('00000000-0000-4000-c000-000000000002', '00000000-0000-4000-a000-000000000001',
   'Limpeza (Profilaxia)', 'Remoção de placa e tártaro, polimento e flúor.', 'preventivo', 15000, 40, 10, true),
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-a000-000000000001',
   'Restauração em Resina', 'Restauração estética direta, uma face.', 'restaurador', 25000, 50, 10, true),
  ('00000000-0000-4000-c000-000000000004', '00000000-0000-4000-a000-000000000001',
   'Clareamento Dental', 'Clareamento em consultório, sessão única.', 'estetico', 90000, 60, 15, true),
  ('00000000-0000-4000-c000-000000000005', '00000000-0000-4000-a000-000000000001',
   'Extração Simples', 'Extração de dente sem indicação cirúrgica.', 'cirurgico', 35000, 40, 10, true),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-a000-000000000001',
   'Tratamento de Canal', 'Endodontia completa. Exige avaliação prévia por imagem.', 'cirurgico', 120000, 90, 15, true),
  ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-a000-000000000001',
   'Avaliação + Limpeza', 'O combo mais pedido para quem não vem há mais de um ano.', 'combo', 24000, 65, 10, true)
on conflict (id) do nothing;

insert into public.service_components (combo_id, component_id) values
  ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000001'),
  ('00000000-0000-4000-c000-000000000007', '00000000-0000-4000-c000-000000000002')
on conflict do nothing;

-- Tabela própria da endodontista.
insert into public.service_prices (service_id, professional_id, price_cents) values
  ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-b000-000000000001', 28000),
  ('00000000-0000-4000-c000-000000000006', '00000000-0000-4000-b000-000000000001', 140000)
on conflict do nothing;

-- A ortodontista atende avaliação, restauração, clareamento e canal.
insert into public.professional_services (professional_id, service_id) values
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000001'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000003'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000004'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-c000-000000000006')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------------
insert into public.clients (company_id, name, phone, email, tags)
select '00000000-0000-4000-a000-000000000001', v.name, v.phone, v.email, v.tags
  from (values
    ('João Silva',       '(11) 94812-7741', 'joao.silva@email.com',      array['fiel']),
    ('Carlos Santos',    '(11) 95523-1180', 'carlos.santos@email.com',   array['convênio']),
    ('Pedro Oliveira',   '(11) 96140-3392', 'pedro.oliveira@email.com',  array['fiel','indicação']),
    ('Lucas Ferreira',   '(11) 97781-2205', 'lucas.ferreira@email.com',  '{}'::text[]),
    ('Rafael Almeida',   '(11) 98033-6614', 'rafael.almeida@email.com',  array['ortodontia']),
    ('Bruno Carvalho',   '(11) 94477-9908', 'bruno.carvalho@email.com',  array['particular']),
    ('Felipe Andrade',   '(11) 95612-4471', 'felipe.andrade2@email.com', array['primeira vez']),
    ('Gustavo Lima',     '(11) 96925-7730', 'gustavo.lima@email.com',    '{}'::text[]),
    ('Matheus Cardoso',  '(11) 97284-0056', 'matheus.cardoso@email.com', array['fiel']),
    ('Vinícius Barros',  '(11) 98550-3317', 'vinicius.barros@email.com', array['sempre atrasa']),
    ('Eduardo Freitas',  '(11) 94106-8823', 'eduardo.freitas@email.com', '{}'::text[]),
    ('Ricardo Menezes',  '(11) 95738-2249', 'ricardo.menezes@email.com', array['convênio','fiel'])
  ) as v(name, phone, email, tags)
 where not exists (
   select 1 from public.clients c
    where c.company_id = '00000000-0000-4000-a000-000000000001' and c.name = v.name
 );

-- ---------------------------------------------------------------------------
-- Itens de consultório
-- ---------------------------------------------------------------------------
insert into public.products (
  company_id, name, brand, sku, category, qty, min_qty, capacity, unit, cost_cents, price_cents
)
select '00000000-0000-4000-a000-000000000001', v.name, v.brand, v.sku, v.category::product_category,
       v.qty, v.min_qty, v.capacity, v.unit, v.cost_cents, v.price_cents
  from (values
    ('Luva de Procedimento (P)',          'Descarpack',    'DP-LUV-P100', 'descartavel', 18,  10,  30, 'cx.', 2200,  0),
    ('Resina Composta Fotopolimerizável', 'FGM',           'FGM-RES-A2',  'material',     7,   8,  20, 'un.', 8900,  0),
    ('Anestésico Odontológico',           'DFL',           'DFL-ANE-050', 'medicamento', 22,  15,  50, 'cx.', 6500,  0),
    ('Sugador Descartável',               'Maquira',       'MQ-SUG-040',  'descartavel',  5,  10,  30, 'pct.',1400,  0),
    ('Kit Broca Diamantada',              'KG Sorensen',   'KG-BRO-K12',  'instrumental',14,   6,  20, 'un.', 12000, 0),
    ('Fio de Sutura',                     'Ethicon',       'ET-FIO-030',  'material',    20,  10,  40, 'cx.', 4200,  0),
    ('Máscara Cirúrgica',                 'Descarpack',    'DP-MSC-050',  'protecao',   240, 100, 500, 'un.',   45,  0),
    ('Avental Descartável (TNT)',         'Vestcirúrgica', 'VC-AVE-100',  'protecao',    55,  80, 300, 'un.',   90,  0),
    ('Óculos de Proteção',                'Kalipso',       'KL-OCU-001',  'protecao',    12,   5,  25, 'un.', 1600,  0)
  ) as v(name, brand, sku, category, qty, min_qty, capacity, unit, cost_cents, price_cents)
 where not exists (
   select 1 from public.products p
    where p.company_id = '00000000-0000-4000-a000-000000000001' and p.sku = v.sku
 );

-- =============================================================================
-- LIGAR SUA CONTA À CLÍNICA
--
-- Membros referenciam `auth.users`, e usuários nascem pelo fluxo de cadastro do
-- app — inserir direto em `auth.users` por SQL pula a criptografia da senha e a
-- confirmação de e-mail.
--
-- Então: crie sua conta pelo app (ou em Authentication > Users > Add user),
-- troque o e-mail abaixo e rode este bloco.
-- =============================================================================

-- insert into public.memberships (user_id, company_id, role)
-- select u.id, '00000000-0000-4000-a000-000000000001', 'owner'
--   from auth.users u
--  where u.email = 'SEU-EMAIL-AQUI@exemplo.com'
-- on conflict (user_id, company_id) do update set role = excluded.role;

-- Para virar administrador da plataforma (vê o SAAS CONTROL CENTER):
-- insert into public.platform_admins (user_id)
-- select u.id from auth.users u where u.email = 'SEU-EMAIL-AQUI@exemplo.com'
-- on conflict (user_id) do nothing;

-- =============================================================================
-- APAGAR A DEMONSTRAÇÃO
-- O cascade leva junto equipe, catálogo, pacientes, agenda, itens e caixa.
-- =============================================================================

-- delete from public.companies where id = '00000000-0000-4000-a000-000000000001';
