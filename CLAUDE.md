# PRODENT — contexto para o Claude Code

SaaS multi-tenant para consultórios odontológicos. Frontend React + TypeScript
+ Vite + Tailwind v4. Backend em Supabase: schema, RLS e funções transacionais
em `supabase/migrations/`.

**Este projeto nasceu como um recorte da arquitetura do BARBER FLOW** (um SaaS
irmão para barbearias, com o mesmo motor de temas, a mesma matriz de
permissões e o mesmo desenho de dois modos) — reaplicada a um domínio
diferente e com um pedido explícito: layout limpo, sem o vocabulário visual de
HUD do projeto de origem. O que mudou foi o domínio e a estética; o que ficou
foi a arquitetura: multi-tenant por `company_id`, dois modos de operação,
permissão por capacidade e tokens de tema.

**O sistema tem dois modos, e o que decide é a existência de `.env.local`.**
Com ele, os dados vêm do banco. Sem ele, tudo roda com sementes determinísticas
e `localStorage` — o que mantém o repositório clonável sem provisionar nada.
Nenhum componente sabe em qual modo está.

## Comandos

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck
npm run test:db    # aplica as migrations num Postgres real (pglite) e testa RLS + RPCs
```

## Os três ambientes

| Rota | Nome | Quem entra | Tema |
|---|---|---|---|
| `/`, `/login`, `/register`, `/forgot-password` | Site público | qualquer um | CLEAN fixo |
| `/onboarding`, `/criar-clinica` | Configuração inicial | autenticado | tema da clínica |
| `/app/*` | **PRODENT** — operação da clínica | owner, manager, professional, attendant | tema da clínica |
| `/admin/*` | **SAAS CONTROL CENTER** — plataforma | super_admin | `control-center` (ardósia/âmbar), fixo |

O admin usa o mesmo acabamento sóbrio e limpo do resto do produto; só a
paleta diverge — ardósia escura com acento âmbar, contra o branco/verde do
tema padrão da clínica. É deliberado: se os dois ambientes tivessem a mesma
cor, o administrador perderia o sinal imediato de onde está operando.
`CONTROL_CENTER_THEME` fica fora de `THEMES`, então nenhuma clínica pode
escolhê-lo.

## Regras que não devem ser quebradas

1. **Nenhum componente sabe que temas existem.** Cores vêm sempre de tokens
   (`text-hud`, `bg-void`, `border-stroke`). Cor literal em componente quebra
   os temas.
2. **Toda decisão de permissão passa por `can()`** (`src/config/permissions.ts`).
   Nunca comparar `role` direto num componente.
3. **Efeitos visuais usam as variáveis `--fx-*`** (`glow`, `particles`, `motion`,
   `chrome`, `shadow`) e `--density`, `--radius-card`, `--panel-mix`,
   `--tech-tracking`. O padrão CLEAN já nasce com `chrome`, `glow` e
   `particles` em zero — é a família toda, não uma opção "sóbria" ao lado de
   outras futuristas. O motor não proíbe ligar o brilho de volta.
4. **Dinheiro em centavos inteiros** (`bigint` no banco). Nunca float.
5. **Números na tela não podem se contradizer.** O total do painel de
   procedimentos é derivado do faturamento do mês, não calculado à parte —
   tudo que envolve atendimento sai de `agendaService`.
6. **O rótulo não pode prometer mais que o dado.** Quando um módulo não foi
   implementado, a tela é o `ModulePage` — declara o escopo previsto em vez
   de fingir uma tela vazia ou (pior) uma tela que parece funcionar e não
   funciona.
7. **Animação só em `transform`, `opacity` e `filter`.** `prefers-reduced-motion`
   desliga o laço, não só encurta a duração.

## Mapa do código

```
src/
├─ themes/          tokens.ts (CLEAN + CLEAN NOTURNO + control-center) · ThemeProvider
│                   adminTheme (a camada do próprio painel, por navegador)
├─ auth/            SessionProvider · guards (RequireAuth, RequireCapability)
├─ config/          permissions.ts (matriz papel×capacidade) · navigation.ts · modules.ts
├─ services/        store.ts (espelho da clínica em memória) · companyData (carga do
│                   banco) · mappers (snake_case ↔ camelCase) · remote (coleção→tabela)
│                   agendaService · insightsService · financeService ·
│                   inventoryService · dashboardService · authService
│                   platformStore + platformData (o mesmo par, um andar acima:
│                   o SAAS CONTROL CENTER) · publicPlans (vitrine, sem login)
│                   mediaService (bucket) · realtime (grade que se atualiza sozinha)
│                   signupService (cadastro de clínica nova)
├─ data/            saas.ts (clínicas, planos, usuários, logs, tickets — modo mock)
│                   mock.ts (sementes do domínio: dentistas, procedimentos,
│                   pacientes, itens) · types.ts
├─ layouts/         SiteLayout · AppLayout · AdminLayout · TenantShell
├─ components/
│  ├─ ui/           HolographicPanel, DataTable, Drawer, Toolbar, StatStrip,
│  │                TechButton, Field, ProgressBar, EmptyState, Skeleton…
│  ├─ dashboard/    HolographicCore, RevenueChart, RadialGauge, TechCalendar…
│  ├─ agenda/       AgendaGrid, AppointmentForm, WeekView, BlockDrawer, WaitlistDrawer
│  └─ layout/       Sidebar, TopBar, ImpersonationBanner, SystemTicker
├─ hooks/           useBoot · useCountUp · useClock
└─ pages/           site/ · auth/ · onboarding/ · app/ · admin/
```

### Como os dados fluem

`agendaService.listByDate(data)` é a fonte de tudo que envolve atendimento. O
dashboard, as fichas de paciente, o ranking da equipe, o caixa e o painel de
procedimentos são leituras derivadas dela.

**Com banco:** `hydrateCompany()` carrega numa ida só tudo que cabe em memória,
mais uma janela de atendimentos de 180 dias para trás e 90 para frente.

**Sem banco:** a agenda soma uma base determinística por data e um *overlay*
com o que o usuário mexeu. O gerador lê as sementes de `data/mock.ts`, nunca o
store.

### Leitura é síncrona; escrita de agenda, não

As coleções (procedimentos, equipe, pacientes, itens, movimentações, caixa,
bloqueios) escrevem otimista. Os atendimentos não: quem decide se o horário
está livre é a constraint `EXCLUDE USING gist` do Postgres, então as escritas
de `agendaService` são `async` e esperam a resposta das RPCs
(`book_appointment`, `update_appointment`, `cancel_appointment`).

## Contas de demonstração (só no modo mock — qualquer senha)

- `admin@prodent.app` → super admin → `/admin/dashboard`
- `owner@odontovida.com.br` → dono da clínica → `/app/dashboard`
- `recepcao@odontovida.com.br` → recepção (menu reduzido)

Com Supabase ligado esses botões não aparecem — entre com a conta criada em
**Authentication → Users**.

## Estado atual — o que este esqueleto entrega

Este projeto é um **recorte funcional** da arquitetura do BARBER FLOW, não uma
réplica 1:1. A escolha, deliberada, foi entregar um conjunto pequeno de
módulos **completos e reais** — mock e banco, ponta a ponta — em vez de nove
módulos meia-boca.

**Implementado, nos dois modos:**

- Os três ambientes (site público, `/app/*`, `/admin/*` — sem a vitrine
  pública `/<slug>`, ver abaixo);
- Oito módulos operacionais: Dashboard, Agenda, Pacientes, Procedimentos,
  Equipe, Financeiro, Itens de consultório e Configurações;
- No SAAS CONTROL CENTER: Visão geral, Clínicas e Planos;
- Cadastro de clínica nova (`create_company_and_owner`) e recuperação de senha;
- `supabase/migrations/0001` a `0007` — schema, RLS, RPCs de agenda,
  cadastro e as quatro funções de leitura da plataforma;
- `npm run test:db` — 19 casos cobrindo isolamento multi-tenant, a matriz de
  permissões, as RPCs transacionais e as funções de plataforma.

**Não implementado — próximo passo, não dívida escondida:**

- **Relatórios e Assinatura** (`/app/reports`, `/app/subscription`) e
  **Usuários, Assinaturas, Suporte, Logs e Temas** no admin — a navegação
  existe e leva ao `ModulePage`, que declara honestamente "não implementado" e
  o escopo previsto (`src/config/modules.ts`).
- **Cobrança via Stripe** — sem Edge Functions `stripe-billing` /
  `stripe-webhook`, sem migration de faturas. A tela de Planos mostra preço,
  não cobra.
- **Vitrine pública `/<slug>`** e agendamento sem login — sem Edge Function
  `book-public`, sem Turnstile. O paciente ainda não agenda sozinho pela
  internet; quem agenda é a equipe, pelo `/app/appointments`.
- **Notificações por e-mail/WhatsApp** — os toggles em Configurações gravam a
  preferência; não há fila, worker nem Edge Function `send-notifications`
  entregando.
- **Convite de equipe por e-mail e storage de foto/logo** — `mediaService`
  existe e degrada sem erro sem Supabase, mas as migrations de storage e de
  convite não foram portadas.
- **Tema da clínica gravado no banco** (o `0017` do projeto de origem) — aqui
  `theme_id` já é uma coluna de `companies` desde o `0001`, mas o editor
  (`/admin/themes`) ainda não existe; a personalização por enquanto é só o que
  o cadastro grava.

Cada um desses itens é uma migration nova mais a tela — o mesmo padrão que
`0001`–`0007` já demonstram, então portar um módulo não exige redesenhar nada,
só repetir o que já está aqui.

## Temas

Dois temas prontos — **CLEAN** (claro, padrão) e **CLEAN NOTURNO** (escuro) —
mais o `control-center` fixo do admin. É uma escolha deliberada, não uma
limitação do motor: `ThemeTokens`/`ThemeEffects`/`ThemeTypography` são os
mesmos do projeto de origem, e qualquer clínica pode ligar `chrome`, `glow` e
`particles` de volta puxando os sliders do Theme Builder (`/app/theme`) — o
motor não proíbe, só o padrão nasce desligado.
