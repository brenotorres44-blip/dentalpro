import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Smile } from 'lucide-react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useCountUp } from '@/hooks/useCountUp';
import { formatBRL } from '@/utils/format';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import type { DayState } from '@/data/types';
import { useTheme } from '@/themes/ThemeProvider';
import { cn } from '@/utils/cn';

const SIZE = 300;
const C = SIZE / 2;
const TICKS = 60;

const polar = (angleDeg: number, radius: number) => {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: C + Math.cos(a) * radius, y: C + Math.sin(a) * radius };
};

/**
 * NÚCLEO OPERACIONAL — o elemento central do painel.
 *
 * Decisão deliberada: cada anel carrega um dado real. O arco externo é a
 * ocupação do dia, os pontos orbitais são os atendimentos, os quatro leitores
 * são métricas do dia selecionado. Órbita bonita sem significado envelhece em
 * uma semana; instrumento que mede alguma coisa, não.
 *
 * Custo: as rotações contínuas são CSS puro em `transform` sobre grupos SVG —
 * o React não participa do laço de animação em momento algum.
 */
export function HolographicCore({
  occupancy,
  appointments,
  activeProfessionals,
  avgTicketCents,
  dayState,
}: {
  occupancy: number;
  appointments: number;
  activeProfessionals: number;
  avgTicketCents: number;
  dayState: DayState;
}) {
  const { stage } = useBoot();
  const { theme } = useTheme();
  const ready = stage >= BootStage.CORE;

  // O núcleo simplifica em vez de sumir nos temas sóbrios: o arco de ocupação e
  // a leitura central são dado real e ficam sempre. O que sai é o adorno —
  // varredura, anéis girando, pontos orbitais e hexágono.
  const chrome = theme.effects.chrome;
  const showOrnaments = chrome >= 0.5;
  const showTicks = chrome >= 0.3;
  const animatedOccupancy = useCountUp(ready ? occupancy : 0, { duration: 1400, delay: 200 });

  const ticks = useMemo(
    () =>
      Array.from({ length: TICKS }, (_, i) => {
        const angle = (i / TICKS) * 360;
        const long = i % 5 === 0;
        const inner = polar(angle, long ? 98 : 102);
        const outer = polar(angle, 108);
        return { i, angle, long, inner, outer };
      }),
    [],
  );

  // Arco externo proporcional à ocupação.
  const arcR = 128;
  const arcCircumference = 2 * Math.PI * arcR;

  const readouts = [
    { label: 'AGENDA', value: `${appointments}`, unit: 'atend.' },
    { label: 'EQUIPE', value: `${activeProfessionals}`, unit: 'ativos' },
    { label: 'TICKET', value: formatBRL(avgTicketCents), unit: 'médio' },
    { label: 'CARGA', value: `${Math.round(occupancy)}%`, unit: 'do dia' },
  ];

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 py-2">
      <motion.div
        className="relative w-full max-w-[300px]"
        initial={{ opacity: 0, scale: 0.86 }}
        animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.86 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible">
          <defs>
            <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--color-hud)" stopOpacity="0.30" />
              <stop offset="55%" stopColor="var(--color-hud)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--color-hud)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="core-sweep" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-hud)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--color-hud)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="core-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-electric)" />
              <stop offset="100%" stopColor="var(--color-hud-bright)" />
            </linearGradient>
          </defs>

          {/* halo */}
          <circle cx={C} cy={C} r={140} fill="url(#core-glow)" />

          {showOrnaments && (
            <>
              {/* varredura giratória */}
              <g className="anim-spin-fast" style={{ transformOrigin: `${C}px ${C}px` }}>
                <path
                  d={`M${C} ${C} L${polar(0, 118).x} ${polar(0, 118).y} A118 118 0 0 1 ${polar(48, 118).x} ${polar(48, 118).y} Z`}
                  fill="url(#core-sweep)"
                />
              </g>

              {/* anel externo tracejado */}
              <circle
                cx={C}
                cy={C}
                r={142}
                fill="none"
                stroke="var(--color-hud)"
                strokeOpacity="0.16"
                strokeWidth="1"
                strokeDasharray="1 7"
                className="anim-spin-slow"
                style={{ transformOrigin: `${C}px ${C}px` }}
              />
            </>
          )}

          {/* arco de ocupação */}
          <circle cx={C} cy={C} r={arcR} fill="none" stroke="var(--color-stroke-soft)" strokeWidth="3" />
          <motion.circle
            cx={C}
            cy={C}
            r={arcR}
            fill="none"
            stroke="url(#core-arc)"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(-90 ${C} ${C})`}
            strokeDasharray={arcCircumference}
            style={{ filter: 'drop-shadow(0 0 8px var(--color-hud))' }}
            initial={{ strokeDashoffset: arcCircumference }}
            animate={{
              strokeDashoffset: ready
                ? arcCircumference * (1 - Math.min(occupancy, 100) / 100)
                : arcCircumference,
            }}
            transition={{ duration: 1.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* anel de segmentos girando ao contrário */}
          {showOrnaments && (
            <g className="anim-spin-med" style={{ transformOrigin: `${C}px ${C}px` }}>
              {[0, 120, 240].map((start) => {
                const a = polar(start, 116);
                const b = polar(start + 62, 116);
                return (
                  <path
                    key={start}
                    d={`M${a.x} ${a.y} A116 116 0 0 1 ${b.x} ${b.y}`}
                    fill="none"
                    stroke="var(--color-hud)"
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          {/* marcações */}
          <g opacity={showTicks ? 1 : 0}>
            {ticks.map((t) => (
              <motion.line
                key={t.i}
                x1={t.inner.x}
                y1={t.inner.y}
                x2={t.outer.x}
                y2={t.outer.y}
                stroke="var(--color-hud)"
                strokeWidth={t.long ? 1.5 : 0.7}
                initial={{ opacity: 0 }}
                animate={{ opacity: ready ? (t.long ? 0.55 : 0.24) : 0 }}
                transition={{ duration: 0.3, delay: 0.4 + t.i * 0.008 }}
              />
            ))}
          </g>

          {/* pontos orbitais — um por atendimento, até 12 */}
          {showOrnaments && (
            <g className="anim-spin-slow" style={{ transformOrigin: `${C}px ${C}px` }}>
              {Array.from({ length: Math.min(appointments, 12) }).map((_, i) => {
                const p = polar((i / Math.max(Math.min(appointments, 12), 1)) * 360, 88);
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="2.4"
                    fill="var(--color-hud-bright)"
                    opacity="0.85"
                    style={{ filter: 'drop-shadow(0 0 5px var(--color-hud))' }}
                  />
                );
              })}
            </g>
          )}

          {/* hexágono interno */}
          {showOrnaments && (
            <g className="anim-spin-med" style={{ transformOrigin: `${C}px ${C}px` }}>
              <polygon
                points={Array.from({ length: 6 }, (_, i) => {
                  const p = polar(i * 60, 66);
                  return `${p.x},${p.y}`;
                }).join(' ')}
                fill="none"
                stroke="var(--color-hud)"
                strokeOpacity="0.3"
                strokeWidth="1"
              />
            </g>
          )}

          {/* disco central */}
          <circle
            cx={C}
            cy={C}
            r={52}
            fill="var(--color-abyss)"
            fillOpacity="0.7"
            stroke="var(--color-hud)"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          {showOrnaments && (
            <circle
              cx={C}
              cy={C}
              r={44}
              fill="none"
              stroke="var(--color-hud)"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="3 5"
              className="anim-spin-fast"
              style={{ transformOrigin: `${C}px ${C}px` }}
            />
          )}
        </svg>

        {/* emblema + leitura central (HTML sobre o SVG: texto nítido em qualquer zoom) */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <Smile
            size={22}
            className={cn(
              'text-hud drop-shadow-[0_0_10px_var(--color-hud)]',
              showOrnaments && 'anim-float',
            )}
            strokeWidth={1.5}
          />
          <div className="mt-1 font-display text-[27px] font-semibold leading-none text-ink text-glow tnum">
            {Math.round(animatedOccupancy)}
            <span className="text-[15px] text-hud/70">%</span>
          </div>
          <div className="tech-label mt-0.5">CAPACIDADE</div>
        </div>
      </motion.div>

      {/* rótulo de estado */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="flex items-center gap-2 rounded-[3px] border border-hud/20 bg-hud/[0.05] px-3 py-1.5"
      >
        <StatusIndicator tone={dayState === 'today' ? 'live' : 'idle'} pulse={dayState === 'today'} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hud">
          {dayState === 'today'
            ? 'NÚCLEO OPERACIONAL ATIVO'
            : dayState === 'past'
              ? 'REGISTRO HISTÓRICO'
              : 'PROJEÇÃO AGENDADA'}
        </span>
      </motion.div>

      {/* leitores periféricos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.65 }}
        className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
      >
        {readouts.map((r) => (
          <div
            key={r.label}
            className="relative rounded-[3px] border border-hud/12 bg-white/[0.02] px-2.5 py-2 text-center transition-colors duration-200 hover:border-hud/35"
          >
            <div className="tech-label">{r.label}</div>
            <div className="mt-0.5 truncate font-display text-[13px] font-semibold text-ink tnum">
              {r.value}
            </div>
            <div className="text-[9px] text-ink-faint">{r.unit}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
