import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIG = fileURLToPath(new URL('../migrations/', import.meta.url));

/**
 * Shim do que o Supabase já traz pronto: o schema `auth`, a função `auth.uid()`
 * lendo o claim do JWT, e os três papéis do PostgREST. Sem isso, as migrations
 * não aplicam fora do Supabase — e não dá para testar a RLS aqui.
 */
const SHIM = `
  create role anon;
  create role authenticated;
  create role service_role;

  create schema if not exists auth;

  -- Só as colunas que as migrations tocam. \`raw_user_meta_data\` é onde o
  -- Supabase guarda o que o cadastro mandou em \`options.data\` — é de lá que
  -- \`user_display_name()\` tira o nome da pessoa.
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    last_sign_in_at timestamptz
  );

  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
  $$;

  -- Shim do Storage. Só o que o \`0010\` toca: os dois catálogos e a função que
  -- quebra o caminho em pastas — é dela que sai a empresa dona do arquivo, e
  -- portanto é ela que as policies de isolamento usam.
  create schema if not exists storage;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz not null default now()
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id) on delete cascade,
    name text not null,
    owner uuid,
    created_at timestamptz not null default now()
  );

  alter table storage.objects enable row level security;

  -- O Supabase já concede isto; sem os grants o PostgREST devolveria 42501
  -- antes de qualquer policy rodar, e o teste de isolamento passaria pelo
  -- motivo errado.
  grant usage on schema storage to anon, authenticated, service_role;
  grant select on storage.objects to anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to anon, authenticated;

  create or replace function storage.foldername(name text)
  returns text[]
  language sql
  immutable
  as $$
    -- O Supabase devolve os segmentos sem o nome do arquivo.
    select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;
`;

export async function boot({ upto = 9999, quiet = false } = {}) {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SHIM);

  const files = fs
    .readdirSync(MIG)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => Number(f.slice(0, 4)) <= upto);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIG, file), 'utf8');
    try {
      await db.exec(sql);
      if (!quiet) console.log(`  ${file}: aplicada`);
    } catch (e) {
      console.log(`\n  ${file}: FALHOU`);
      console.log(`  ${e.code ?? ''} ${e.message}`);
      if (e.hint) console.log(`  hint: ${e.hint}`);
      // Mostra o trecho em volta do erro, se o Postgres disse onde foi.
      if (e.position) {
        const at = Number(e.position);
        console.log(`  ...${sql.slice(Math.max(0, at - 220), at + 120)}...`);
      }
      throw new Error(`migration ${file}`);
    }
  }
  return db;
}

/** Executa como um usuário autenticado específico. */
export async function asUser(db, userId) {
  await db.exec(`set role authenticated;`);
  await db.exec(`set request.jwt.claim.sub = '${userId}';`);
  await db.exec(`set request.jwt.claim.role = 'authenticated';`);
}

export async function asAnon(db) {
  await db.exec(`set role anon;`);
  await db.exec(`set request.jwt.claim.sub = '';`);
  await db.exec(`set request.jwt.claim.role = 'anon';`);
}

export async function asAdmin(db) {
  await db.exec(`reset role;`);
  await db.exec(`set request.jwt.claim.sub = '';`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('Aplicando migrations:');
  const db = await boot();
  const t = await db.query(`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public'`);
  console.log(`\nOK — ${t.rows[0].n} tabelas em public`);
}
