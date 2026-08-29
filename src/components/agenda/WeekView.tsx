import { useMemo } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { listByDate } from '@/services/agendaService';
import { useOperations } from '@/services/store';
import { dateKey, formatBRL, isSameDay, WEEKDAYS_SHORT } from '@/utils/format';
import { toMinutes } from '@/utils/time';
import { cn } from '@/utils/cn';

/** Segunda-feira da semana da data — a semana da clínica começa aí. */
export function startOfWeek(date: Date) {
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - shift);
  return out;
}

/**
 * Sete colunas de resumo.
 *
 * Não é a grade de horários espremida em sete: num celular isso seria
 * ilegível, e a pergunta da semana é outra — "que dia está fraco?". Cada coluna
 * responde com volume, receita e ocupação; o dia detalhado fica a um clique.
 */
export function WeekView({ date, onPick }: { date: Date; onPick: (date: Date) => void }) {
  const operations = useOperations();
  const { professionals, settings } = operations;

  const days = useMemo(() => {
    const monday = startOfWeek(date);
    const active = professionals.filter((p) => p.active);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(day.getDate() + i);

      const billable = listByDate(day).filter(
        (a) => a.status !== 'cancelado' && a.status !== 'falta',
      );

      const booked = billable.reduce((acc, a) => acc + (a.durationMin ?? 30), 0);
      const available = active.reduce((acc, p) => {
        const shift = p.schedule[day.getDay()];
        if (!shift) return acc;
        let minutes = toMinutes(shift.end) - toMinutes(shift.start);
        if (shift.breakStart && shift.breakEnd) {
          minutes -= toMinutes(shift.breakEnd) - toMinutes(shift.breakStart);
        }
        return acc + Math.max(0, minutes);
      }, 0);

      return {
        day,
        closed: settings.hours[day.getDay()]?.closed || settings.holidays.includes(dateKey(day)),
        count: billable.length,
        revenueCents: billable.reduce((acc, a) => acc + a.priceCents, 0),
        occupancyPct: available ? Math.min(100, Math.round((booked / available) * 100)) : 0,
      };
    });
    // `operations` cobre agenda, equipe e configurações de uma vez.
  }, [date, professionals, settings, operations]);

  const peak = Math.max(...days.map((d) => d.revenueCents), 1);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((entry) => {
        const selected = isSameDay(entry.day, date);
        const today = isSameDay(entry.day, new Date());

        return (
          <button
            key={dateKey(entry.day)}
            onClick={() => onPick(entry.day)}
            className={cn(
              'flex flex-col gap-2 rounded-[3px] border px-2.5 py-3 text-left transition-all duration-200',
              selected
                ? 'border-hud/50 bg-hud/[0.08]'
                : 'border-hud/10 bg-white/[0.015] hover:border-hud/30',
              entry.closed && 'opacity-45',
            )}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {WEEKDAYS_SHORT[entry.day.getDay()]}
              </span>
              <span
                className={cn(
                  'font-display text-[15px] font-semibold tnum',
                  today ? 'text-hud' : 'text-ink',
                )}
              >
                {entry.day.getDate()}
              </span>
            </div>

            {entry.closed ? (
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                Fechado
              </span>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[13px] font-semibold text-ink tnum">
                    {entry.count}
                  </span>
                  <span className="text-[10px] text-ink-faint">atend.</span>
                </div>

                <div className="flex flex-col gap-1">
                  <ProgressBar
                    value={(entry.revenueCents / peak) * 100}
                    label={`Receita de ${dateKey(entry.day)}`}
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[9.5px] text-ink-faint tnum">
                      {formatBRL(entry.revenueCents)}
                    </span>
                    <span className="font-mono text-[9.5px] text-hud tnum">
                      {entry.occupancyPct}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
