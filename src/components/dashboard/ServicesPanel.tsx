import { motion } from 'motion/react';
import type { ServiceStat } from '@/data/types';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { rowEnter } from '@/animations/variants';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatBRL, formatInt } from '@/utils/format';

/**
 * Serviços realizados no mês, ordenados por volume.
 *
 * A barra é proporcional ao líder, não ao total: com cinco itens, escala pelo
 * total achataria todos abaixo de 35% e a comparação sumiria.
 */
export function ServicesPanel({ stats }: { stats: ServiceStat[] }) {
  const { stage, stagger } = useBoot();
  const ready = stage >= BootStage.DATA;

  const sorted = [...stats].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((s) => s.count), 1);
  const total = sorted.reduce((acc, s) => acc + s.count, 0);
  const totalRevenue = sorted.reduce((acc, s) => acc + s.revenueCents, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {sorted.map((s, i) => (
          <motion.li
            key={s.id}
            variants={rowEnter}
            custom={stagger(i, 45)}
            initial="hidden"
            animate={ready ? 'visible' : 'hidden'}
            className="group"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[9px] text-ink-faint tnum">
                  {`${i + 1}`.padStart(2, '0')}
                </span>
                <span className="truncate text-[12px] text-ink-dim transition-colors duration-200 group-hover:text-ink">
                  {s.name}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <span className="font-mono text-[10px] text-ink-faint tnum opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {formatBRL(s.revenueCents)}
                </span>
                <span className="font-display text-[13px] font-semibold text-hud tnum">
                  {formatInt(s.count)}
                </span>
              </span>
            </div>

            <ProgressBar
              value={(s.count / max) * 100}
              delay={stagger(i, 55) + 200}
              label={`${s.name}: ${s.count} procedimentos`}
            />
          </motion.li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-hud/10 pt-3">
        <span className="tech-label">TOTAL NO MÊS</span>
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] text-ink-dim tnum">{formatBRL(totalRevenue)}</span>
          <span className="font-display text-[15px] font-semibold text-hud text-glow tnum">
            {formatInt(total)}
          </span>
        </span>
      </div>
    </div>
  );
}
