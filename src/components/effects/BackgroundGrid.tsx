import { motion } from 'motion/react';
import { BootStage, useBoot } from '@/hooks/useBoot';

/**
 * O "vazio" onde o sistema vive.
 *
 * Tudo aqui é estático ou animado por transform em elementos únicos: nenhuma
 * das camadas repinta a cada frame. É o primeiro estágio do boot — o fundo
 * aparece, depois as linhas técnicas são desenhadas sobre ele.
 */
export function BackgroundGrid() {
  const { stage } = useBoot();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void" aria-hidden>
      {/* 1 — profundidade: dois focos de luz muito difusos */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: stage >= BootStage.BACKGROUND ? 1 : 0 }}
        transition={{ duration: 0.7 }}
        // Os focos de luz seguem o tema: em LUXURY o halo é dourado, em
        // CYBERPUNK é magenta. Cor fixa aqui denunciaria o tema original.
        style={{
          background: [
            'radial-gradient(70rem 46rem at 18% -10%, color-mix(in oklab, var(--color-hud-deep) calc(34% * var(--fx-glow)), transparent), transparent 62%)',
            'radial-gradient(56rem 40rem at 92% 8%, color-mix(in oklab, var(--color-electric-deep) calc(28% * var(--fx-glow)), transparent), transparent 60%)',
            'radial-gradient(46rem 46rem at 50% 118%, color-mix(in oklab, var(--color-hud) calc(14% * var(--fx-glow)), transparent), transparent 65%)',
          ].join(','),
        }}
      />

      {/* 2 — malha técnica */}
      <motion.div
        className="tech-grid absolute inset-0"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{
          opacity: stage >= BootStage.LINES ? 1 : 0,
          scale: stage >= BootStage.LINES ? 1 : 1.04,
        }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* 3 — linhas de circuito: horizontais longas com um pulso viajando */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bg-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-hud)" stopOpacity="0" />
            <stop offset="45%" stopColor="var(--color-hud)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--color-hud)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[14, 38, 62, 86].map((y, i) => (
          <motion.line
            key={y}
            x1="0"
            x2="100%"
            y1={`${y}%`}
            y2={`${y}%`}
            stroke="url(#bg-line)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: stage >= BootStage.LINES ? 1 : 0,
              opacity: stage >= BootStage.LINES ? 1 : 0,
            }}
            transition={{ duration: 1, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>

      {/* 4 — vinheta: puxa o olho para o centro da tela */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, transparent 35%, color-mix(in oklab, var(--color-void) 55%, transparent) 78%, color-mix(in oklab, var(--color-void) 92%, transparent) 100%)',
        }}
      />
    </div>
  );
}
