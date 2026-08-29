import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Vazio explicado.
 *
 * Nunca só "nenhum resultado": a lista diz por que está vazia e qual é o
 * próximo gesto. Um vazio mudo faz o usuário duvidar se o sistema carregou.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-[4px] border border-hud/20 bg-hud/[0.05] text-hud/70">
        <Icon size={20} strokeWidth={1.4} />
      </span>
      <div>
        <p className="font-display text-[12px] uppercase tracking-[0.2em] text-ink-dim">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[11.5px] leading-relaxed text-ink-faint">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
