import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'ghost' | 'critical';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-hud text-white hover:bg-hud-deep',
  ghost: 'border border-stroke bg-panel text-ink-dim hover:border-hud/50 hover:text-hud',
  critical: 'bg-critical text-white hover:opacity-90',
};

/** Botão do sistema — um botão comum, sem efeito de clique nem moldura. */
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
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'rounded-[10px] px-3.5 py-2',
        'text-[13px] font-medium',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Botão destrutivo com confirmação embutida.
 *
 * O primeiro clique arma, o segundo executa, e o estado armado expira sozinho
 * em 4 segundos. Escolhido no lugar de um diálogo modal porque excluir um
 * procedimento ou um item é uma ação de lista: interromper a tela inteira
 * para confirmar cada uma faria o usuário parar de ler o aviso já na
 * terceira vez.
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
