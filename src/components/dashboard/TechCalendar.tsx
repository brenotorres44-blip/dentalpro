import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { MONTHS, WEEKDAYS_SHORT, isSameDay } from '@/utils/format';
import { getMonthLoad } from '@/services/dashboardService';
import { BootStage, useBoot } from '@/hooks/useBoot';

/**
 * Calendário do mês.
 *
 * Cada dia mostra a carga prevista como uma barrinha luminosa, então o mês
 * inteiro se lê de relance — é a diferença entre um seletor de data e um painel
 * de ocupação. Selecionar um dia recarrega todo o dashboard.
 */
export function TechCalendar({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  const { stage } = useBoot();
  const ready = stage >= BootStage.DATA;
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const loads = useMemo(() => getMonthLoad(new Date(year, month, 1)), [year, month]);

  const shift = (delta: number) => setView(new Date(year, month + delta, 1));

  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* cabeçalho do mês */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => shift(-1)}
          className="grid h-7 w-7 place-items-center rounded-[3px] border border-stroke/60 text-ink-dim transition-all duration-200 hover:border-hud/50 hover:text-hud"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${year}-${month}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
            className="text-center"
          >
            <div className="font-display text-[12px] font-semibold uppercase tracking-[0.22em] text-ink">
              {MONTHS[month]}
            </div>
            <div className="tech-label tnum">{year}</div>
          </motion.div>
        </AnimatePresence>

        <button
          onClick={() => shift(1)}
          className="grid h-7 w-7 place-items-center rounded-[3px] border border-stroke/60 text-ink-dim transition-all duration-200 hover:border-hud/50 hover:text-hud"
          aria-label="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* dias da semana */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="tech-label text-center text-[8px]">
            {d}
          </div>
        ))}
      </div>

      {/* grade */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;

          const date = new Date(year, month, day);
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selected);
          const isSunday = date.getDay() === 0;
          const load = loads[day - 1] ?? 0;

          return (
            <motion.button
              key={day}
              onClick={() => onSelect(date)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2, delay: Math.min(i, 34) * 0.008 }}
              whileTap={{ scale: 0.92 }}
              className={cn(
                'group relative aspect-square rounded-[3px] border text-[11px] font-medium',
                'flex flex-col items-center justify-center gap-1',
                'transition-colors duration-200',
                isSelected
                  ? 'border-hud/60 text-void'
                  : isToday
                    ? 'border-hud/45 text-hud'
                    : 'border-transparent text-ink-dim hover:border-hud/25 hover:text-ink',
                isSunday && !isSelected && 'text-ink-faint',
              )}
              aria-label={`${day} de ${MONTHS[month].toLowerCase()} de ${year}`}
              aria-current={isSelected ? 'date' : undefined}
            >
              {/* preenchimento do dia selecionado — desliza entre datas */}
              {isSelected && (
                <motion.span
                  layoutId="calendar-selected"
                  className="absolute inset-0 rounded-[3px] bg-hud shadow-[0_0_18px_-2px_var(--color-hud)]"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                  aria-hidden
                />
              )}

              {/* círculo luminoso do dia corrente */}
              {isToday && !isSelected && (
                <span
                  className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-[60%] rounded-full border border-hud/70 shadow-[0_0_12px_-2px_var(--color-hud)] anim-breathe"
                  aria-hidden
                />
              )}

              <span className="relative tnum">{day}</span>

              {/* carga do dia */}
              <span
                className={cn(
                  'relative h-[2px] w-4 overflow-hidden rounded-full',
                  isSelected ? 'bg-void/30' : 'bg-white/[0.06]',
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                    isSelected ? 'bg-void/70' : load > 0.75 ? 'bg-hud-bright' : 'bg-hud/60',
                  )}
                  style={{ width: `${Math.round(load * 100)}%` }}
                />
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* legenda */}
      <div className="flex items-center justify-between border-t border-hud/10 pt-2.5">
        <span className="tech-label">CARGA PREVISTA</span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-3 rounded-full bg-hud/40" />
          <span className="tech-label">BAIXA</span>
          <span className="ml-1 h-[2px] w-3 rounded-full bg-hud-bright" />
          <span className="tech-label">ALTA</span>
        </span>
      </div>
    </div>
  );
}
