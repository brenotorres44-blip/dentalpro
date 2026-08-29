import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/utils/cn';

/**
 * Número que conta até o valor final.
 *
 * A formatação é injetada pelo chamador (`format`), então o mesmo componente
 * serve para moeda, percentual e contagem sem saber nada sobre eles.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration,
  delay,
  enabled = true,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
  delay?: number;
  enabled?: boolean;
}) {
  const animated = useCountUp(value, { duration, delay, enabled });

  return (
    <span className={cn('tnum', className)}>
      {/* O valor final fica no DOM para leitores de tela — o número em transição não é lido. */}
      <span aria-hidden>{format(animated)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
