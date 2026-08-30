import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import type { NavItem } from '@/config/navigation';
import { useSession } from '@/auth/SessionProvider';
import { BootStage, useBoot } from '@/hooks/useBoot';

/**
 * Atalhos da tela inicial — um quadrado por módulo, para entrar direto em vez
 * de procurar no menu lateral. Mesma lista de `APP_NAV`/`ADMIN_NAV`, então um
 * módulo novo aparece aqui sozinho, sem precisar editar duas telas.
 */
export function QuickAccess({ items, exclude }: { items: NavItem[]; exclude?: string }) {
  const { can } = useSession();
  const { stage, stagger } = useBoot();
  const ready = stage >= BootStage.PANELS;

  const visible = items.filter(
    (item) => item.to !== exclude && (!item.capability || can(item.capability)),
  );

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {visible.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, y: 8 }}
            animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.25, delay: stagger(i, 30) / 1000 }}
          >
            <Link
              to={item.to}
              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-[14px] border border-stroke bg-panel p-2 text-center transition-colors hover:border-hud/40 hover:bg-hud/[0.05]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-hud/10 text-hud transition-transform duration-150 group-hover:scale-105">
                <Icon size={18} />
              </span>
              <span className="line-clamp-2 text-[11.5px] font-medium leading-tight text-ink-dim group-hover:text-ink">
                {item.label}
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
