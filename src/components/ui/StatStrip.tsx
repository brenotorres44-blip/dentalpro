import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { CornerBrackets } from './CornerBrackets';
import { useTheme } from '@/themes/ThemeProvider';

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: 'hud' | 'success' | 'warn' | 'critical' | 'electric';
}

const TONE: Record<NonNullable<Stat['tone']>, string> = {
  hud: 'text-hud',
  success: 'text-success',
  warn: 'text-warn',
  critical: 'text-critical',
  electric: 'text-electric',
};

/**
 * Régua de indicadores do topo de um módulo.
 *
 * Versão enxuta do `DashboardCard`: sem gráfico, sem variação percentual, sem
 * animação de contagem. Um módulo abre com quatro números de contexto, não com
 * um segundo dashboard competindo pela atenção.
 *
 * O número escala com a largura do próprio bloco (`cqi`), o mesmo remédio que
 * resolveu o corte do MRR no centro de comando — aqui aplicado antes de o
 * defeito aparecer.
 */
export function StatStrip({ stats, columns = 4 }: { stats: Stat[]; columns?: 3 | 4 | 5 }) {
  const { stage } = useBoot();
  const { theme } = useTheme();
  const visible = stage >= BootStage.PANELS;

  return (
    <div
      className={cn(
        'grid gap-3',
        'grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
        columns === 4 && 'lg:grid-cols-4',
        columns === 5 && 'sm:grid-cols-3 lg:grid-cols-5',
      )}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const accent = TONE[stat.tone ?? 'hud'];

        return (
          <motion.article
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="holo-panel relative flex flex-col gap-1.5 p-3.5 [container-type:inline-size]"
          >
            {theme.effects.chrome >= 0.3 && <CornerBrackets tone="faint" />}

            <div className="flex items-start justify-between gap-2">
              <span className="tech-label leading-tight">{stat.label}</span>
              {Icon && <Icon size={13} className={cn('shrink-0 opacity-70', accent)} />}
            </div>

            <div
              className={cn(
                'font-display font-semibold leading-none',
                'text-[clamp(0.95rem,9cqi,1.45rem)]',
                accent,
              )}
            >
              {stat.value}
            </div>

            {stat.hint && (
              <span className="truncate text-[10.5px] leading-tight text-ink-faint">{stat.hint}</span>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
