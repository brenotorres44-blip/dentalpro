import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Classe de visibilidade responsiva — colunas secundárias somem primeiro. */
  hideUntil?: 'sm' | 'md' | 'lg' | 'xl';
  width?: string;
}

const HIDE: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

/**
 * Tabela do centro de comando.
 *
 * Em vez de encolher tudo no celular, as colunas secundárias saem de cena por
 * ordem de importância — o que sobra continua legível em vez de virar uma
 * grade de texto truncado.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty = 'Nenhum registro encontrado.',
  onRowClick,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  const { stage } = useBoot();
  const ready = stage >= BootStage.DATA;

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
        <span className="tech-label">SEM RESULTADOS</span>
        <p className="text-[12px] text-ink-faint">{empty}</p>
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-full border-collapse">
        <thead>
          <tr className="border-b border-hud/15">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(
                  'tech-label whitespace-nowrap px-3 py-2.5',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  !c.align && 'text-left',
                  c.hideUntil && HIDE[c.hideUntil],
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={row.id}
              initial={{ opacity: 0, x: -8 }}
              animate={ready ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.24, delay: Math.min(i, 18) * 0.022 }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-hud/[0.07] transition-colors duration-150',
                'hover:bg-hud/[0.05]',
                onRowClick && 'cursor-pointer',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-2.5 text-[12.5px] text-ink-dim',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.hideUntil && HIDE[c.hideUntil],
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE_CLASS = {
  ok: 'border-success/30 bg-success/10 text-success',
  live: 'border-hud/40 bg-hud/12 text-hud',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  critical: 'border-critical/30 bg-critical/10 text-critical',
  idle: 'border-stroke/60 bg-white/[0.03] text-ink-faint',
} as const;

export function Badge({
  children,
  tone = 'idle',
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-[8px] border px-1.5 py-0.5',
        'font-mono text-[9px] uppercase tracking-[0.12em]',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}
