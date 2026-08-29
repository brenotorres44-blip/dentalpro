import { useId, useMemo } from 'react';
import { motion } from 'motion/react';
import { BootStage, useBoot } from '@/hooks/useBoot';

/**
 * Micrográfico de linha do card.
 *
 * SVG à mão em vez de uma biblioteca: são 30 pontos sem eixo, sem tooltip e sem
 * legenda — trazer um motor de gráficos para isso custaria mais que desenhar.
 * O traço é animado por `pathLength`, que a GPU resolve sem recalcular o path.
 */
export function Sparkline({
  data,
  color = 'var(--color-hud)',
  height = 44,
  delay = 0,
}: {
  data: number[];
  color?: string;
  height?: number;
  delay?: number;
}) {
  const id = useId();
  const { stage } = useBoot();
  const ready = stage >= BootStage.CHARTS;

  const { line, area, last } = useMemo(() => {
    if (data.length < 2) return { line: '', area: '', last: { x: 0, y: 0 } };
    const w = 100;
    const h = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;

    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - ((v - min) / span) * (h * 0.82) - h * 0.09,
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;

    return { line, area, last: points[points.length - 1] };
  }, [data]);

  if (!line) return null;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ height }}
      className="w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-fill-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.path
        d={area}
        fill={`url(#spark-fill-${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.6, delay: (delay + 380) / 1000 }}
      />

      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: ready ? 1 : 0 }}
        transition={{ duration: 1.1, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* ponto de leitura atual */}
      <motion.circle
        cx={last.x}
        cy={last.y}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0 }}
        transition={{ duration: 0.3, delay: (delay + 900) / 1000 }}
      />
    </svg>
  );
}
