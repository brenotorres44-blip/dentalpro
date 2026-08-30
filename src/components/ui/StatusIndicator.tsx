import { cn } from '@/utils/cn';

export type Tone = 'ok' | 'live' | 'idle' | 'warn' | 'critical' | 'info';

const TONE_MAP: Record<Tone, { dot: string; text: string; ring: string; glow: string }> = {
  ok: { dot: 'bg-success', text: 'text-success', ring: 'bg-success', glow: '' },
  live: { dot: 'bg-hud', text: 'text-hud', ring: 'bg-hud', glow: '' },
  idle: { dot: 'bg-idle', text: 'text-idle', ring: 'bg-idle', glow: '' },
  warn: { dot: 'bg-warn', text: 'text-warn', ring: 'bg-warn', glow: '' },
  critical: { dot: 'bg-critical', text: 'text-critical', ring: 'bg-critical', glow: '' },
  info: { dot: 'bg-electric', text: 'text-electric', ring: 'bg-electric', glow: '' },
};

/**
 * Indicador de estado.
 *
 * O ponto luminoso é reforço, nunca o portador da informação: o rótulo em texto
 * sempre acompanha, para quem não distingue as cores e para leitores de tela.
 */
export function StatusIndicator({
  tone = 'ok',
  label,
  pulse = false,
  className,
  compact = false,
}: {
  tone?: Tone;
  label?: string;
  pulse?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const t = TONE_MAP[tone];

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        {pulse && (
          <span className={cn('absolute inset-0 rounded-full opacity-60 anim-ping', t.ring)} aria-hidden />
        )}
        <span className={cn('relative h-2 w-2 rounded-full', t.dot, t.glow)} aria-hidden />
      </span>
      {label && (
        <span
          className={cn(
            'font-mono uppercase tracking-[0.16em]',
            compact ? 'text-[9px]' : 'text-[10px]',
            t.text,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
