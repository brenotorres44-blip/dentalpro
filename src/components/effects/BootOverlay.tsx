import { AnimatePresence, motion } from 'motion/react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useTheme } from '@/themes/ThemeProvider';

const LOG = [
  { at: BootStage.BACKGROUND, text: 'CORE' },
  { at: BootStage.LINES, text: 'DATABASE' },
  { at: BootStage.PANELS, text: 'SECURITY' },
  { at: BootStage.CHARTS, text: 'USER PROFILE · TENANT' },
  { at: BootStage.INDICATORS, text: 'THEME · SYSTEM ONLINE' },
];

/**
 * Cortina de inicialização.
 *
 * Sai de cena no estágio DATA — o painel por trás já está montado nesse ponto,
 * então a transição revela um sistema pronto em vez de uma tela ainda vazia.
 */
export function BootOverlay({ label, sub }: { label: string; sub: string }) {
  const { stage } = useBoot();
  const { theme } = useTheme();
  const visible = stage < BootStage.DATA;
  const progress = Math.min(stage / BootStage.INDICATORS, 1);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
          aria-hidden
        >
          <div
            className="tech-grid absolute inset-0"
            style={{ opacity: 0.4 * theme.effects.chrome }}
          />

          <div className="relative flex flex-col items-center gap-7">
            {/* anel que se desenha */}
            <svg width="132" height="132" viewBox="0 0 132 132" className="overflow-visible">
              <circle cx="66" cy="66" r="58" fill="none" stroke="var(--color-stroke)" strokeWidth="1" />
              <circle
                cx="66"
                cy="66"
                r="58"
                fill="none"
                stroke="var(--color-hud)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 58}
                strokeDashoffset={2 * Math.PI * 58 * (1 - progress)}
                transform="rotate(-90 66 66)"
                style={{
                  transition: 'stroke-dashoffset 260ms cubic-bezier(.22,1,.36,1)',
                  filter: 'drop-shadow(0 0 8px var(--color-hud))',
                }}
              />
              {theme.effects.chrome >= 0.5 && (
                <circle
                  cx="66"
                  cy="66"
                  r="40"
                  fill="none"
                  stroke="var(--color-hud)"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  strokeDasharray="4 10"
                  className="anim-spin-med"
                  style={{ transformOrigin: '66px 66px' }}
                />
              )}
              <text
                x="66"
                y="71"
                textAnchor="middle"
                className="font-mono"
                fill="var(--color-hud)"
                fontSize="17"
              >
                {Math.round(progress * 100)}%
              </text>
            </svg>

            <div className="text-center">
              <div className="font-display text-lg font-semibold tracking-[0.4em] text-ink">
                {label}
              </div>
              <div className="tech-label mt-1.5">{sub}</div>
            </div>

            {/* log de inicialização */}
            <div className="flex h-16 w-64 flex-col items-center gap-1">
              <AnimatePresence mode="popLayout">
                {LOG.filter((l) => stage >= l.at)
                  .slice(-3)
                  .map((l) => (
                    <motion.div
                      key={l.text}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-[10px] tracking-[0.2em] text-hud/60"
                    >
                      {l.text}
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
