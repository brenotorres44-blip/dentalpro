import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { NavItem } from '@/config/navigation';
import { cn } from '@/utils/cn';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useSession } from '@/auth/SessionProvider';

/**
 * Navegação principal, compartilhada pelos dois ambientes.
 *
 * Três formas conforme o espaço: rail de ícones (md), coluna completa (lg+) e
 * gaveta sobreposta (mobile). Os itens são filtrados pelas capacidades do papel
 * — um atendente simplesmente não vê "Financeiro", em vez de vê-lo e esbarrar
 * num erro ao clicar.
 */
export function Sidebar({
  items,
  brandMark,
  brandName,
  brandSub,
  version,
  mobileOpen,
  onCloseMobile,
}: {
  items: NavItem[];
  brandMark: string;
  brandName: string;
  brandSub: string;
  version: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { stage, stagger } = useBoot();
  const { can } = useSession();
  const ready = stage >= BootStage.PANELS;

  const visible = items.filter((item) => !item.capability || can(item.capability));

  return (
    <>
      <div
        onClick={onCloseMobile}
        className={cn(
          'fixed inset-0 z-40 bg-void/80 backdrop-blur-sm transition-opacity duration-200 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-hud/12',
          'bg-abyss/85 backdrop-blur-xl',
          'transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:w-16 md:translate-x-0 lg:w-60',
        )}
        aria-label="Navegação principal"
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-hud/40 to-transparent"
          aria-hidden
        />

        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-hud/12 px-5 md:justify-center md:px-0 lg:justify-start lg:px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hud/12 font-display text-[12px] font-bold text-hud">
            {brandMark}
          </span>
          <div className="min-w-0 md:hidden lg:block">
            <div className="truncate font-display text-[12px] font-semibold tracking-[0.24em] text-ink">
              {brandName}
            </div>
            <div className="tech-label truncate">{brandSub}</div>
          </div>
          <button
            onClick={onCloseMobile}
            className="ml-auto text-ink-faint transition-colors hover:text-hud md:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 md:px-2 lg:px-2.5">
          <ul className="flex flex-col gap-1">
            {visible.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={ready ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                  transition={{ duration: 0.3, delay: stagger(i, 36) / 1000, ease: [0.22, 1, 0.36, 1] }}
                >
                  <NavLink
                    to={item.to}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-[8px] px-3 py-2.5',
                        'transition-all duration-200 ease-out',
                        'md:justify-center md:px-0 lg:justify-start lg:px-3',
                        isActive
                          ? 'bg-hud/[0.09] text-hud'
                          : 'text-ink-dim hover:bg-hud/[0.05] hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-hud"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          />
                        )}

                        <span
                          className={cn(
                            'pointer-events-none absolute inset-0 rounded-[8px] border transition-colors duration-200',
                            isActive ? 'border-hud/30' : 'border-transparent group-hover:border-hud/20',
                          )}
                          aria-hidden
                        />

                        <Icon
                          size={17}
                          className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                        />
                        <span className="truncate text-[13px] font-medium md:hidden lg:inline">
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-hud/12 px-4 py-3 md:px-2 lg:px-4">
          <div className="flex items-center justify-center gap-2 lg:justify-between">
            <span className="flex items-center gap-2">
              <StatusIndicator tone="live" pulse />
              <span className="text-[11px] font-medium text-hud md:hidden lg:inline">Online</span>
            </span>
            <span className="text-[11px] text-ink-faint md:hidden lg:inline">{version}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
