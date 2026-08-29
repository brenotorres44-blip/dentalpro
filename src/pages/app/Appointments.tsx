import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListPlus,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
  UserX,
  Wallet,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { TechButton } from '@/components/ui/TechButton';
import { Callout } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { AgendaGrid, type GridDrop } from '@/components/agenda/AgendaGrid';
import { AppointmentForm } from '@/components/agenda/AppointmentForm';
import { BlockDrawer } from '@/components/agenda/BlockDrawer';
import { WaitlistDrawer } from '@/components/agenda/WaitlistDrawer';
import { WeekView } from '@/components/agenda/WeekView';

import type { Appointment, WaitlistEntry } from '@/data/types';
import { blocksFor, listByDate, moveAppointment, resolveDayState } from '@/services/agendaService';
import { remove, useOperations } from '@/services/store';
import {
  dateKey,
  formatBRL,
  formatInt,
  formatLongDate,
  formatPercent,
  isSameDay,
} from '@/utils/format';
import { toMinutes } from '@/utils/time';
import { cn } from '@/utils/cn';

type View = 'dia' | 'semana';

export function Appointments() {
  const operations = useOperations();
  const { professionals, settings, waitlist, clients, services } = operations;

  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>('dia');
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState<{ professionalId: string; time: string } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [queueing, setQueueing] = useState(false);
  /** Entrada da fila que abriu o formulário — preenche cliente e serviços. */
  const [prefill, setPrefill] = useState<WaitlistEntry | null>(null);

  const appointments = useMemo(() => listByDate(date), [date, operations]);
  const blocks = useMemo(() => blocksFor(date), [date, operations]);

  const staff = useMemo(
    () => professionals.filter((p) => p.active),
    [professionals],
  );

  const hours = settings.hours[date.getDay()];
  const openMinutes = toMinutes(hours?.open ?? '09:00');
  const closeMinutes = toMinutes(hours?.close ?? '20:00');
  const closed = hours?.closed || settings.holidays.includes(dateKey(date));

  const billable = appointments.filter(
    (a) => a.status !== 'cancelado' && a.status !== 'falta',
  );

  /** Ocupação real: minutos vendidos sobre minutos de jornada da equipe no dia. */
  const occupancy = useMemo(() => {
    const booked = billable.reduce((acc, a) => acc + (a.durationMin ?? 30), 0);
    const available = staff.reduce((acc, p) => {
      const shift = p.schedule[date.getDay()];
      if (!shift) return acc;
      let minutes = toMinutes(shift.end) - toMinutes(shift.start);
      if (shift.breakStart && shift.breakEnd) {
        minutes -= toMinutes(shift.breakEnd) - toMinutes(shift.breakStart);
      }
      return acc + Math.max(0, minutes);
    }, 0);
    return { booked, available, pct: available ? (booked / available) * 100 : 0 };
  }, [billable, staff, date]);

  const stats = useMemo(
    () => [
      {
        label: 'ATENDIMENTOS',
        value: formatInt(billable.length),
        hint: `${formatInt(appointments.length - billable.length)} cancelado(s) ou falta(s)`,
        icon: CalendarClock,
      },
      {
        label: 'RECEITA DO DIA',
        value: formatBRL(billable.reduce((acc, a) => acc + a.priceCents, 0)),
        hint: resolveDayState(date) === 'future' ? 'previsto' : 'realizado',
        icon: Wallet,
        tone: 'success' as const,
      },
      {
        label: 'OCUPAÇÃO',
        value: formatPercent(occupancy.pct),
        hint: `${Math.round(occupancy.booked / 60)}h de ${Math.round(occupancy.available / 60)}h`,
        icon: Activity,
        tone: 'electric' as const,
      },
      {
        label: 'FILA DE ESPERA',
        value: formatInt(waitlist.length),
        hint: blocks.length > 0 ? `${blocks.length} bloqueio(s) no dia` : 'nenhum bloqueio',
        icon: ListPlus,
        tone: waitlist.length > 0 ? ('warn' as const) : ('hud' as const),
      },
    ],
    [appointments, billable, occupancy, waitlist, blocks, date],
  );

  function shiftDay(delta: number) {
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta * (view === 'semana' ? 7 : 1));
      return next;
    });
  }

  /** Solta o bloco numa célula: reagenda mantendo cliente, serviços e status. */
  async function handleMove(drop: GridDrop) {
    const appointment = appointments.find((a) => a.id === drop.appointmentId);
    if (!appointment) return;

    const result = await moveAppointment(date, appointment.id, date, {
      time: drop.time,
      clientId: appointment.clientId ?? '',
      serviceIds: appointment.serviceIds ?? [],
      professionalId: drop.professionalId,
      status: appointment.status,
      notes: appointment.notes,
      paymentMethod: appointment.paymentMethod,
    });

    setMoveError(result.ok ? null : result.error);
  }

  const closeForm = () => {
    setEditing(null);
    setCreating(null);
    // Fechar sem confirmar não pode deixar a entrada da fila grudada no
    // próximo formulário que abrir.
    setPrefill(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- faixa de contexto ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[3px] border border-stroke/70">
            <button
              onClick={() => shiftDay(-1)}
              className="grid h-9 w-9 place-items-center text-ink-faint transition-colors hover:text-hud"
              aria-label="Período anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <input
              type="date"
              value={dateKey(date)}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                if (y) setDate(new Date(y, m - 1, d));
              }}
              className="border-x border-stroke/70 bg-transparent px-2.5 py-2 font-mono text-[12px] text-ink outline-none tnum"
              aria-label="Escolher data"
            />
            <button
              onClick={() => shiftDay(1)}
              className="grid h-9 w-9 place-items-center text-ink-faint transition-colors hover:text-hud"
              aria-label="Próximo período"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <TechButton
            icon={<RotateCcw size={12} />}
            onClick={() => setDate(new Date())}
            disabled={isSameDay(date, new Date())}
          >
            Hoje
          </TechButton>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-[3px] border border-stroke/70 p-0.5">
            {(['dia', 'semana'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-[2px] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-200',
                  view === v ? 'bg-hud/15 text-hud' : 'text-ink-faint hover:text-ink-dim',
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <TechButton icon={<Lock size={12} />} onClick={() => setBlocking(true)}>
            Bloquear
          </TechButton>
          <TechButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setCreating({ professionalId: staff[0]?.id ?? '', time: '09:00' })}
          >
            Agendar
          </TechButton>
        </div>
      </div>

      <StatStrip stats={stats} />

      {moveError && (
        <Callout tone="critical" icon={<UserX size={13} />}>
          {moveError}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---------- grade ---------- */}
        <HolographicPanel
          title={view === 'dia' ? 'Grade do dia' : 'Semana'}
          meta={<span className="capitalize">{formatLongDate(date)}</span>}
          icon={<CalendarDays size={14} />}
          className="xl:col-span-9"
          bodyClassName="holo-body-compact"
        >
          {view === 'semana' ? (
            <WeekView date={date} onPick={(d) => { setDate(d); setView('dia'); }} />
          ) : closed ? (
            <EmptyState
              icon={Lock}
              title="Fechado"
              description="A clínica não abre nesta data. Ajuste o horário de funcionamento ou os feriados em Configurações."
            />
          ) : staff.length === 0 ? (
            <EmptyState
              icon={UserX}
              title="Sem equipe ativa"
              description="Nenhum profissional ativo para montar a grade. Cadastre ou reative alguém em Profissionais."
            />
          ) : (
            <AgendaGrid
              date={date}
              professionals={staff}
              appointments={appointments}
              blocks={blocks}
              openMinutes={openMinutes}
              closeMinutes={closeMinutes}
              stepMinutes={settings.booking.slotMinutes}
              onSelect={setEditing}
              onCreate={(professionalId, time) => setCreating({ professionalId, time })}
              onMove={handleMove}
            />
          )}
        </HolographicPanel>

        {/* ---------- coluna lateral ---------- */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <HolographicPanel
            title="Bloqueios"
            meta={`${blocks.length}`}
            icon={<Lock size={14} />}
            bodyClassName="holo-body-compact"
          >
            {blocks.length === 0 ? (
              <p className="px-1 py-3 text-[11.5px] leading-relaxed text-ink-faint">
                Nenhum bloqueio nesta data. Use para almoço estendido, manutenção, treinamento —
                qualquer coisa que ocupe a cadeira sem ser atendimento.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {blocks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-2 rounded-[3px] border border-hud/10 bg-white/[0.02] px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] text-ink-dim">
                        {b.reason || 'Bloqueado'}
                      </span>
                      <span className="block font-mono text-[10px] text-ink-faint tnum">
                        {b.start}–{b.end} ·{' '}
                        {b.professionalId === 'all'
                          ? 'toda a equipe'
                          : professionals.find((p) => p.id === b.professionalId)?.name.split(' ')[0]}
                      </span>
                    </span>
                    <button
                      onClick={() => remove('blocks', b.id)}
                      className="shrink-0 text-ink-faint transition-colors hover:text-critical"
                      aria-label="Remover bloqueio"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </HolographicPanel>

          <HolographicPanel
            title="Fila de espera"
            meta={`${waitlist.length}`}
            icon={<ListPlus size={14} />}
            bodyClassName="holo-body-compact"
            actions={
              <button
                onClick={() => setQueueing(true)}
                className="text-ink-faint transition-colors hover:text-hud"
                aria-label="Adicionar à fila"
              >
                <Plus size={13} />
              </button>
            }
          >
            {waitlist.length === 0 ? (
              <p className="px-1 py-3 text-[11.5px] leading-relaxed text-ink-faint">
                Ninguém esperando. Quem pede um horário lotado entra aqui e recebe a vaga quando
                alguém desmarca.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {waitlist.map((entry) => {
                  const client = clients.find((c) => c.id === entry.clientId);
                  const names = entry.serviceIds
                    .map((id) => services.find((s) => s.id === id)?.name)
                    .filter(Boolean)
                    .join(' + ');

                  return (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1.5 rounded-[3px] border border-warn/20 bg-warn/[0.04] px-2.5 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium text-ink">
                            {client?.name ?? 'Paciente removido'}
                          </span>
                          <span className="block truncate text-[10px] text-ink-faint">
                            {names || 'sem serviço'} · {entry.window}
                          </span>
                        </span>
                        <button
                          onClick={() => remove('waitlist', entry.id)}
                          className="shrink-0 text-ink-faint transition-colors hover:text-critical"
                          aria-label="Remover da fila"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          setCreating({ professionalId: staff[0]?.id ?? '', time: '09:00' });
                          setPrefill(entry);
                        }}
                        className="rounded-[3px] border border-hud/35 bg-hud/10 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-hud transition-colors hover:bg-hud/20"
                      >
                        Oferecer vaga
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </HolographicPanel>
        </div>
      </div>

      {/* ---------- formulário ---------- */}
      <Drawer
        open={Boolean(editing || creating)}
        onClose={closeForm}
        title={editing ? editing.client : 'Novo atendimento'}
        subtitle={<span className="capitalize">{formatLongDate(date)}</span>}
        icon={<Clock3 size={15} />}
        width={460}
      >
        {(editing || creating) && (
          <AppointmentForm
            key={editing?.id ?? `${creating?.professionalId}-${creating?.time}-${prefill?.id ?? ''}`}
            date={date}
            appointment={editing}
            defaults={creating ?? undefined}
            prefill={prefill}
            onDone={() => {
              // Agendou vindo da fila: a espera acabou, sai da lista.
              if (prefill) remove('waitlist', prefill.id);
              closeForm();
              setPrefill(null);
            }}
          />
        )}
      </Drawer>

      <BlockDrawer
        open={blocking}
        date={date}
        professionals={staff}
        onClose={() => setBlocking(false)}
      />

      <WaitlistDrawer open={queueing} onClose={() => setQueueing(false)} />
    </div>
  );
}
