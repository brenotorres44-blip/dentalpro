import { motion } from 'motion/react';
import { Smile } from 'lucide-react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useCountUp } from '@/hooks/useCountUp';
import { formatBRL } from '@/utils/format';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import type { DayState } from '@/data/types';

const SIZE = 220;
const C = SIZE / 2;
const ARC_R = 92;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_R;

/**
 * Ocupação do dia — o resumo central do painel.
 *
 * Um anel de progresso simples, sem ornamento: a barra mede a ocupação de
 * verdade, e os quatro leitores abaixo são as mesmas métricas do dia
 * selecionado. Nada aqui gira ou pisca sem carregar um dado.
 */
export function HolographicCore({
  occupancy,
  appointments,
  activeProfessionals,
  avgTicketCents,
  dayState,
}: {
  occupancy: number;
  appointments: number;
  activeProfessionals: number;
  avgTicketCents: number;
  dayState: DayState;
}) {
  const { stage } = useBoot();
  const ready = stage >= BootStage.CORE;
  const animatedOccupancy = useCountUp(ready ? occupancy : 0, { duration: 1000, delay: 150 });

  const readouts = [
    { label: 'Agenda', value: `${appointments}`, unit: 'atend.' },
    { label: 'Equipe', value: `${activeProfessionals}`, unit: 'ativos' },
    { label: 'Ticket', value: formatBRL(avgTicketCents), unit: 'médio' },
    { label: 'Ocupação', value: `${Math.round(occupancy)}%`, unit: 'do dia' },
  ];

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 py-2">
      <motion.div
        className="relative w-full max-w-[220px]"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible">
          <circle cx={C} cy={C} r={ARC_R} fill="none" stroke="var(--color-stroke)" strokeWidth={8} />
          <motion.circle
            cx={C}
            cy={C}
            r={ARC_R}
            fill="none"
            stroke="var(--color-hud)"
            strokeWidth={8}
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            strokeDasharray={ARC_CIRCUMFERENCE}
            initial={{ strokeDashoffset: ARC_CIRCUMFERENCE }}
            animate={{
              strokeDashoffset: ready
                ? ARC_CIRCUMFERENCE * (1 - Math.min(occupancy, 100) / 100)
                : ARC_CIRCUMFERENCE,
            }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <Smile size={20} className="text-hud" strokeWidth={1.5} />
          <div className="mt-1 font-display text-[26px] font-semibold leading-none text-ink tnum">
            {Math.round(animatedOccupancy)}
            <span className="text-[14px] text-hud/70">%</span>
          </div>
          <div className="tech-label mt-0.5">Ocupação</div>
        </div>
      </motion.div>

      {/* rótulo de estado */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex items-center gap-2 rounded-[8px] border border-hud/20 bg-hud/[0.05] px-3 py-1.5"
      >
        <StatusIndicator tone={dayState === 'today' ? 'live' : 'idle'} pulse={dayState === 'today'} />
        <span className="text-[11px] font-medium text-hud">
          {dayState === 'today'
            ? 'Dia em andamento'
            : dayState === 'past'
              ? 'Registro histórico'
              : 'Dia agendado'}
        </span>
      </motion.div>

      {/* leitores periféricos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
      >
        {readouts.map((r) => (
          <div
            key={r.label}
            className="relative rounded-[8px] border border-hud/12 bg-white/[0.02] px-2.5 py-2 text-center transition-colors duration-200 hover:border-hud/35"
          >
            <div className="tech-label">{r.label}</div>
            <div className="mt-0.5 truncate font-display text-[13px] font-semibold text-ink tnum">
              {r.value}
            </div>
            <div className="text-[9px] text-ink-faint">{r.unit}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
