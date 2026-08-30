import type { ReactNode } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Barra de busca e filtros.
 *
 * Os três controles saíram da tela de empresas, onde já estavam validados, e
 * viraram peças soltas. A ordem — buscar, refinar, ordenar — é a mesma em todos
 * os módulos: quem aprende a filtrar clientes já sabe filtrar produtos.
 */

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn('group relative flex flex-1 items-center', className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 text-ink-faint transition-colors group-focus-within:text-hud"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[8px] border border-stroke/70 bg-void/50 py-2.5 pl-9 pr-9 text-[12.5px] text-ink outline-none transition-all duration-200 placeholder:text-ink-faint/60 focus:border-hud/60 focus:bg-hud/[0.04]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 text-ink-faint transition-colors hover:text-hud"
          aria-label="Limpar busca"
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Contagem opcional ao lado do rótulo — mostra o tamanho do recorte. */
  count?: number;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-[8px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all duration-200',
            value === option.value
              ? 'border-hud/50 bg-hud/12 text-hud'
              : 'border-stroke/60 text-ink-faint hover:border-hud/30 hover:text-ink-dim',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1.5 text-ink-faint/70 tnum">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Ordenação em ciclo.
 *
 * Um botão que percorre as opções em vez de um seletor: são três ou quatro
 * critérios e o rótulo já diz qual está valendo, então o menu suspenso seria
 * um clique a mais para a mesma informação.
 */
export function SortCycle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <button
      type="button"
      onClick={() => {
        const index = options.findIndex((o) => o.value === value);
        onChange(options[(index + 1) % options.length].value);
      }}
      className="flex shrink-0 items-center justify-center gap-2 rounded-[8px] border border-stroke/70 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:border-hud/50 hover:text-hud"
      title="Trocar a ordenação"
    >
      <ArrowUpDown size={12} />
      {current.label}
    </button>
  );
}

/** Seletor compacto com o mesmo acabamento dos demais controles da barra. */
export function InlineSelect({
  value,
  onChange,
  children,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        'shrink-0 rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim outline-none transition-colors focus:border-hud/60',
        className,
      )}
    >
      {children}
    </select>
  );
}
