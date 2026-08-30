import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, LogIn, MoreHorizontal, Search, ShieldOff, ArrowUpDown, X } from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TechButton } from '@/components/ui/TechButton';
import { getPlan, limitLabel, type Company, type CompanyStatus } from '@/data/saas';
import { updateCompany, usePlatform } from '@/services/platformStore';
import { loadCompanyDetail, type CompanyDetail } from '@/services/platformData';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useSession } from '@/auth/SessionProvider';
import { formatBRL, formatBRLCompact, formatInt, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const STATUS_META: Record<CompanyStatus, { label: string; tone: 'ok' | 'live' | 'warn' | 'critical' }> = {
  active: { label: 'ativo', tone: 'ok' },
  trial: { label: 'trial', tone: 'live' },
  suspended: { label: 'suspenso', tone: 'warn' },
  canceled: { label: 'cancelado', tone: 'critical' },
};

const STATUS_FILTERS: Array<{ value: CompanyStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspensas' },
  { value: 'canceled', label: 'Canceladas' },
];

type SortKey = 'name' | 'users' | 'createdAt' | 'lastActivityAt';

const SORT_LABEL: Record<SortKey, string> = {
  lastActivityAt: 'Atividade',
  name: 'Nome',
  users: 'Usuários',
  createdAt: 'Cadastro',
};

const SORT_CYCLE: SortKey[] = ['lastActivityAt', 'name', 'users', 'createdAt'];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = diff / 3600000;
  if (hours < 1) return 'agora há pouco';
  if (hours < 24) return `há ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days}d`;
  return `há ${Math.round(days / 30)} meses`;
}

/** `null` no limite é ilimitado: a barra fica vazia porque não há teto a encher. */
function usoPct(atual: number, limite: number | null) {
  if (limite === null || limite <= 0) return 0;
  return Math.min((atual / limite) * 100, 100);
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'dono',
  manager: 'gerente',
  attendant: 'atendente',
  professional: 'profissional',
};

const INVOICE_TONE: Record<string, 'ok' | 'warn' | 'critical' | 'live'> = {
  paga: 'ok',
  aberta: 'live',
  falhou: 'critical',
  cancelada: 'warn',
};

/**
 * O PERFIL.
 *
 * Antes daqui, a gaveta mostrava oito números e dois `select`. Quem ligava
 * perguntando "por que não consigo adicionar mais um dentista" obrigava o
 * administrador a **entrar no ambiente** para descobrir — o que grava uma
 * impersonação na auditoria para responder uma pergunta de leitura.
 *
 * Carrega sob demanda, ao abrir: são cinco recortes de uma empresa só, e trazê-los
 * para todas as clínicas no boot do painel seria pagar por dezenas para ler um.
 */
function CompanyProfile({ company }: { company: Company }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setErro(null);

    // Sem banco não há o que carregar: o modo mock não tem faturas nem auditoria
    // por empresa, e encenar isso aqui seria a tela inventando um histórico.
    if (!isSupabaseConfigured) return;

    loadCompanyDetail(company.id)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e: unknown) => {
        if (alive) setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil.');
      });

    return () => {
      alive = false;
    };
  }, [company.id]);

  if (!isSupabaseConfigured) {
    return (
      <p className="mt-5 rounded-[8px] border border-warn/30 bg-warn/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-warn">
        O perfil completo — assinatura, equipe, uso e auditoria — vem do banco. Em modo
        demonstração não há o que mostrar aqui.
      </p>
    );
  }

  if (erro) {
    return (
      <p className="mt-5 rounded-[8px] border border-critical/30 bg-critical/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-critical">
        {erro}
      </p>
    );
  }

  if (!detail) {
    return (
      <p className="mt-5 text-center font-mono text-[10px] text-ink-faint anim-breathe">
        carregando o perfil
      </p>
    );
  }

  const { subscription: sub, usage, team, invites, invoices, audit } = detail;

  const eixos = [
    { label: 'Usuários', atual: usage.users, limite: usage.limits.users },
    { label: 'Profissionais', atual: usage.professionals, limite: usage.limits.professionals },
    { label: 'Clientes', atual: usage.clients, limite: usage.limits.clients },
    {
      label: 'Atendimentos no mês',
      atual: usage.appointmentsMonth,
      limite: usage.limits.appointmentsMonth,
    },
  ];

  return (
    <div className="mt-5 flex flex-col gap-5">
      {/* ---------- uso contra o limite ---------- */}
      <section className="flex flex-col gap-2.5">
        <span className="tech-label">USO NO PLANO {getPlan(company.planId).name}</span>
        {eixos.map((e) => {
          // Estourado não é o mesmo que cheio: o plano permite, o limite já foi
          // ultrapassado, e quem olha precisa ver isso sem contar os dígitos.
          const estourado = e.limite !== null && e.atual > e.limite;
          return (
            <div key={e.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] text-ink-dim">{e.label}</span>
                <span
                  className={cn(
                    'font-mono text-[11px] tnum',
                    estourado ? 'text-critical' : 'text-ink',
                  )}
                >
                  {formatInt(e.atual)}
                  <span className="text-ink-faint">/{limitLabel(e.limite, '∞')}</span>
                </span>
              </div>
              <ProgressBar value={usoPct(e.atual, e.limite)} label={e.label} />
            </div>
          );
        })}
      </section>

      {/* ---------- assinatura ---------- */}
      <section className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <span className="tech-label">ASSINATURA</span>
        {sub ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              ['SITUAÇÃO', sub.status],
              ['MENSALIDADE', formatBRL(sub.priceCents)],
              [
                'GATEWAY',
                // A coluna nasce com 'stripe' por padrão; sem identificador
                // externo ninguém cobra nada, e dizer "stripe" mentiria.
                sub.gateway === 'none' ? 'não integrado' : sub.gateway,
              ],
              [
                'PRÓXIMA COBRANÇA',
                sub.currentPeriodEnd
                  ? formatShortDate(new Date(sub.currentPeriodEnd))
                  : 'não programada',
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[8px] border border-hud/10 bg-white/[0.02] px-3 py-2"
              >
                <dt className="tech-label">{label}</dt>
                <dd className="mt-1 truncate font-mono text-[11.5px] text-ink tnum">{value}</dd>
              </div>
            ))}
            {sub.cancelAtPeriodEnd && (
              <p className="col-span-2 rounded-[8px] border border-warn/30 bg-warn/[0.07] px-2 py-1.5 font-mono text-[9.5px] text-warn">
                cancelamento pedido — encerra no fim do período
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11.5px] text-ink-faint">
            Esta clínica não tem assinatura criada. Ela opera pelo status do contrato acima.
          </p>
        )}
      </section>

      {/* ---------- faturas ---------- */}
      <section className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <span className="tech-label">FATURAS · ÚLTIMAS {invoices.length}</span>
        {invoices.length === 0 ? (
          <p className="text-[11.5px] text-ink-faint">Nenhuma fatura emitida.</p>
        ) : (
          invoices.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-hud/10 bg-white/[0.02] px-2.5 py-2"
            >
              <span className="min-w-0">
                <span className="block font-mono text-[11px] text-ink tnum">
                  {formatShortDate(new Date(f.issuedOn))}
                </span>
                <span className="block font-mono text-[9.5px] text-ink-faint">
                  {f.paidAt ? `paga em ${formatShortDate(new Date(f.paidAt))}` : 'sem pagamento'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11.5px] text-ink tnum">
                  {formatBRL(f.amountCents)}
                </span>
                <Badge tone={INVOICE_TONE[f.status] ?? 'warn'}>{f.status}</Badge>
              </span>
            </div>
          ))
        )}
      </section>

      {/* ---------- equipe ---------- */}
      <section className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <span className="tech-label">EQUIPE · {team.length}</span>
        {team.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between gap-3 rounded-[8px] border border-hud/10 bg-white/[0.02] px-2.5 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-[11.5px] text-ink">{m.name}</span>
              <span className="block truncate text-[10px] text-ink-faint">{m.email}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-[9.5px] text-hud">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
              {/* "nunca acessou" e não a data do convite: um acesso parado não
                  pode parecer ativo só porque foi criado recentemente. */}
              <span className="font-mono text-[9.5px] text-ink-faint">
                {m.lastSignInAt ? relativeTime(m.lastSignInAt) : 'nunca acessou'}
              </span>
            </span>
          </div>
        ))}

        {invites.length > 0 && (
          <>
            <span className="mt-1 tech-label">CONVITES ABERTOS · {invites.length}</span>
            {invites.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-warn/25 bg-warn/[0.05] px-2.5 py-2"
              >
                <span className="min-w-0 truncate text-[11px] text-ink-dim">{c.email}</span>
                <span className="shrink-0 font-mono text-[9.5px] text-warn">
                  {ROLE_LABEL[c.role] ?? c.role} · vence {formatShortDate(new Date(c.expiresAt))}
                </span>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ---------- auditoria ---------- */}
      <section className="flex flex-col gap-1.5 border-t border-hud/12 pt-4">
        <span className="tech-label">ATIVIDADE RECENTE</span>
        {audit.length === 0 ? (
          <p className="text-[11.5px] text-ink-faint">Nada registrado ainda.</p>
        ) : (
          audit.map((l) => (
            <div key={l.id} className="flex items-baseline gap-2 py-0.5">
              <span className="shrink-0 font-mono text-[9.5px] text-ink-faint tnum">
                {relativeTime(l.at)}
              </span>
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-ink-dim">
                <strong className="font-medium text-ink">{l.actor}</strong> {l.message}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

export function Companies() {
  const navigate = useNavigate();
  const { enterCompany, can } = useSession();
  const { companies, plans, loaded } = usePlatform();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CompanyStatus | 'all'>('all');
  const [planId, setPlanId] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('lastActivityAt');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * O painel lateral guarda o **id**, não a empresa.
   *
   * Suspender uma empresa com o painel aberto altera a lista do store; se a
   * cópia estivesse presa no estado local, o painel continuaria mostrando
   * "ativo" logo depois do clique que suspendeu.
   */
  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (planId !== 'all' && c.planId !== planId) return false;
      if (!q) return true;
      // Busca por nome, responsável, e-mail e cidade — é como um admin procura
      // uma empresa quando só lembra de um pedaço.
      return (
        c.name.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'users') return b.users - a.users;
      return new Date(b[sort]).getTime() - new Date(a[sort]).getTime();
    });
  }, [companies, query, status, planId, sort]);

  function access(company: Company) {
    enterCompany(company.id);
    navigate('/app/dashboard');
  }

  const columns: Array<Column<Company>> = [
    {
      key: 'company',
      header: 'Empresa',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] font-display text-[10px] font-semibold"
            style={{
              background: `color-mix(in oklab, var(--color-hud) 14%, transparent)`,
              color: 'var(--color-hud)',
            }}
          >
            {c.name.replace('CLÍNICA ', '').slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-ink">{c.name}</span>
            <span className="block truncate text-[10.5px] text-ink-faint">
              {c.city}/{c.state}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Responsável',
      hideUntil: 'lg',
      render: (c) => (
        <span className="min-w-0">
          <span className="block truncate text-[12px] text-ink-dim">{c.ownerName}</span>
          <span className="block truncate text-[10.5px] text-ink-faint">{c.ownerEmail}</span>
        </span>
      ),
    },
    {
      key: 'plan',
      header: 'Plano',
      hideUntil: 'sm',
      render: (c) => (
        <span className="font-mono text-[11px] tracking-wider text-hud">{getPlan(c.planId).name}</span>
      ),
    },
    {
      key: 'users',
      header: 'Usuários',
      align: 'right',
      hideUntil: 'md',
      render: (c) => (
        <span className="font-mono text-[11px] text-ink tnum">
          {c.users}
          <span className="text-ink-faint">/{limitLabel(getPlan(c.planId).limits.users, '∞')}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <Badge tone={STATUS_META[c.status].tone}>{STATUS_META[c.status].label}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Cadastro',
      hideUntil: 'xl',
      render: (c) => (
        <span className="font-mono text-[11px] text-ink-faint tnum">{formatShortDate(new Date(c.createdAt))}</span>
      ),
    },
    {
      // "Atividade", não "último acesso": o banco não tem sessões, tem
      // auditoria. O rótulo diz o que o número é.
      key: 'lastActivity',
      header: 'Atividade',
      hideUntil: 'lg',
      render: (c) => (
        <span className="text-[11.5px] text-ink-faint">{relativeTime(c.lastActivityAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(c.id);
          }}
          className="grid h-7 w-7 place-items-center rounded-[8px] border border-transparent text-ink-faint transition-all duration-150 hover:border-hud/40 hover:text-hud"
          aria-label={`Ações de ${c.name}`}
        >
          <MoreHorizontal size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <HolographicPanel
        title="Empresas"
        meta={`${formatInt(rows.length)} DE ${formatInt(companies.length)}`}
        icon={<Building2 size={14} />}
        bodyClassName="holo-body"
      >
        {/* ---------- busca e filtros ---------- */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="group relative flex flex-1 items-center">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 text-ink-faint transition-colors group-focus-within:text-hud"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por empresa, responsável, e-mail ou cidade"
                className="w-full rounded-[8px] border border-stroke/70 bg-void/50 py-2.5 pl-9 pr-9 text-[12.5px] text-ink outline-none transition-all duration-200 placeholder:text-ink-faint/60 focus:border-hud/60 focus:bg-hud/[0.04]"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 text-ink-faint transition-colors hover:text-hud"
                  aria-label="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </label>

            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim outline-none transition-colors focus:border-hud/60"
            >
              <option value="all">Todos os planos</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length])
              }
              className="flex items-center justify-center gap-2 rounded-[8px] border border-stroke/70 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:border-hud/50 hover:text-hud"
            >
              <ArrowUpDown size={12} />
              {SORT_LABEL[sort]}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={cn(
                  'rounded-[8px] border px-2.5 py-1.5 font-mono text-[10px] transition-all duration-200',
                  status === f.value
                    ? 'border-hud/50 bg-hud/12 text-hud'
                    : 'border-stroke/60 text-ink-faint hover:border-hud/30 hover:text-ink-dim',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(c) => setSelectedId(c.id)}
          empty={
            loaded
              ? 'Ajuste a busca ou os filtros para encontrar a empresa.'
              : 'Carregando as empresas da plataforma…'
          }
        />
      </HolographicPanel>

      {/* ---------- painel de ações ---------- */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm"
              aria-hidden
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              // Mais larga desde que virou perfil: com 380px as barras de uso e
              // as linhas de fatura quebravam em duas.
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-hud/20 bg-abyss/95 backdrop-blur-xl"
              role="dialog"
              aria-label={`Ações de ${selected.name}`}
            >
              <header className="flex items-start justify-between gap-3 border-b border-hud/12 p-5">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[14px] font-semibold text-ink">
                    {selected.name}
                  </h2>
                  <p className="mt-1 truncate text-[11.5px] text-ink-faint">
                    {selected.ownerName} · {selected.ownerEmail}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="shrink-0 text-ink-faint transition-colors hover:text-hud"
                  aria-label="Fechar"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-5">
                {/* Usuários, profissionais e clientes saíram daqui: o bloco de
                    uso no plano, logo abaixo, dá os mesmos números **com o
                    teto ao lado**, que é a forma útil de lê-los. Mantê-los nos
                    dois lugares seria a regra 8 esperando o dia em que uma das
                    duas fontes atrasasse. */}
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ['STATUS', STATUS_META[selected.status].label.toUpperCase()],
                    ['PLANO', getPlan(selected.planId).name],
                    ['FATURAMENTO', formatBRLCompact(selected.monthlyRevenueCents)],
                    ['CIDADE', `${selected.city}/${selected.state}`],
                    ['CNPJ', selected.document || '—'],
                    ['CADASTRO', formatShortDate(new Date(selected.createdAt))],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[8px] border border-hud/10 bg-white/[0.02] px-3 py-2.5"
                    >
                      <dt className="tech-label">{label}</dt>
                      <dd className="mt-1 truncate font-mono text-[12px] text-ink tnum">{value}</dd>
                    </div>
                  ))}
                </dl>

                <CompanyProfile company={selected} />

                {/* ---------- o que o administrador de fato altera ---------- */}
                {can('platform.companies.manage') && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-hud/12 pt-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="tech-label">STATUS DO CONTRATO</span>
                      <select
                        value={selected.status}
                        onChange={(e) =>
                          updateCompany(selected.id, {
                            status: e.target.value as CompanyStatus,
                          })
                        }
                        className="rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink outline-none transition-colors focus:border-hud/60"
                      >
                        {STATUS_FILTERS.filter((f) => f.value !== 'all').map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="tech-label">PLANO CONTRATADO</span>
                      <select
                        value={selected.planId}
                        onChange={(e) => updateCompany(selected.id, { planId: e.target.value })}
                        className="rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink outline-none transition-colors focus:border-hud/60"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Nome, endereço e horários são da clínica. Editá-los
                        daqui criaria um segundo caminho de escrita para os
                        mesmos campos que a tela de configurações já grava. */}
                    <p className="text-[10.5px] leading-relaxed text-ink-faint">
                      Cadastro, endereço e horários são editados pela própria clínica, em
                      <strong className="text-ink-dim"> Configurações</strong>. Daqui muda o que é
                      contrato.
                    </p>
                  </div>
                )}
              </div>

              <footer className="flex flex-col gap-2 border-t border-hud/12 p-5">
                {can('platform.impersonate') && (
                  <button
                    onClick={() => access(selected)}
                    className="group flex items-center justify-center gap-2 rounded-[8px] border border-hud/50 bg-hud/12 py-3 font-mono text-[10px] text-hud transition-all duration-200 hover:bg-hud/20"
                  >
                    <LogIn size={13} />
                    Acessar ambiente
                  </button>
                )}
                {can('platform.companies.manage') && (
                  <TechButton
                    variant={selected.status === 'suspended' ? 'primary' : 'critical'}
                    icon={<ShieldOff size={12} />}
                    onClick={() =>
                      updateCompany(selected.id, {
                        status: selected.status === 'suspended' ? 'active' : 'suspended',
                      })
                    }
                  >
                    {selected.status === 'suspended' ? 'Reativar empresa' : 'Suspender empresa'}
                  </TechButton>
                )}
                <p className="text-center text-[10px] leading-relaxed text-ink-faint">
                  Acessar o ambiente registra uma entrada em <strong>system logs</strong> e exibe a
                  faixa de modo administrador para todo o período da sessão.
                </p>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
