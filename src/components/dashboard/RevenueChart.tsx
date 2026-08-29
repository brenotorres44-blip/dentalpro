import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'motion/react';
import type { RevenuePoint } from '@/data/types';
import { formatBRL, formatBRLCompact } from '@/utils/format';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Tooltip do sistema: moldura técnica, não a caixinha branca padrão. */
function HoloTooltip(props: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: RevenuePoint }>;
  label?: string | number;
}) {
  if (!props.active || !props.payload?.length) return null;
  const point = props.payload[0];
  return (
    <div className="holo-panel min-w-[132px] px-3 py-2">
      <div className="tech-label">DIA {point.payload?.label}</div>
      <div className="mt-1 font-display text-[15px] font-semibold text-hud text-glow tnum">
        {formatBRL(point.value ?? 0)}
      </div>
    </div>
  );
}

/**
 * Faturamento diário do mês.
 *
 * O gráfico só é montado depois do estágio CHARTS do boot — assim a animação de
 * entrada do Recharts realmente aparece, em vez de já ter terminado atrás da
 * cortina de inicialização.
 */
export function RevenueChart({
  data,
  selectedDay,
}: {
  data: RevenuePoint[];
  selectedDay: number;
}) {
  const { stage } = useBoot();
  const reduced = useReducedMotion();
  const ready = stage >= BootStage.CHARTS;

  const selected = data.find((d) => d.day === selectedDay);
  const max = Math.max(...data.map((d) => d.value), 1);

  // Domingo a clínica fecha. Zero vira lacuna em vez de despencar até o eixo:
  // um vale profundo a cada sete dias vira ruído e esconde a variação real.
  const series = data.map((d) => ({ ...d, value: d.value === 0 ? null : d.value }));

  // Ocupa toda a altura que o painel oferecer: numa linha de grade cuja altura
  // é ditada pelo núcleo ao lado, altura fixa deixaria metade do painel vazia.
  if (!ready) return <div className="h-full min-h-[224px]" aria-hidden />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative h-full min-h-[224px] w-full"
    >
      {/* malha fina por trás do gráfico — dá a leitura de "leitura de sensor" */}
      <div className="tech-grid-fine pointer-events-none absolute inset-0 opacity-30" aria-hidden />

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-hud)" stopOpacity={0.34} />
              <stop offset="60%" stopColor="var(--color-hud)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="var(--color-hud)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revenue-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-electric)" />
              <stop offset="100%" stopColor="var(--color-hud-bright)" />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--color-hud)"
            strokeOpacity={0.07}
            strokeDasharray="2 6"
            vertical={false}
          />

          <XAxis
            dataKey="label"
            axisLine={{ stroke: 'var(--color-hud)', strokeOpacity: 0.18 }}
            tickLine={false}
            interval={data.length > 20 ? 3 : 1}
            tick={{
              fill: 'var(--color-ink-faint)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
            }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            width={72}
            domain={[0, max * 1.15]}
            tickFormatter={(v: number) => formatBRLCompact(v)}
            tick={{
              fill: 'var(--color-ink-faint)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
            }}
          />

          <Tooltip
            content={<HoloTooltip />}
            cursor={{ stroke: 'var(--color-hud)', strokeOpacity: 0.35, strokeDasharray: '3 4' }}
          />

          {selected && (
            <ReferenceLine
              x={selected.label}
              stroke="var(--color-hud)"
              strokeOpacity={0.4}
              strokeDasharray="3 4"
            />
          )}

          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#revenue-stroke)"
            strokeWidth={2}
            fill="url(#revenue-fill)"
            dot={false}
            connectNulls={false}
            activeDot={{
              r: 4,
              fill: 'var(--color-hud-bright)',
              stroke: 'var(--color-void)',
              strokeWidth: 2,
            }}
            isAnimationActive={!reduced}
            animationDuration={1300}
            animationEasing="ease-out"
            // Segue o acento do tema: com ciano fixo, o gráfico continuaria azul
            // dentro do LUXURY dourado.
            style={{
              filter:
                'drop-shadow(0 0 calc(6px * var(--fx-glow)) color-mix(in oklab, var(--color-hud) 45%, transparent))',
            }}
          />

          {selected && (
            <ReferenceDot
              x={selected.label}
              y={selected.value}
              r={4.5}
              fill="var(--color-hud-bright)"
              stroke="var(--color-void)"
              strokeWidth={2}
              isFront
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
