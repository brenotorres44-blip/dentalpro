import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { CornerBrackets } from './CornerBrackets';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { panelEnter } from '@/animations/variants';
import { useTheme } from '@/themes/ThemeProvider';

interface HolographicPanelProps {
  title?: string;
  /** Texto pequeno à direita do título — contagem, período, unidade. */
  meta?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Atraso de entrada em ms, para escalonar painéis dentro de uma linha. */
  delay?: number;
  tone?: 'default' | 'critical';
  /** Varredura contínua sobre o painel. Use em no máximo um painel por tela. */
  scan?: boolean;
  /** Estágio de boot a partir do qual o painel existe. */
  stage?: number;
}

/**
 * Contêiner base de todo módulo do painel.
 *
 * Uma única camada de blur (aninhar backdrop-filter é o jeito mais rápido de
 * derrubar o frame rate) e cabeçalho padronizado, para que dez módulos
 * diferentes leiam como um sistema só.
 */
export function HolographicPanel({
  title,
  meta,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  delay = 0,
  tone = 'default',
  scan = false,
  stage = BootStage.PANELS,
}: HolographicPanelProps) {
  const boot = useBoot();
  const { theme } = useTheme();
  const visible = boot.stage >= stage;
  // A varredura é o ornamento mais chamativo do painel; sai antes das cantoneiras.
  const showScan = scan && theme.effects.chrome >= 0.5;

  return (
    <motion.section
      variants={panelEnter}
      custom={delay}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      className={cn(
        'holo-panel group/panel flex flex-col overflow-hidden',
        tone === 'critical' && 'holo-panel--critical',
        className,
      )}
    >
      <CornerBrackets tone={tone === 'critical' ? 'critical' : 'hud'} />

      {showScan && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="anim-scanline h-8 w-full bg-gradient-to-b from-transparent via-hud/[0.07] to-transparent" />
        </div>
      )}

      {(title || actions) && (
        <header className="relative flex items-center justify-between gap-3 border-b border-hud/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="text-hud/70 transition-colors duration-200 group-hover/panel:text-hud">
                {icon}
              </span>
            )}
            {title && (
              <h2 className="truncate font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-ink">
                {title}
              </h2>
            )}
            {meta && <span className="tech-label shrink-0 whitespace-nowrap">{meta}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}

      <div className={cn('relative flex-1', bodyClassName ?? 'holo-body')}>{children}</div>
    </motion.section>
  );
}
