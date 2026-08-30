import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { useSession } from '@/auth/SessionProvider';
import { ROLE_LABEL } from '@/data/saas';
import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

export function TopBar({
  title,
  subtitle,
  onOpenMenu,
}: {
  title: string;
  subtitle: string;
  onOpenMenu: () => void;
}) {
  const { stage } = useBoot();
  const { session, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const ready = stage >= BootStage.LINES;

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between gap-4',
        'border-b border-stroke bg-panel px-4 sm:px-6',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-stroke text-ink-dim transition-colors hover:border-hud/40 hover:text-hud md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={16} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate font-display text-[16px] font-semibold text-ink sm:text-[18px]">
            {title}
          </h1>
          <div className="truncate text-[12px] text-ink-faint">{subtitle}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <button
          className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-stroke text-ink-dim transition-colors hover:border-hud/40 hover:text-hud"
          aria-label="Notificações — 2 não lidas"
        >
          <Bell size={15} />
          <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-critical text-[9px] font-bold text-white">
            2
          </span>
        </button>

        {/* --- usuário -------------------------------------------------- */}
        {session && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-[10px] border border-stroke py-1 pl-1 pr-2 transition-colors hover:border-hud/40"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-hud/12 font-display text-[10px] font-semibold text-hud">
                {initials(session.user.name)}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block max-w-[120px] truncate text-[11.5px] font-medium leading-tight text-ink">
                  {session.user.name}
                </span>
                <span className="text-[10.5px] text-ink-faint">{ROLE_LABEL[session.user.role]}</span>
              </span>
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    className="holo-panel absolute right-0 top-[calc(100%+8px)] z-20 w-56 p-1"
                    role="menu"
                  >
                    <div className="border-b border-stroke px-3 py-2.5">
                      <div className="truncate text-[12px] font-medium text-ink">
                        {session.user.name}
                      </div>
                      <div className="truncate text-[11px] text-ink-faint">{session.user.email}</div>
                    </div>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[12px] text-ink-dim transition-colors hover:bg-critical/10 hover:text-critical"
                      role="menuitem"
                    >
                      <LogOut size={13} />
                      Encerrar sessão
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.header>
  );
}
