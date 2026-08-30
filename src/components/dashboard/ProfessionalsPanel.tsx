import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import type { Professional, ProfessionalStatus } from '@/data/types';
import { cn } from '@/utils/cn';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { rowEnter } from '@/animations/variants';
import { HolographicAvatar } from './HolographicAvatar';
import { StatusIndicator, type Tone } from '@/components/ui/StatusIndicator';

const STATUS: Record<ProfessionalStatus, { label: string; tone: Tone; pulse: boolean }> = {
  atendendo: { label: 'ATENDENDO', tone: 'live', pulse: true },
  disponivel: { label: 'DISPONÍVEL', tone: 'ok', pulse: false },
  descanso: { label: 'DESCANSO', tone: 'warn', pulse: false },
  offline: { label: 'OFFLINE', tone: 'idle', pulse: false },
};

export function ProfessionalsPanel({ professionals }: { professionals: Professional[] }) {
  const { stage, stagger } = useBoot();
  const ready = stage >= BootStage.DATA;

  return (
    <ul className="flex flex-col gap-1.5">
      {professionals.map((p, i) => {
        const s = STATUS[p.status];
        return (
          <motion.li
            key={p.id}
            variants={rowEnter}
            custom={stagger(i, 50)}
            initial="hidden"
            animate={ready ? 'visible' : 'hidden'}
            className={cn(
              'group flex items-center gap-3 rounded-[8px] border border-transparent',
              'bg-white/[0.015] px-3 py-2.5 transition-all duration-200 ease-out',
              'hover:border-hud/25 hover:bg-hud/[0.05]',
              p.status === 'offline' && 'opacity-60 hover:opacity-100',
            )}
          >
            <HolographicAvatar name={p.name} status={p.status} hue={p.hue} />

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{p.name}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <StatusIndicator tone={s.tone} pulse={s.pulse} label={s.label} compact />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="font-mono text-[11px] text-ink-dim tnum">{p.shift}</div>
              <div className="mt-0.5 flex items-center justify-end gap-2">
                <span className="font-mono text-[11px] text-hud tnum">
                  {p.appointmentsToday}
                  <span className="ml-0.5 text-[9px] text-ink-faint">at.</span>
                </span>
                <span className="flex items-center gap-0.5 font-mono text-[10px] text-warn tnum opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Star size={9} fill="currentColor" />
                  {p.rating.toFixed(1)}
                </span>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
