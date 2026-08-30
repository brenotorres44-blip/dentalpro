import { motion } from 'motion/react';
import { CalendarX2 } from 'lucide-react';
import type { Appointment, AppointmentStatus, Professional } from '@/data/types';
import { cn } from '@/utils/cn';
import { formatBRL } from '@/utils/format';
import { BootStage, useBoot } from '@/hooks/useBoot';
import { rowEnter } from '@/animations/variants';
import type { Tone } from '@/components/ui/StatusIndicator';
import { StatusIndicator } from '@/components/ui/StatusIndicator';

const STATUS: Record<AppointmentStatus, { label: string; tone: Tone; pulse: boolean; chip: string }> = {
  concluido: {
    label: 'CONCLUÍDO',
    tone: 'ok',
    pulse: false,
    chip: 'border-success/30 bg-success/10 text-success',
  },
  em_andamento: {
    label: 'EM ANDAMENTO',
    tone: 'live',
    pulse: true,
    chip: 'border-hud/40 bg-hud/12 text-hud',
  },
  agendado: {
    label: 'AGENDADO',
    tone: 'info',
    pulse: false,
    chip: 'border-electric/25 bg-electric/8 text-electric',
  },
  cancelado: {
    label: 'CANCELADO',
    tone: 'critical',
    pulse: false,
    chip: 'border-critical/30 bg-critical/10 text-critical',
  },
  // Falta é diferente de cancelamento: o horário foi perdido sem aviso. O tom
  // de alerta separa quem desmarcou de quem simplesmente não veio.
  falta: {
    label: 'FALTOU',
    tone: 'warn',
    pulse: false,
    chip: 'border-warn/30 bg-warn/10 text-warn',
  },
};

export function AppointmentList({
  appointments,
  professionals,
}: {
  appointments: Appointment[];
  professionals: Professional[];
}) {
  const { stage, stagger } = useBoot();
  const ready = stage >= BootStage.DATA;
  const nameById = new Map(professionals.map((p) => [p.id, p.name]));

  if (appointments.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
        <CalendarX2 size={26} className="text-ink-faint" />
        <div>
          <p className="font-display text-[12px] text-ink-dim">
            Sem atendimentos
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">Nenhum horário registrado nesta data.</p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {appointments.map((a, i) => {
        const s = STATUS[a.status];
        return (
          <motion.li
            key={a.id}
            variants={rowEnter}
            custom={stagger(i, 45)}
            initial="hidden"
            animate={ready ? 'visible' : 'hidden'}
            className={cn(
              'group relative flex items-center gap-3 rounded-[8px] border border-transparent',
              'bg-white/[0.015] px-3 py-2.5',
              'transition-all duration-200 ease-out',
              'hover:border-hud/25 hover:bg-hud/[0.05] hover:translate-x-0.5',
            )}
          >
            {/* trilho de status na borda esquerda */}
            <span
              className={cn(
                'absolute inset-y-1.5 left-0 w-[2px] rounded-full transition-all duration-200',
                a.status === 'concluido' && 'bg-success/70',
                a.status === 'em_andamento' && 'bg-hud',
                a.status === 'agendado' && 'bg-electric/50',
                a.status === 'cancelado' && 'bg-critical/70',
                a.status === 'falta' && 'bg-warn/70',
              )}
              aria-hidden
            />

            <div className="shrink-0 pl-1.5">
              <div className="font-mono text-[13px] font-medium leading-none text-ink tnum">
                {a.time}
              </div>
              <div className="tech-label mt-1 hidden sm:block">
                {nameById.get(a.professionalId)?.split(' ')[0] ?? '—'}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{a.client}</div>
              <div className="truncate text-[11px] text-ink-dim">{a.services.join(' + ')}</div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[8px] border px-1.5 py-0.5',
                  'font-mono text-[9px]',
                  s.chip,
                )}
              >
                <StatusIndicator tone={s.tone} pulse={s.pulse} />
                <span className="hidden sm:inline">{s.label}</span>
              </span>
              {/* valor aparece no hover: informação secundária não compete com o status */}
              <span className="font-mono text-[10px] text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100 tnum">
                {formatBRL(a.priceCents)}
              </span>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
