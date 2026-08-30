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
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-stroke bg-panel',
          'transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:w-16 md:translate-x-0 lg:w-60',
        )}
        aria-label="Navegação principal"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-stroke px-5 md:justify-center md:px-0 lg:justify-start lg:px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hud/12 font-display text-[12px] font-bold text-hud">
            {brandMark}
          </span>
          <div className="min-w-0 md:hidden lg:block">
            <div className="truncate font-display text-[13px] font-semibold text-ink">{brandName}</div>
            <div className="truncate text-[11px] text-ink-faint">{brandSub}</div>
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
          <ul className="flex flex-col gap-0.5">
            {visible.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.li
                  key={item.to}
                  initial={{ opacity: 0, x: -8 }}
                  animate={ready ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.25, delay: stagger(i, 24) / 1000, ease: 'easeOut' }}
                >
                  <NavLink
                    to={item.to}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-[10px] px-3 py-2.5',
                        'transition-colors duration-150',
                        'md:justify-center md:px-0 lg:justify-start lg:px-3',
                        isActive
                          ? 'bg-hud/10 text-hud'
                          : 'text-ink-dim hover:bg-stroke/60 hover:text-ink',
                      )
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate text-[13.5px] font-medium md:hidden lg:inline">
                      {item.label}
                    </span>
                  </NavLink>
                </motion.li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-stroke px-4 py-3 md:px-2 lg:px-4">
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
