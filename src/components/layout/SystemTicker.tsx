import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { SYSTEM_CHANNELS } from '@/data/mock';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/utils/cn';
import { useTheme } from '@/themes/ThemeProvider';

/**
 * Faixa de telemetria do rodapé.
 *
 * Decorativa — por isso `aria-hidden`: repetir "SYNC 100%" num leitor de tela
 * a cada quatro segundos seria ruído puro. O throughput oscila levemente para
 * que a barra pareça medir algo, não exibir um texto fixo.
 */
export function SystemTicker() {
  const { stage } = useBoot();
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  const [throughput, setThroughput] = useState(1.24);
  const [latency, setLatency] = useState(18);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setThroughput(Number((1 + Math.random() * 0.9).toFixed(2)));
      setLatency(Math.round(12 + Math.random() * 14));
    }, 3200);
    return () => window.clearInterval(id);
  }, [reduced]);

  // Telemetria decorativa é a primeira coisa a sair num tema sóbrio: ela
  // anuncia "sistema de ficção científica" antes de qualquer outro elemento.
  if (theme.effects.chrome < 0.4) return null;

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: stage >= BootStage.INDICATORS ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className="sticky bottom-0 z-20 flex h-9 items-center gap-5 overflow-hidden border-t border-hud/10 bg-abyss/70 px-4 backdrop-blur-xl sm:px-6"
      aria-hidden
    >
      <div className="flex items-center gap-5 overflow-hidden">
        {SYSTEM_CHANNELS.map((c, i) => (
          <span
            key={c.label}
            // Os canais entram conforme a largura permite; o primeiro nunca sai.
            className={cn(
              'shrink-0 items-center gap-1.5',
              i === 0 && 'flex',
              i === 1 && 'hidden sm:flex',
              i === 2 && 'hidden lg:flex',
              i >= 3 && 'hidden xl:flex',
            )}
          >
            <StatusIndicator tone="ok" pulse={i === 0} />
            <span className="tech-label text-success/70">{c.label}</span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        <span className="tech-label tnum hidden sm:inline">
          THROUGHPUT <span className="text-hud">{throughput.toFixed(2)} MB/S</span>
        </span>
        <span className="tech-label tnum">
          LAT <span className="text-hud">{latency}MS</span>
        </span>
      </div>
    </motion.footer>
  );
}
