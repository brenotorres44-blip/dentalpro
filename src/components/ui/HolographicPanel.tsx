import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { panelEnter } from '@/animations/variants';

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
  /** Mantido pela assinatura antiga; o cartão não tem mais varredura. */
  scan?: boolean;
  /** Estágio de boot a partir do qual o painel existe. */
  stage?: number;
}

/**
 * Cartão base de todo módulo do painel — o mesmo em toda tela, para que dez
 * módulos diferentes leiam como um sistema só. Sem moldura, sem varredura:
 * só cor sólida, borda estrutural e um título simples.
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
  stage = BootStage.PANELS,
}: HolographicPanelProps) {
  const boot = useBoot();
  const visible = boot.stage >= stage;

  return (
    <motion.section
      variants={panelEnter}
      custom={delay}
      initial="hidden"
      animate={visible ? 'visible' : 'hidden'}
      className={cn(
        'holo-panel flex flex-col overflow-hidden',
        tone === 'critical' && 'holo-panel--critical',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-stroke px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-hud">{icon}</span>}
            {title && (
              <h2 className="truncate font-display text-[13.5px] font-semibold text-ink">{title}</h2>
            )}
            {meta && <span className="tech-label shrink-0 whitespace-nowrap">{meta}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}

      <div className={cn('flex-1', bodyClassName ?? 'holo-body')}>{children}</div>
    </motion.section>
  );
}
