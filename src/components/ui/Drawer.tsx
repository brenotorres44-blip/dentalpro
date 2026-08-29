import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Painel lateral.
 *
 * Nasceu como o painel de ações da tela de empresas e virou primitivo quando
 * seis módulos passaram a precisar do mesmo gesto: a lista continua visível
 * atrás, e a ficha entra pela direita sem trocar de rota.
 *
 * No celular ocupa a largura toda — meio painel numa tela de 390px não mostra
 * nem a lista nem o formulário.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  const reduced = useReducedMotion();

  // Esc fecha, e o fundo trava para o scroll não "vazar" da ficha para a lista.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            initial={reduced ? { opacity: 0 } : { x: '100%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={
              reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 34 }
            }
            style={{ maxWidth: width }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-hud/20 bg-abyss/95 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex items-start justify-between gap-3 border-b border-hud/12 p-5">
              <div className="flex min-w-0 items-start gap-3">
                {icon && (
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[3px] border border-hud/25 bg-hud/[0.06] text-hud">
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[14px] font-semibold tracking-[0.12em] text-ink">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-1 truncate text-[11.5px] text-ink-faint">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-ink-faint transition-colors hover:text-hud"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">{children}</div>

            {footer && (
              <footer className="flex flex-col gap-2 border-t border-hud/12 p-5">{footer}</footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
