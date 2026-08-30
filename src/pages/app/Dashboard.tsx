import { Suspense, lazy, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  CalendarDays,
  Clock3,
  Package,
  RotateCcw,
  Smile,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Sparkline } from '@/components/dashboard/Sparkline';
import { RadialGauge } from '@/components/dashboard/RadialGauge';
import { HolographicCore } from '@/components/dashboard/HolographicCore';
import { AppointmentList } from '@/components/dashboard/AppointmentList';
import { ProfessionalsPanel } from '@/components/dashboard/ProfessionalsPanel';
import { InventoryPanel } from '@/components/dashboard/InventoryPanel';
import { ServicesPanel } from '@/components/dashboard/ServicesPanel';
import { TechCalendar } from '@/components/dashboard/TechCalendar';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { TechButton } from '@/components/ui/TechButton';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';

import { getDashboardSnapshot } from '@/services/dashboardService';
import { useOperations } from '@/services/store';
import { formatBRL, formatInt, formatLongDate, isSameDay } from '@/utils/format';
import { BootStage, useBoot } from '@/hooks/useBoot';

/**
 * O Recharts responde por ~60% do JavaScript da aplicação. Carregá-lo sob
 * demanda tira esse peso do caminho crítico: o gráfico só é montado no estágio
 * CHARTS do boot, então o chunk chega antes de fazer falta.
 */
const RevenueChart = lazy(() =>
  import('@/components/dashboard/RevenueChart').then((m) => ({ default: m.RevenueChart })),
);

const CUSTOMER_GOAL = 1400;

export function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { stage } = useBoot();

  // Recalcula tudo em um único ponto: trocar a data no calendário reconstrói o
  // painel inteiro a partir de uma fonte só, sem estados paralelos divergindo.
  // `operations` não é lido aqui: entra na lista de dependências para que uma
  // escrita em qualquer módulo (concluir um atendimento, dar baixa no estoque)
  // recomponha o painel na mesma leitura.
  const operations = useOperations();
  const snapshot = useMemo(
    () => getDashboardSnapshot(selectedDate),
    [selectedDate, operations],
  );

  const isToday = isSameDay(selectedDate, new Date());
  const selectedDay = selectedDate.getDate();

  // Últimos 14 dias até a data selecionada, sem os domingos fechados — um zero
  // no meio da série achata todo o resto do micrográfico.
  const sparkData = useMemo(
    () =>
      snapshot.revenueSeries
        .slice(Math.max(0, selectedDay - 14), Math.max(2, selectedDay))
        .map((p) => p.value)
        .filter((v) => v > 0),
    [snapshot.revenueSeries, selectedDay],
  );

  /** Líder por volume — precisa ser o mesmo do painel de serviços logo abaixo. */
  const topService = useMemo(
    () => [...snapshot.serviceStats].sort((a, b) => b.count - a.count)[0],
    [snapshot.serviceStats],
  );

  const activeProfessionals = snapshot.professionals.filter((p) => p.status !== 'offline').length;
  const paidAppointments = snapshot.appointments.filter(
    (a) => a.status !== 'cancelado' && a.status !== 'falta',
  );
  const avgTicket = paidAppointments.length
    ? Math.round(snapshot.dayRevenueCents / paidAppointments.length)
    : 0;
  const lowStock = snapshot.inventory.filter((p) => p.qty < p.min).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- faixa de contexto ------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={stage >= BootStage.PANELS ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-hud/25 bg-hud/[0.06] text-hud">
            <CalendarDays size={16} />
          </span>
          <div>
            <div className="font-display text-[13px] font-semibold capitalize tracking-wide text-ink">
              {formatLongDate(selectedDate)}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusIndicator
                tone={snapshot.dayState === 'today' ? 'live' : 'idle'}
                pulse={snapshot.dayState === 'today'}
                label={
                  snapshot.dayState === 'today'
                    ? 'Hoje'
                    : snapshot.dayState === 'past'
                      ? 'Histórico'
                      : 'Agendado'
                }
                compact
              />
              <span className="tech-label">
                {snapshot.appointments.length} ATENDIMENTOS · {formatBRL(snapshot.dayRevenueCents)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lowStock > 0 && (
            <span className="flex items-center gap-1.5 rounded-[8px] border border-critical/35 bg-critical/10 px-2.5 py-1.5">
              <StatusIndicator tone="critical" pulse />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-critical">
                {lowStock} {lowStock === 1 ? 'item crítico' : 'itens críticos'}
              </span>
            </span>
          )}
          <TechButton
            variant="primary"
            icon={<RotateCcw size={12} />}
            onClick={() => setSelectedDate(new Date())}
            disabled={isToday}
          >
            Hoje
          </TechButton>
        </div>
      </motion.div>

      {/* ---------- grade principal --------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        {/* ===== indicadores ===== */}
        <div className="order-1 grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 xl:order-none xl:col-span-12 xl:grid-cols-4">
          <DashboardCard
            label="FATURAMENTO MENSAL"
            icon={Wallet}
            delta={snapshot.revenueDeltaPct}
            delay={0}
            value={
              <AnimatedNumber value={snapshot.revenueCents} format={formatBRL} duration={1400} delay={120} />
            }
            visual={<Sparkline data={sparkData} delay={140} />}
          />

          <DashboardCard
            label="PACIENTES CADASTRADOS"
            icon={Users}
            tone="electric"
            delay={70}
            caption={`+${snapshot.newCustomers} novos este mês`}
            value={
              <AnimatedNumber value={snapshot.totalCustomers} format={formatInt} duration={1300} delay={190} />
            }
            visual={
              <div className="flex flex-col gap-1.5 pt-2">
                <ProgressBar
                  value={(snapshot.totalCustomers / CUSTOMER_GOAL) * 100}
                  delay={420}
                  label="Progresso até a meta de clientes"
                />
                <div className="flex items-center justify-between">
                  <span className="tech-label">META</span>
                  <span className="font-mono text-[10px] text-ink-faint tnum">
                    {formatInt(CUSTOMER_GOAL)}
                  </span>
                </div>
              </div>
            }
          />

          <DashboardCard
            label="TAXA DE OCUPAÇÃO"
            icon={Activity}
            delay={140}
            delta={snapshot.occupancyDeltaPct}
            deltaSuffix="vs média do mês"
            visual={
              <div className="flex justify-center pb-1">
                <RadialGauge value={snapshot.occupancyPct} delay={220} />
              </div>
            }
          />

          <DashboardCard
            label="PROCEDIMENTOS REALIZADOS"
            icon={Smile}
            tone="success"
            delay={210}
            delta={snapshot.servicesDeltaPct}
            value={
              <AnimatedNumber value={snapshot.servicesDone} format={formatInt} duration={1200} delay={260} />
            }
            visual={
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  {snapshot.serviceStats.map((s, i) => (
                    <motion.span
                      key={s.id}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      /*
                        As faixas caminham do acento primário para o secundário
                        do tema. Antes era `hsl(186 + i*9)` — ciano literal, que
                        passou despercebido porque os seis temas são azulados o
                        bastante para o erro não aparecer. Num tema dourado a
                        barra continuava azul: é a regra 1 cobrando.
                      */
                      style={{
                        background: `color-mix(in oklab, var(--color-hud) ${Math.max(100 - i * 22, 12)}%, var(--color-electric))`,
                        boxShadow: i === 0 ? '0 0 10px -2px var(--color-hud)' : undefined,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.count / snapshot.servicesDone) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.45 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="tech-label truncate">{topService?.name ?? '—'}</span>
                  <span className="font-mono text-[10px] text-hud tnum">
                    {formatInt(topService?.count ?? 0)}
                  </span>
                </div>
              </div>
            }
          />
        </div>

        {/* ===== faturamento diário ===== */}
        <HolographicPanel
          title="Faturamento diário"
          meta={`${snapshot.revenueSeries.length} DIAS`}
          icon={<TrendingUp size={14} />}
          delay={60}
          className="order-4 md:col-span-2 xl:order-none xl:col-span-5"
          bodyClassName="flex flex-col p-4"
          actions={
            <span className="font-display text-[13px] font-semibold text-hud text-glow tnum">
              {formatBRL(snapshot.revenueCents)}
            </span>
          }
        >
          <Suspense fallback={<Skeleton className="h-full min-h-[224px] w-full" />}>
            <RevenueChart data={snapshot.revenueSeries} selectedDay={selectedDay} />
          </Suspense>
        </HolographicPanel>

        {/* ===== visão do dia ===== */}
        <HolographicPanel
          title="Visão do dia"
          icon={<Activity size={14} />}
          delay={120}
          scan
          stage={BootStage.CORE}
          className="order-3 md:col-span-1 xl:order-none xl:col-span-4"
          bodyClassName="p-4 flex-1"
          actions={<StatusIndicator tone="live" pulse label="Ao vivo" compact />}
        >
          <HolographicCore
            occupancy={snapshot.occupancyPct}
            appointments={snapshot.appointments.length}
            activeProfessionals={activeProfessionals}
            avgTicketCents={avgTicket}
            dayState={snapshot.dayState}
          />
        </HolographicPanel>

        {/* ===== agenda do dia ===== */}
        <HolographicPanel
          title="Agenda do dia"
          meta={`${snapshot.appointments.length}`}
          icon={<Clock3 size={14} />}
          delay={180}
          className="order-2 md:col-span-1 xl:order-none xl:col-span-3"
          bodyClassName="p-3 max-h-[420px] overflow-y-auto"
        >
          <AppointmentList
            appointments={snapshot.appointments}
            professionals={snapshot.professionals}
          />
        </HolographicPanel>

        {/* ===== equipe ===== */}
        <HolographicPanel
          title="Equipe"
          meta={`${activeProfessionals}/${snapshot.professionals.length} ATIVOS`}
          icon={<UserRound size={14} />}
          delay={240}
          className="order-5 md:col-span-1 xl:order-none xl:col-span-4"
          bodyClassName="p-3"
        >
          <ProfessionalsPanel professionals={snapshot.professionals} />
        </HolographicPanel>

        {/* ===== itens de consultório ===== */}
        <HolographicPanel
          title="Itens em estoque"
          meta={lowStock > 0 ? `${lowStock} EM ALERTA` : 'ESTÁVEL'}
          icon={<Package size={14} />}
          delay={300}
          tone={lowStock > 0 ? 'critical' : 'default'}
          className="order-6 md:col-span-1 xl:order-none xl:col-span-4"
        >
          <InventoryPanel items={snapshot.inventory} />
        </HolographicPanel>

        {/* ===== calendário ===== */}
        <HolographicPanel
          title="Calendário"
          icon={<CalendarDays size={14} />}
          delay={360}
          className="order-7 md:col-span-2 xl:order-none xl:col-span-4"
        >
          <TechCalendar selected={selectedDate} onSelect={setSelectedDate} />
        </HolographicPanel>

        {/* ===== procedimentos realizados ===== */}
        <HolographicPanel
          title="Procedimentos realizados"
          meta="MÊS CORRENTE"
          icon={<Smile size={14} />}
          delay={420}
          className="order-8 md:col-span-2 xl:order-none xl:col-span-12"
        >
          <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
            <ServicesPanel stats={snapshot.serviceStats} />

            <div className="flex flex-col justify-center gap-3 border-t border-hud/10 pt-4 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <span className="tech-label">DISTRIBUIÇÃO POR RECEITA</span>
              {[...snapshot.serviceStats]
                .sort((a, b) => b.revenueCents - a.revenueCents)
                .map((s, i, arr) => {
                  const total = arr.reduce((acc, x) => acc + x.revenueCents, 0);
                  const share = (s.revenueCents / total) * 100;
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-[12px] text-ink-dim">{s.name}</span>
                      <ProgressBar value={share} delay={480 + i * 60} label={s.name} />
                      <span className="w-12 shrink-0 text-right font-mono text-[11px] text-hud tnum">
                        {share.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </HolographicPanel>
      </div>
    </div>
  );
}
