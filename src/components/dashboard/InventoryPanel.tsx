import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/data/types';
import { cn } from '@/utils/cn';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { rowEnter } from '@/animations/variants';
import { ProgressBar } from '@/components/ui/ProgressBar';

export function InventoryPanel({ items }: { items: Product[] }) {
  const { stage, stagger } = useBoot();
  const ready = stage >= BootStage.DATA;

  return (
    <ul className="flex flex-col gap-3">
      {items.map((p, i) => {
        const low = p.qty < p.min;
        const pct = (p.qty / p.capacity) * 100;

        return (
          <motion.li
            key={p.id}
            variants={rowEnter}
            custom={stagger(i, 50)}
            initial="hidden"
            animate={ready ? 'visible' : 'hidden'}
            className="group"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {low && (
                  <AlertTriangle
                    size={11}
                    className="shrink-0 text-critical anim-pulse-dot"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'truncate text-[12px] transition-colors duration-200',
                    low ? 'text-critical' : 'text-ink-dim group-hover:text-ink',
                  )}
                >
                  {p.name}
                </span>
              </span>

              <span
                className={cn(
                  'shrink-0 font-mono text-[11px] tnum',
                  low ? 'text-critical' : 'text-ink',
                )}
              >
                {p.qty}
                <span className="ml-0.5 text-[9px] text-ink-faint">{p.unit}</span>
              </span>
            </div>

            <ProgressBar
              value={pct}
              tone={low ? 'critical' : 'hud'}
              pulse={low}
              delay={stagger(i, 60) + 220}
              label={`${p.name}: ${p.qty} ${p.unit}`}
            />

            {/* O alerta é texto, não só cor — quem não distingue vermelho ainda lê. */}
            {low && (
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-critical/80">
                Estoque abaixo do mínimo ({p.min} {p.unit})
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
