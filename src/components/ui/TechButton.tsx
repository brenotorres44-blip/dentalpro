import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/utils/cn';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Variant = 'primary' | 'ghost' | 'critical';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'border-hud/40 bg-hud/10 text-hud hover:border-hud/80 hover:bg-hud/20 hover:shadow-[0_0_22px_-6px_var(--color-hud)]',
  ghost:
    'border-stroke/70 bg-white/[0.02] text-ink-dim hover:border-hud/50 hover:text-hud hover:bg-hud/[0.07]',
  critical:
    'border-critical/45 bg-critical/10 text-critical hover:border-critical/85 hover:bg-critical/20 hover:shadow-[0_0_22px_-6px_var(--color-critical)]',
};

/**
 * Botão do sistema, com ripple técnico no clique.
 *
 * O ripple nasce no ponto exato do ponteiro e se auto-remove: sem estado
 * acumulado, sem timers pendurados depois que o botão sai da tela.
 */
export function TechButton({
  children,
  variant = 'ghost',
  icon,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);

  return (
    <button
      {...props}
      onPointerDown={(e) => {
        if (!reduced) {
          const rect = e.currentTarget.getBoundingClientRect();
          const id = idRef.current++;
          setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
          window.setTimeout(() => setRipples((r) => r.filter((item) => item.id !== id)), 520);
        }
        props.onPointerDown?.(e);
      }}
      className={cn(
        'group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden',
        'rounded-[6px] border px-3.5 py-2',
        'text-[13px] font-medium',
        'transition-all duration-200 ease-out active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    >
      {icon && <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>}
      <span className="relative">{children}</span>

      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute -z-10 rounded-full bg-current opacity-25"
            style={{ left: r.x, top: r.y, translate: '-50% -50%' }}
            initial={{ width: 0, height: 0, opacity: 0.35 }}
            animate={{ width: 220, height: 220, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </button>
  );
}

/**
 * Botão destrutivo com confirmação embutida.
 *
 * O primeiro clique arma, o segundo executa, e o estado armado expira sozinho
 * em 4 segundos. Escolhido no lugar de um diálogo modal porque excluir um
 * serviço ou um produto é uma ação de lista: interromper a tela inteira para
 * confirmar cada uma faria o usuário parar de ler o aviso já na terceira vez.
 */
export function ConfirmButton({
  children,
  confirmLabel = 'Confirmar?',
  onConfirm,
  icon,
  className,
  disabled,
}: {
  children: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <TechButton
      variant="critical"
      icon={icon}
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </TechButton>
  );
}
