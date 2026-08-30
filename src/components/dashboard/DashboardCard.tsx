import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { panelEnter } from '@/animations/variants';
import { formatDelta } from '@/utils/format';
import { useTheme } from '@/themes/ThemeProvider';

/**
 * Card de indicador.
 *
 * Hierarquia fixa em todos: rótulo técnico, número-herói, variação, visual de
 * apoio. Quatro deles lado a lado precisam ser lidos como um instrumento só —
 * variar a estrutura por card destruiria isso.
 */
export function DashboardCard({
  label,
  icon: Icon,
  value,
  caption,
  delta,
  deltaSuffix = 'vs mês anterior',
  visual,
  delay = 0,
  tone = 'hud',
}: {
  label: string;
  icon: LucideIcon;
  /** Omita quando o visual já carrega o número (medidor circular, por exemplo). */
  value?: ReactNode;
  caption?: ReactNode;
  delta?: number;
  deltaSuffix?: string;
  visual?: ReactNode;
  delay?: number;
  tone?: 'hud' | 'electric' | 'success';
}) {
  const { stage } = useBoot();
  const { theme } = useTheme();
  const visible = stage >= BootStage.PANELS;
  const positive = (delta ?? 0) >= 0;
  const Trend = positive ? TrendingUp : TrendingDown;

  const accent =
    tone === 'electric' ? 'text-electric' : tone === 'success' ? 'text-success' : 'text-hud';

  return (
    <motion.article
      variants={panelEnter}
      custom={delay}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'holo-panel group relative flex flex-col gap-3 p-4',
        'transition-shadow duration-300',
        'hover:border-hud/40',
        // Referência para o `cqi` do número-herói.
        '[container-type:inline-size]',
      )}
    >
      <CornerBrackets tone="faint" />

      {/* varredura curta no hover — some sozinha se o ponteiro sair */}
      {theme.effects.chrome >= 0.5 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="anim-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-hud/[0.06] to-transparent" />
        </div>
      )}

      <header className="flex items-start justify-between gap-2">
        <span className="tech-label leading-tight">{label}</span>
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-hud/20 bg-hud/[0.06]',
            accent,
            'transition-all duration-200 group-hover:border-hud/50 group-hover:scale-105',
          )}
        >
          <Icon size={14} />
        </span>
      </header>

      <div>
        {value !== undefined && (
          <div
            className={cn(
              // Escala com a largura do próprio card: numa régua de 6 colunas
              // um valor como R$ 184.750,00 estourava a caixa e era cortado.
              'font-display font-semibold leading-none text-glow',
              'text-[clamp(1.05rem,7.5cqi,1.875rem)]',
              accent,
            )}
          >
            {value}
          </div>
        )}

        <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', value !== undefined && 'mt-2')}>
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[8px] border px-1.5 py-0.5 font-mono text-[10px] font-medium tnum',
                positive
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-critical/30 bg-critical/10 text-critical',
              )}
            >
              <Trend size={11} />
              {formatDelta(delta)}
            </span>
          )}
          {(caption || delta !== undefined) && (
            <span className="text-[11px] text-ink-faint">{caption ?? deltaSuffix}</span>
          )}
        </div>
      </div>

      {visual && <div className="mt-auto pt-1">{visual}</div>}
    </motion.article>
  );
}
