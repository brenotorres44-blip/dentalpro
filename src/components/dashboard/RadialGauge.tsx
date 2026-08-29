import { useId } from 'react';
import { motion } from 'motion/react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useCountUp } from '@/hooks/useCountUp';

const TICKS = 44;

/**
 * Medidor circular holográfico.
 *
 * O arco é um `strokeDashoffset` animado — um único atributo por frame, sem
 * recriar geometria. As marcações ao redor são estáticas e apenas mudam de
 * opacidade conforme o valor as ultrapassa.
 */
export function RadialGauge({
  value,
  size = 118,
  label = 'OCUPAÇÃO',
  delay = 0,
}: {
  /** 0 a 100. */
  value: number;
  size?: number;
  label?: string;
  delay?: number;
}) {
  const id = useId();
  const { stage } = useBoot();
  const ready = stage >= BootStage.CHARTS;
  const animated = useCountUp(ready ? value : 0, { duration: 1200, delay: delay + 200 });

  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  // Arco aberto de 270°: a lacuna inferior é o que faz o medidor parecer um
  // instrumento e não um donut de dashboard genérico.
  const arcSpan = 0.75;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * arcSpan;
  const pct = Math.max(0, Math.min(100, value)) / 100;

  const filled = Math.round(pct * TICKS);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id={`gauge-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-hud-deep)" />
            <stop offset="55%" stopColor="var(--color-hud)" />
            <stop offset="100%" stopColor="var(--color-hud-bright)" />
          </linearGradient>
        </defs>

        <g transform={`rotate(135 ${cx} ${cy})`}>
          {/* trilho */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-stroke-soft)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* arco preenchido */}
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#gauge-${id})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{ filter: 'drop-shadow(0 0 7px var(--color-hud))' }}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: ready ? arcLength * (1 - pct) : arcLength }}
            transition={{ duration: 1.25, delay: (delay + 150) / 1000, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>

        {/* marcações radiais */}
        <g>
          {Array.from({ length: TICKS }).map((_, i) => {
            const angle = (135 + (i / (TICKS - 1)) * 270) * (Math.PI / 180);
            const inner = r + 7;
            const outer = r + (i % 5 === 0 ? 13 : 10);
            const active = ready && i < filled;
            return (
              <line
                key={i}
                x1={cx + Math.cos(angle) * inner}
                y1={cy + Math.sin(angle) * inner}
                x2={cx + Math.cos(angle) * outer}
                y2={cy + Math.sin(angle) * outer}
                stroke={active ? 'var(--color-hud)' : 'var(--color-stroke)'}
                strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
                opacity={active ? 0.9 : 0.35}
                style={{
                  transition: 'opacity 380ms ease-out, stroke 380ms ease-out',
                  transitionDelay: `${delay + i * 14}ms`,
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* leitura central */}
      <div className="relative flex flex-col items-center">
        <span className="font-display text-[26px] font-semibold leading-none text-hud text-glow tnum">
          {Math.round(animated)}
          <span className="text-[15px] text-hud/60">%</span>
        </span>
        <span className="tech-label mt-1">{label}</span>
      </div>
    </div>
  );
}
