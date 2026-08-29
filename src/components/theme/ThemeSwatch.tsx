import { Check } from 'lucide-react';
import type { Theme } from '@/themes/tokens';
import { cn } from '@/utils/cn';

/**
 * Miniatura de um tema.
 *
 * Pinta com estilo inline a partir dos tokens do próprio tema, e não com as
 * variáveis CSS globais: é o que permite mostrar os seis lado a lado, cada um
 * com sua paleta real, sem que o tema ativo contamine as amostras.
 */
export function ThemeSwatch({
  theme,
  selected = false,
  onSelect,
}: {
  theme: Theme;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = theme.tokens;
  const Element = onSelect ? 'button' : 'div';

  return (
    <Element
      onClick={onSelect}
      type={onSelect ? 'button' : undefined}
      aria-pressed={onSelect ? selected : undefined}
      className={cn(
        'group relative block w-full overflow-hidden rounded-[3px] border text-left transition-all duration-200',
        selected
          ? 'border-hud/70 shadow-[0_0_28px_-10px_var(--color-hud)]'
          : 'border-stroke/60 hover:border-hud/40',
      )}
    >
      {/* prévia */}
      <div className="relative h-[104px] overflow-hidden p-2.5" style={{ background: t.void }}>
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `linear-gradient(to right, ${t.hud}14 1px, transparent 1px), linear-gradient(to bottom, ${t.hud}14 1px, transparent 1px)`,
            backgroundSize: '14px 14px',
          }}
        />
        <div
          className="absolute -right-6 -top-8 h-24 w-24 rounded-full"
          style={{ background: `radial-gradient(circle, ${t.hud}33, transparent 70%)` }}
        />

        {/* painel falso */}
        <div
          className="relative flex h-full flex-col gap-1.5 rounded-[2px] p-2"
          style={{
            background: `linear-gradient(160deg, ${t.elevated}dd, ${t.abyss}ee)`,
            border: `1px solid ${t.hud}33`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: t.hud, boxShadow: `0 0 6px ${t.hud}` }}
            />
            <span
              className="h-1 w-10 rounded-full"
              style={{ background: t.ink, opacity: 0.55 }}
            />
            <span className="ml-auto h-1 w-5 rounded-full" style={{ background: t['ink-faint'] }} />
          </div>

          <div className="flex items-end gap-1">
            {[0.45, 0.7, 0.35, 0.9, 0.6, 1, 0.5].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-t-[1px]"
                style={{
                  height: `${h * 30}px`,
                  background: i === 5 ? t['hud-bright'] : `${t.hud}99`,
                  boxShadow: i === 5 ? `0 0 8px ${t.hud}` : undefined,
                }}
              />
            ))}
          </div>

          <div className="mt-auto flex items-center gap-1.5">
            <span className="h-1 flex-1 rounded-full" style={{ background: `${t.electric}88` }} />
            <span className="h-1 w-4 rounded-full" style={{ background: t.critical }} />
          </div>
        </div>
      </div>

      {/* identificação */}
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-2"
        style={{ background: t.abyss, borderTop: `1px solid ${t.hud}22` }}
      >
        <span className="min-w-0">
          <span
            className="block truncate font-display text-[10.5px] font-semibold tracking-[0.14em]"
            style={{ color: t.ink }}
          >
            {theme.name}
          </span>
          <span className="block truncate text-[9.5px]" style={{ color: t['ink-faint'] }}>
            {theme.mode === 'light' ? 'CLARO' : 'ESCURO'} · {theme.tagline}
          </span>
        </span>

        {selected && (
          <span
            className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full"
            style={{ background: t.hud, color: t.void, height: 18, width: 18 }}
          >
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </div>
    </Element>
  );
}
