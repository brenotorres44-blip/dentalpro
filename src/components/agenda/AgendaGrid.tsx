import { useMemo, useState } from 'react';
import { Ban, Lock } from 'lucide-react';
import type { Appointment, ProfessionalRecord, ScheduleBlock } from '@/data/types';
import { HolographicAvatar } from '@/components/dashboard/HolographicAvatar';
import { formatBRL } from '@/utils/format';
import { toMinutes, toTime } from '@/utils/time';
import { cn } from '@/utils/cn';

/**
 * Altura de um minuto na grade.
 *
 * 1,2px dá 36px num bloco de meia hora — o mínimo para caber o horário e o nome
 * do cliente sem cortar a segunda linha. Em 1,1px o nome ficava com a base
 * decepada nos atendimentos curtos.
 */
const PX_PER_MIN = 1.2;

const STATUS_STYLE: Record<Appointment['status'], string> = {
  concluido: 'border-success/35 bg-success/[0.10] text-success',
  em_andamento: 'border-hud/55 bg-hud/[0.14] text-hud',
  agendado: 'border-electric/35 bg-electric/[0.09] text-electric',
  cancelado: 'border-critical/35 bg-critical/[0.08] text-critical line-through opacity-60',
  falta: 'border-warn/35 bg-warn/[0.09] text-warn opacity-75',
};

export interface GridDrop {
  appointmentId: string;
  professionalId: string;
  time: string;
}

/**
 * Grade do dia.
 *
 * Uma coluna por profissional, o tempo correndo na vertical. É a única leitura
 * que responde à pergunta que a clínica faz o dia inteiro — "cabe alguém às
 * três?" — sem obrigar a abrir quatro agendas separadas e comparar.
 *
 * O bloco tem altura proporcional à duração real: um platinado de duas horas
 * precisa ocupar duas horas na tela, senão a grade mente sobre a ocupação.
 */
export function AgendaGrid({
  date,
  professionals,
  appointments,
  blocks,
  openMinutes,
  closeMinutes,
  stepMinutes,
  onSelect,
  onCreate,
  onMove,
}: {
  date: Date;
  professionals: ProfessionalRecord[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  openMinutes: number;
  closeMinutes: number;
  stepMinutes: number;
  onSelect: (appointment: Appointment) => void;
  onCreate: (professionalId: string, time: string) => void;
  onMove: (drop: GridDrop) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let m = openMinutes; m < closeMinutes; m += stepMinutes) out.push(m);
    return out;
  }, [openMinutes, closeMinutes, stepMinutes]);

  const totalHeight = (closeMinutes - openMinutes) * PX_PER_MIN;
  const weekday = date.getDay();

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div
        className="grid min-w-[640px] gap-px"
        style={{ gridTemplateColumns: `56px repeat(${professionals.length}, minmax(140px, 1fr))` }}
      >
        {/* ---------- cabeçalho ---------- */}
        <div className="sticky left-0 z-10 bg-abyss/80 backdrop-blur-sm" />
        {professionals.map((p) => {
          const shift = p.schedule[weekday];
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 border-b border-hud/12 px-2 py-2"
            >
              <HolographicAvatar
                name={p.name}
                hue={p.hue}
                status={shift ? 'disponivel' : 'offline'}
                size={26}
              />
              <div className="min-w-0">
                <div className="truncate text-[11.5px] font-medium text-ink">
                  {p.name.split(' ')[0]}
                </div>
                <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint tnum">
                  {shift ? `${shift.start}–${shift.end}` : 'folga'}
                </div>
              </div>
            </div>
          );
        })}

        {/* ---------- régua de horas ---------- */}
        <div className="sticky left-0 z-10 bg-abyss/80 backdrop-blur-sm" style={{ height: totalHeight }}>
          {slots.map((minutes) => (
            <div
              key={minutes}
              style={{ height: stepMinutes * PX_PER_MIN }}
              className="relative -translate-y-1.5 pr-2 text-right"
            >
              <span className="font-mono text-[9.5px] text-ink-faint tnum">{toTime(minutes)}</span>
            </div>
          ))}
        </div>

        {/* ---------- colunas ---------- */}
        {professionals.map((p) => {
          const shift = p.schedule[weekday];
          const columnBlocks = blocks.filter(
            (b) => b.professionalId === 'all' || b.professionalId === p.id,
          );

          return (
            <div
              key={p.id}
              className="relative border-l border-hud/[0.07]"
              style={{ height: totalHeight }}
            >
              {/* alvos de clique e de soltura, um por intervalo */}
              {slots.map((minutes) => {
                const key = `${p.id}-${minutes}`;
                const outsideShift =
                  !shift || minutes < toMinutes(shift.start) || minutes >= toMinutes(shift.end);
                const onBreak =
                  shift?.breakStart &&
                  shift.breakEnd &&
                  minutes >= toMinutes(shift.breakStart) &&
                  minutes < toMinutes(shift.breakEnd);

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={outsideShift}
                    onClick={() => onCreate(p.id, toTime(minutes))}
                    onDragOver={(e) => {
                      if (!dragging || outsideShift) return;
                      e.preventDefault();
                      setHover(key);
                    }}
                    onDragLeave={() => setHover((h) => (h === key ? null : h))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setHover(null);
                      if (!dragging) return;
                      onMove({
                        appointmentId: dragging,
                        professionalId: p.id,
                        time: toTime(minutes),
                      });
                      setDragging(null);
                    }}
                    style={{ height: stepMinutes * PX_PER_MIN }}
                    className={cn(
                      'group/slot w-full border-b border-hud/[0.05] transition-colors duration-150',
                      outsideShift && 'cursor-not-allowed bg-void/40',
                      onBreak && 'bg-warn/[0.04]',
                      !outsideShift && 'hover:bg-hud/[0.06]',
                      hover === key && 'bg-hud/15 ring-1 ring-inset ring-hud/50',
                    )}
                    aria-label={`Agendar ${toTime(minutes)} com ${p.name}`}
                  />
                );
              })}

              {/* bloqueios */}
              {columnBlocks.map((block) => {
                const top = (toMinutes(block.start) - openMinutes) * PX_PER_MIN;
                const height = (toMinutes(block.end) - toMinutes(block.start)) * PX_PER_MIN;
                return (
                  <div
                    key={block.id}
                    style={{ top, height }}
                    className="pointer-events-none absolute inset-x-1 flex items-center gap-1.5 overflow-hidden rounded-[8px] border border-dashed border-ink-faint/40 bg-void/70 px-2"
                    title={block.reason}
                  >
                    <Lock size={11} className="shrink-0 text-ink-faint" />
                    <span className="truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                      {block.reason || 'bloqueado'}
                    </span>
                  </div>
                );
              })}

              {/* atendimentos */}
              {appointments
                .filter((a) => a.professionalId === p.id)
                .map((a) => {
                  const start = toMinutes(a.time);
                  const span = a.durationMin ?? 30;
                  const top = (start - openMinutes) * PX_PER_MIN;
                  const height = Math.max(34, span * PX_PER_MIN);
                  const locked = a.status === 'concluido';

                  return (
                    <button
                      key={a.id}
                      type="button"
                      draggable={!locked}
                      onDragStart={() => setDragging(a.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setHover(null);
                      }}
                      onClick={() => onSelect(a)}
                      style={{ top, height }}
                      className={cn(
                        'absolute inset-x-1 flex flex-col justify-start gap-0.5 overflow-hidden rounded-[8px] border px-2 py-1 text-left',
                        'transition-transform duration-150 hover:z-20 hover:scale-[1.02]',
                        STATUS_STYLE[a.status],
                        dragging === a.id && 'opacity-40',
                        // Concluído não arrasta: reagendar o que já aconteceu
                        // reescreveria o faturamento de um dia já fechado.
                        locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                      )}
                      title={`${a.time} · ${a.client} · ${a.services.join(' + ')}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[9.5px] tnum">{a.time}</span>
                        {a.status === 'cancelado' && <Ban size={9} />}
                      </span>
                      <span className="truncate text-[11px] font-medium leading-tight text-ink">
                        {a.client}
                      </span>
                      {height > 44 && (
                        <span className="truncate text-[10px] leading-tight text-ink-dim">
                          {a.services.join(' + ')}
                        </span>
                      )}
                      {height > 64 && (
                        <span className="mt-auto font-mono text-[9.5px] text-ink-faint tnum">
                          {formatBRL(a.priceCents)}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
