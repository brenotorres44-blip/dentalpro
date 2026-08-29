import { boot, asUser, asAnon, asAdmin } from './harness.mjs';

/**
 * Suíte reduzida para o esqueleto do PRODENT.
 *
 * Cobre o que as migrations `0001` a `0007` sustentam: isolamento
 * multi-tenant, a matriz de permissões por papel, as RPCs transacionais de
 * agenda (`book_appointment`, `update_appointment`, `cancel_appointment`),
 * o cadastro (`create_company_and_owner`) e as quatro funções de leitura do
 * SAAS CONTROL CENTER. Não é a suíte de 218 casos do projeto de origem — as
 * migrations de cobrança, notificações, storage, realtime, acessos de equipe
 * e tema no banco ainda não foram portadas para este esqueleto (ver
 * `docs/02-estado-do-projeto.md`), então não há o que testar delas aqui.
 */

const ODONTOVIDA = '00000000-0000-4000-a000-000000000001';
const CAMILA = '00000000-0000-4000-b000-000000000001';
const FELIPE = '00000000-0000-4000-b000-000000000002';
const AVALIACAO = '00000000-0000-4000-c000-000000000001';
const LIMPEZA = '00000000-0000-4000-c000-000000000002';
const CANAL = '00000000-0000-4000-c000-000000000006';

let pass = 0;
const fails = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fails.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FALHA ${name} ${detail}`); }
}

/** Espera que a operação seja negada. Silêncio (0 linhas) também é negar. */
async function denied(name, fn, { expectEmpty = false } = {}) {
  try {
    const r = await fn();
    if (expectEmpty) check(name, r.rows.length === 0, `retornou ${r.rows.length} linha(s)`);
    else check(name, false, 'a operação foi aceita');
  } catch (e) {
    check(name, true);
  }
}

const db = await boot({ quiet: true });

// ---------------------------------------------------------------------------
// Cenário: duas clínicas, quatro pessoas.
// ---------------------------------------------------------------------------
const UA = '11111111-1111-4111-a111-111111111111'; // dona da OdontoVida
const UB = '22222222-2222-4222-a222-222222222222'; // dono da concorrente
const UP = '33333333-3333-4333-a333-333333333333'; // dentista da OdontoVida
const UADM = '44444444-4444-4444-a444-444444444444'; // admin da plataforma
const RIVAL = '00000000-0000-4000-a000-0000000000ff';

await db.exec(`
  insert into auth.users (id, email) values
    ('${UA}','dona@odontovida.com.br'), ('${UB}','dono@rival.com.br'),
    ('${UP}','camila@odontovida.com.br'), ('${UADM}','admin@prodent.app');

  insert into public.companies (id, slug, name, plan_id, status)
  values ('${RIVAL}', 'clinica-rival', 'Clínica Rival', 'essencial', 'active');
  insert into public.company_settings (company_id) values ('${RIVAL}');
  insert into public.business_hours (company_id, weekday, is_closed, opens_at, closes_at)
  select '${RIVAL}', g, g = 0, '09:00', '20:00' from generate_series(0,6) g;

  insert into public.clients (id, company_id, name)
  values ('00000000-0000-4000-d000-0000000000ff', '${RIVAL}', 'Paciente da Rival');

  insert into public.memberships (user_id, company_id, role) values
    ('${UA}', '${ODONTOVIDA}', 'owner'),
    ('${UB}', '${RIVAL}', 'owner'),
    ('${UP}', '${ODONTOVIDA}', 'professional');

  insert into public.platform_admins (user_id) values ('${UADM}');
`);

const PACIENTE = (await db.query(
  `select id from public.clients where company_id = '${ODONTOVIDA}' limit 1`,
)).rows[0].id;

// ---------------------------------------------------------------------------
// Isolamento multi-tenant
// ---------------------------------------------------------------------------
await asUser(db, UA);
const meusServicos = await db.query(
  `select id from public.services where company_id = '${ODONTOVIDA}'`,
);
check('dona vê o catálogo da própria clínica', meusServicos.rows.length > 0);

const servicosDaRival = await db.query(
  `select id from public.services where company_id = '${RIVAL}'`,
);
check('dona não vê o catálogo da clínica rival', servicosDaRival.rows.length === 0);

await denied(
  'dona não lê pacientes da clínica rival',
  () => db.query(`select id from public.clients where company_id = '${RIVAL}'`),
  { expectEmpty: true },
);

await asAnon(db);
await denied(
  'anônimo não lê agenda nenhuma',
  () => db.query(`select id from public.appointments where company_id = '${ODONTOVIDA}'`),
  { expectEmpty: true },
);

// ---------------------------------------------------------------------------
// Matriz de permissões por papel
// ---------------------------------------------------------------------------
await asUser(db, UP); // dentista: só lê, não escreve preço
// A policy de UPDATE nega pela cláusula USING: a instrução não lança erro,
// só afeta zero linhas — é assim que RLS costuma negar um UPDATE.
const tentativa = await db.query(
  `update public.services set price_cents = 1 where id = '${AVALIACAO}'`,
);
check(
  'dentista não altera o preço de um procedimento',
  (tentativa.affectedRows ?? 0) === 0,
  `affectedRows=${tentativa.affectedRows}`,
);

await asUser(db, UA); // owner: administra a própria clínica
await db.query(
  `update public.services set description = 'Atualizado pela dona' where id = '${AVALIACAO}'`,
);
const atualizado = (await db.query(
  `select description from public.services where id = '${AVALIACAO}'`,
)).rows[0];
check('dona altera o catálogo da própria clínica', atualizado.description === 'Atualizado pela dona');

// ---------------------------------------------------------------------------
// book_appointment — a agenda é transacional, não otimista
// ---------------------------------------------------------------------------
// Terça-feira, semana que vem — dia útil garantido, para o teste não
// depender de em que dia da semana ele é executado (sábado é meio período
// fechado na semente, domingo é fechado).
const horario = new Date();
horario.setDate(horario.getDate() + ((2 - horario.getDay() + 7) % 7 || 7) + 7);
horario.setHours(10, 0, 0, 0);
const isoHorario = horario.toISOString();

await asUser(db, UA);
const agendado = await db.query(
  `select * from public.book_appointment(
     '${ODONTOVIDA}', '${CAMILA}', '${PACIENTE}', array['${AVALIACAO}']::uuid[], '${isoHorario}'
   )`,
);
check('book_appointment cria o atendimento', agendado.rows.length === 1);

await denied(
  'book_appointment recusa o mesmo horário do mesmo dentista',
  () => db.query(
    `select * from public.book_appointment(
       '${ODONTOVIDA}', '${CAMILA}', '${PACIENTE}', array['${LIMPEZA}']::uuid[], '${isoHorario}'
     )`,
  ),
);

await asUser(db, UP); // dentista não tem company.appointments.manage
await denied(
  'dentista não pode marcar atendimento (sem company.appointments.manage)',
  () => db.query(
    `select * from public.book_appointment(
       '${ODONTOVIDA}', '${FELIPE}', '${PACIENTE}', array['${CANAL}']::uuid[], '${isoHorario}'
     )`,
  ),
);

// ---------------------------------------------------------------------------
// cancel_appointment
// ---------------------------------------------------------------------------
await asUser(db, UA);
const criado = agendado.rows[0];
const cancelado = await db.query(
  `select * from public.cancel_appointment('${criado.id}', 'Paciente remarcou')`,
);
check('cancel_appointment marca como cancelado', cancelado.rows[0].status === 'cancelado');

await asUser(db, UB); // dono da rival não alcança o atendimento da OdontoVida
await denied(
  'dono de outra clínica não cancela atendimento alheio',
  () => db.query(`select * from public.cancel_appointment('${criado.id}', 'tentativa')`),
);

// ---------------------------------------------------------------------------
// create_company_and_owner — o cadastro
// ---------------------------------------------------------------------------
const UNOVO = '55555555-5555-4555-a555-555555555555';
await asAdmin(db); // volta a superusuário: só ele grava direto em auth.users
await db.exec(`insert into auth.users (id, email) values ('${UNOVO}','nova@clinica.com.br');`);

await asUser(db, UNOVO);
const nova = await db.query(
  `select public.create_company_and_owner('Clínica Sorriso Novo') as id`,
);
const novaId = nova.rows[0].id;
check('create_company_and_owner cria a clínica', Boolean(novaId));

const papelNovo = (await db.query(
  `select role from public.memberships where user_id = '${UNOVO}' and company_id = '${novaId}'`,
)).rows[0];
check('quem cadastra vira owner da própria clínica', papelNovo?.role === 'owner');

await denied(
  'uma conta não cria uma segunda clínica',
  () => db.query(`select public.create_company_and_owner('Outra Clínica')`),
);

// ---------------------------------------------------------------------------
// SAAS CONTROL CENTER — funções de plataforma
// ---------------------------------------------------------------------------
await asUser(db, UA);
await denied(
  'dona de clínica não lê platform_overview',
  () => db.query(`select public.platform_overview()`),
);

await asAnon(db);
await denied('anônimo não lê platform_companies', () => db.query(`select * from public.platform_companies()`));

await asUser(db, UADM);
const overview = (await db.query(`select public.platform_overview() as o`)).rows[0].o;
check('admin da plataforma lê platform_overview', typeof overview.totalCompanies === 'number');
check('platform_overview conta as duas clínicas de teste + a semente', overview.totalCompanies >= 2);

const companies = await db.query(`select * from public.platform_companies()`);
check(
  'platform_companies lista clínicas de todos os tenants',
  companies.rows.some((c) => c.id === ODONTOVIDA) && companies.rows.some((c) => c.id === RIVAL),
);

console.log(`\n${'='.repeat(50)}`);
console.log(`${pass} passaram, ${fails.length} falharam`);
if (fails.length) { console.log('\nFALHAS:'); fails.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
