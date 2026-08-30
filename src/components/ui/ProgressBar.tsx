import { motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/animations/variants';

type Tone = 'hud' | 'critical' | 'warn' | 'success';

const FILL: Record<Tone, string> = {
  hud: 'from-hud-deep via-hud to-hud-bright',
  critical: 'from-critical/50 via-critical to-critical',
  warn: 'from-warn/50 via-warn to-warn',
  success: 'from-success/50 via-success to-success',
};

const GLOW: Record<Tone, string> = {
  hud: '',
  critical: '',
  warn: '',
  success: '',
};

/**
 * Barra de preenchimento luminosa.
 *
 * Anima `scaleX` com origem à esquerda — largura em % dispara layout a cada
 * frame; escala roda na GPU e não toca no fluxo do documento.
 */
export function ProgressBar({
  value,
  tone = 'hud',
  delay = 0,
  className,
  pulse = false,
  label,
}: {
  /** 0 a 100. */
  value: number;
  tone?: Tone;
  delay?: number;
  className?: string;
  pulse?: boolean;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      {/* trilho com ticks técnicos */}
      <div className="tech-grid-fine absolute inset-0 opacity-40" aria-hidden />

      <motion.div
        className={cn(
          'absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gradient-to-r',
          FILL[tone],
          GLOW[tone],
          pulse && 'anim-breathe',
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ duration: 0.9, delay: delay / 1000, ease: EASE_OUT }}
      />
    </div>
  );
}
