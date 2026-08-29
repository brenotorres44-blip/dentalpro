import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  LifeBuoy,
  ScrollText,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/DataTable';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { usePlatform } from '@/services/platformStore';
import { monthLabel, type MrrPoint } from '@/data/saas';
import { formatBRL, formatBRLCompact, formatInt, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Série em barras — escolha deliberada de identidade.
 *
 * O PRODENT usa área suave (leitura operacional, "como foi meu mês"); o
 * CONTROL CENTER usa barras discretas (leitura analítica, "quanto cada mês
 * fechou"). Mesma linguagem visual, gramáticas diferentes.
 */
function MrrBars({ series }: { series: MrrPoint[] }) {
  const { stage } = useBoot();
  const ready = stage >= BootStage.CHARTS;
  // `|| 1` cobre a plataforma recém-provisionada, sem assinatura ativa: dividir
  // por zero pintaria doze barras `NaN%`.
  const max = Math.max(...series.map((m) => m.valueCents), 0) || 1;

  if (!series.length) {
    return (
      <div className="grid h-[210px] place-items-center text-[12px] text-ink-faint">
        Ainda não há assinaturas para somar.
      </div>
    );
  }

  return (
    <div className="flex h-[210px] items-end gap-1.5 sm:gap-2.5">
      {series.map((m, i) => {
        const pct = (m.valueCents / max) * 100;
        const isLast = i === series.length - 1;
        return (
          <div key={m.month} className="group relative flex h-full flex-1 flex-col justify-end gap-2">
            <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-hud/30 bg-void px-1.5 py-0.5 font-mono text-[9px] text-hud opacity-0 transition-opacity duration-150 group-hover:opacity-100 tnum">
              {formatBRLCompact(m.valueCents)}
            </span>

            <motion.div
              className={cn(
                'w-full rounded-t-[2px] transition-colors duration-200',
                isLast
                  ? 'bg-gradient-to-t from-hud-deep to-hud-bright shadow-[0_0_18px_-4px_var(--color-hud)]'
                  : 'bg-gradient-to-t from-hud-deep/40 to-hud/60 group-hover:to-hud',
              )}
              initial={{ height: 0 }}
              animate={{ height: ready ? `${pct}%` : 0 }}
              transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
            <span
              className={cn(
                'text-center font-mono text-[9px] tracking-wider',
                isLast ? 'text-hud' : 'text-ink-faint',
              )}
            >
              {monthLabel(m.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminDashboard() {
  const { metrics: m, plans, companies, logs, tickets, mrrSeries } = usePlatform();

  const planDistribution = useMemo(
    () =>
      plans.map((plan) => {
        const count = companies.filter((c) => c.planId === plan.id).length;
        return {
          plan,
          count,
          share: companies.length ? (count / companies.length) * 100 : 0,
          mrrCents: count * plan.priceCents,
        };
      }),
    [plans, companies],
  );

  const companyName = useMemo(
    () => new Map(companies.map((c) => [c.id, c.name])),
    [companies],
  );

  const recentLogs = logs.slice(0, 7);
  const openTickets = tickets.filter((t) => t.status === 'open').slice(0, 5);

  // Crescimento do último mês sobre o anterior. Com menos de dois pontos na
  // série — plataforma nova — não há variação a mostrar, e `0` é uma afirmação
  // errada: o certo é não exibir o indicador.
  const growth = useMemo(() => {
    if (mrrSeries.length < 2) return undefined;
    const [prev, last] = mrrSeries.slice(-2);
    if (!prev.valueCents) return undefined;
    return Number((((last.valueCents - prev.valueCents) / prev.valueCents) * 100).toFixed(1));
  }, [mrrSeries]);

  /**
   * A mesma série significa três coisas diferentes, e o rótulo é o que separa.
   *
   * - **`faturado`** — existe fatura no banco: a série é histórico de cobrança,
   *   e cada barra é dinheiro que entrou naquele mês.
   * - **`contratado`** — modo demonstração: a série é reconstruída a partir do
   *   plano atual das empresas, e o cabeçalho diz isso em vez de deixar o
   *   administrador ler faturamento onde não há.
   * - **`nenhum`** — banco ligado, gateway ainda não: doze barras zeradas
   *   afirmariam faturamento nulo. O certo é não desenhar.
   */
  const seriesKind = m.billingIntegrated
    ? 'faturado'
    : mrrSeries.some((p) => p.valueCents > 0)
      ? 'contratado'
      : 'nenhum';

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- indicadores da plataforma ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardCard
          label="EMPRESAS ATIVAS"
          icon={Building2}
          delay={0}
          caption={`${formatInt(m.totalCompanies)} cadastradas no total`}
          value={<AnimatedNumber value={m.activeCompanies} format={formatInt} delay={100} />}
        />
        <DashboardCard
          label="NOVAS EMPRESAS"
          icon={UserPlus}
          tone="success"
          delay={50}
          caption="nos últimos 30 dias"
          value={
            <AnimatedNumber value={m.newCompanies} format={(n) => `+${formatInt(n)}`} delay={140} />
          }
        />
        {/* "Usuários", não "usuários ativos": sem tabela de sessões, o banco
            sabe quem tem acesso, não quem entrou esta semana. */}
        <DashboardCard
          label="USUÁRIOS"
          icon={Users}
          tone="electric"
          delay={100}
          caption="com acesso a alguma clínica"
          value={<AnimatedNumber value={m.users} format={formatInt} delay={180} />}
        />
        <DashboardCard
          label="FATURAMENTO MRR"
          icon={Wallet}
          delay={150}
          delta={growth}
          caption="assinaturas ativas"
          value={<AnimatedNumber value={m.mrrCents} format={formatBRL} delay={220} />}
        />
        <DashboardCard
          label="CHURN"
          icon={TrendingDown}
          delay={200}
          caption="cancelamentos em 30 dias"
          value={
            <AnimatedNumber value={m.churnPct} format={(n) => formatPercent(n, 1)} delay={260} />
          }
        />
        <DashboardCard
          label="TICKETS ABERTOS"
          icon={LifeBuoy}
          delay={250}
          caption="aguardando primeira resposta"
          value={<AnimatedNumber value={m.openTickets} format={formatInt} delay={300} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---------- MRR ---------- */}
        <HolographicPanel
          title={seriesKind === 'faturado' ? 'Faturamento' : 'Receita recorrente'}
          meta={
            seriesKind === 'faturado'
              ? '12 MESES · FATURAS PAGAS'
              : seriesKind === 'contratado'
                ? '12 MESES · VALOR CONTRATADO'
                : '12 MESES'
          }
          icon={<TrendingUp size={14} />}
          delay={60}
          className="xl:col-span-8"
          actions={
            <span className="font-display text-[13px] font-semibold text-hud text-glow tnum">
              {formatBRL(seriesKind === 'faturado' ? m.billedMonthCents : m.mrrCents)}
            </span>
          }
        >
          {seriesKind === 'nenhum' ? (
            <EmptyState
              icon={Wallet}
              title="Cobrança não integrada"
              description="Nenhuma fatura foi registrada ainda. A série de faturamento aparece quando o gateway processar a primeira cobrança — até lá, o número acima é o valor recorrente contratado, que é outra coisa."
            />
          ) : (
            <MrrBars series={mrrSeries} />
          )}
        </HolographicPanel>

        {/* ---------- distribuição por plano ---------- */}
        <HolographicPanel
          title="Distribuição por plano"
          icon={<Building2 size={14} />}
          delay={120}
          className="xl:col-span-4"
        >
          <div className="flex flex-col gap-4">
            {planDistribution.map((d, i) => (
              <div key={d.plan.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-[11px] font-semibold tracking-[0.16em] text-ink">
                    {d.plan.name}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-ink-faint tnum">
                      {formatBRLCompact(d.mrrCents)}
                    </span>
                    <span className="font-display text-[13px] font-semibold text-hud tnum">
                      {d.count}
                    </span>
                  </span>
                </div>
                <ProgressBar value={d.share} delay={200 + i * 80} label={d.plan.name} />
              </div>
            ))}

            <div className="mt-1 grid grid-cols-2 gap-2 border-t border-hud/10 pt-4">
              {(
                [
                  ['ATIVAS', m.statusCounts.active, 'ok'],
                  ['TRIAL', m.statusCounts.trial, 'live'],
                  ['SUSPENSAS', m.statusCounts.suspended, 'warn'],
                  ['CANCELADAS', m.statusCounts.canceled, 'critical'],
                ] as const
              ).map(([label, count, tone]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[3px] border border-hud/10 bg-white/[0.02] px-2.5 py-2"
                >
                  <span className="flex items-center gap-1.5">
                    <StatusIndicator tone={tone} />
                    <span className="tech-label">{label}</span>
                  </span>
                  <span className="font-mono text-[11px] text-ink tnum">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </HolographicPanel>

        {/* ---------- atividade ---------- */}
        <HolographicPanel
          title="Atividade recente"
          icon={<ScrollText size={14} />}
          delay={180}
          className="xl:col-span-7"
          bodyClassName="holo-body-compact"
          actions={
            <Link to="/admin/logs" className="tech-label transition-colors hover:text-hud">
              VER TUDO →
            </Link>
          }
        >
          <ul className="flex flex-col gap-1">
            {recentLogs.length === 0 && (
              <li className="px-2.5 py-6 text-center text-[12px] text-ink-faint">
                Nenhuma atividade registrada ainda.
              </li>
            )}
            {recentLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-3 rounded-[3px] px-2.5 py-2 transition-colors duration-150 hover:bg-hud/[0.05]"
              >
                <span className="mt-0.5 shrink-0 font-mono text-[10px] text-ink-faint tnum">
                  {new Date(log.at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-dim">
                  <span className="text-hud">{log.actor}</span> {log.message}
                </span>
              </li>
            ))}
          </ul>
        </HolographicPanel>

        {/* ---------- suporte ---------- */}
        <HolographicPanel
          title="Tickets em aberto"
          meta={`${m.openTickets}`}
          icon={<LifeBuoy size={14} />}
          delay={240}
          tone={m.openTickets > 4 ? 'critical' : 'default'}
          className="xl:col-span-5"
          bodyClassName="holo-body-compact"
          actions={
            <Link to="/admin/support" className="tech-label transition-colors hover:text-hud">
              ABRIR →
            </Link>
          }
        >
          <ul className="flex flex-col gap-1.5">
            {openTickets.length === 0 && (
              <li className="rounded-[3px] border border-dashed border-hud/10 px-3 py-6 text-center text-[11.5px] text-ink-faint">
                Nenhum chamado esperando resposta.
              </li>
            )}
            {openTickets.map((t) => {
              const company = companyName.get(t.companyId);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-[3px] border border-hud/10 bg-white/[0.015] px-3 py-2.5 transition-colors duration-150 hover:border-hud/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-ink">{t.subject}</div>
                    <div className="truncate text-[10.5px] text-ink-faint">{company}</div>
                  </div>
                  <Badge tone={t.priority === 'high' ? 'critical' : 'warn'}>
                    {t.priority === 'high' ? 'alta' : t.priority === 'normal' ? 'normal' : 'baixa'}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </HolographicPanel>
      </div>

      {/* ---------- atalho ---------- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        <Link
          to="/admin/companies"
          className="group flex items-center gap-2 rounded-[3px] border border-hud/30 bg-hud/[0.06] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hud transition-all duration-200 hover:border-hud/60 hover:bg-hud/12"
        >
          <Building2 size={13} />
          Gerenciar empresas
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </div>
  );
}
