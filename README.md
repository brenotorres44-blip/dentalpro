# PRODENT

SaaS multi-tenant para consultórios odontológicos — agenda por dentista,
pacientes, catálogo de procedimentos, financeiro e itens de consultório, com
um centro de comando para quem opera a plataforma.

Este projeto reaplica a arquitetura de um SaaS irmão para barbearias (mesmo
motor de temas, mesma matriz de permissões, mesmo desenho de dois modos) a um
domínio diferente — com um layout deliberadamente limpo em vez do visual de
HUD do projeto de origem. Detalhes de arquitetura e o estado exato de cada
módulo estão em [`CLAUDE.md`](./CLAUDE.md).

## Rodando localmente

Sem nenhuma configuração, o projeto roda em **modo demonstração**: dados
determinísticos em memória, sem banco.

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` e entre com qualquer senha usando uma das contas
listadas na tela de login.

## Com Supabase

Crie um projeto no [Supabase](https://supabase.com), rode as migrations de
`supabase/migrations/` em ordem no SQL Editor (`0001` a `0007`), e crie
`.env.local`:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

A partir daí os dados vêm do banco e a senha vale de verdade — crie sua conta
pela tela de cadastro ou em **Authentication → Users**.

```bash
npm run test:db   # aplica as migrations num Postgres real (pglite) e roda a suíte de RLS
```

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · React Router · Supabase
(Postgres + Auth) · Framer Motion · Recharts.

## Licença

Projeto privado.
