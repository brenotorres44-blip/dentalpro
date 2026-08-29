import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Search, Trash2, UserRound } from 'lucide-react';

import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { Callout, SelectField, TextareaField } from '@/components/ui/Field';
import { Badge } from '@/components/ui/DataTable';
import type { Appointment, AppointmentStatus, PaymentMethod, WaitlistEntry } from '@/data/types';
import {
  createAppointment,
  durationFor,
  moveAppointment,
  priceFor,
  removeAppointment,
  updateAppointment,
  type AppointmentDraft,
} from '@/services/agendaService';
import { useOperations } from '@/services/store';
import { dateKey, formatBRL, formatLongDate, initials } from '@/utils/format';
import { formatDuration } from '@/utils/time';
import { cn } from '@/utils/cn';

const STATUS_OPTIONS: Array<{ value: AppointmentStatus; label: string }> = [
  { value: 'agendado', label: 'Agendado' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'falta', label: 'Faltou' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export interface AppointmentFormProps {
  /** Data em que o atendimento está hoje. */
  date: Date;
  /** `null` cria; preenchido edita. */
  appointment: Appointment | null;
  /** Pré-preenchimento vindo do clique numa célula vazia da grade. */
  defaults?: { professionalId: string; time: string };
  /** Entrada da fila de espera sendo convertida em atendimento. */
  prefill?: WaitlistEntry | null;
  onDone: () => void;
}

export function AppointmentForm({
  date,
  appointment,
  defaults,
  prefill,
  onDone,
}: AppointmentFormProps) {
  const { clients, services, professionals } = useOperations();

  const [clientQuery, setClientQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetDate, setTargetDate] = useState(dateKey(date));

  // A fila de espera entra como valor inicial, não como imposição: quem oferece
  // a vaga ainda pode trocar o serviço ou o profissional antes de confirmar.
  const [draft, setDraft] = useState<AppointmentDraft>(() => ({
    time: appointment?.time ?? defaults?.time ?? '09:00',
    clientId: appointment?.clientId ?? prefill?.clientId ?? '',
    serviceIds: appointment?.serviceIds ?? prefill?.serviceIds ?? [],
    professionalId:
      appointment?.professionalId ??
      (prefill && prefill.professionalId !== 'any' ? prefill.professionalId : undefined) ??
      defaults?.professionalId ??
      professionals[0]?.id ??
      '',
    status: appointment?.status ?? 'agendado',
    notes: appointment?.notes ?? prefill?.note ?? '',
    paymentMethod: appointment?.paymentMethod,
  }));

  const set = <K extends keyof AppointmentDraft>(key: K, value: AppointmentDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  const selectedClient = clients.find((c) => c.id === draft.clientId);

  const matches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => c.active && (c.name.toLowerCase().includes(q) || c.phone.includes(q)))
      .slice(0, 6);
  }, [clients, clientQuery]);

  const chosen = draft.serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const totalCents = chosen.reduce((acc, s) => acc + priceFor(s, draft.professionalId), 0);
  const totalMinutes = chosen.length > 0 ? durationFor(chosen) : 0;

  const movingDay = targetDate !== dateKey(date);

  async function submit() {
    if (!draft.clientId) {
      setError('Escolha o paciente.');
      return;
    }
    // O horário só é confirmado pelo banco: sem a trava, dois cliques rápidos
    // no mesmo formulário viram duas idas ao servidor e um dos dois volta com
    // "esse horário acabou de ser preenchido" — contra o próprio agendamento.
    if (saving) return;

    const [y, m, d] = targetDate.split('-').map(Number);
    const destination = new Date(y, m - 1, d);

    setSaving(true);
    const result = appointment
      ? movingDay
        ? await moveAppointment(date, appointment.id, destination, draft)
        : await updateAppointment(date, appointment.id, draft)
      : await createAppointment(destination, draft);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- paciente ---------- */}
      <section className="flex flex-col gap-2">
        <span className="tech-label">PACIENTE</span>

        {selectedClient ? (
          <div className="flex items-center gap-2.5 rounded-[3px] border border-hud/30 bg-hud/[0.06] px-3 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hud/30 bg-hud/10 font-display text-[10px] font-semibold text-hud">
              {initials(selectedClient.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">
                {selectedClient.name}
              </span>
              <span className="block truncate font-mono text-[10.5px] text-ink-faint tnum">
                {selectedClient.phone}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                set('clientId', '');
                setClientQuery('');
              }}
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint transition-colors hover:text-hud"
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <label className="group relative flex items-center">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 text-ink-faint transition-colors group-focus-within:text-hud"
              />
              <input
                autoFocus
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                placeholder="Buscar por nome ou telefone"
                className="w-full rounded-[3px] border border-stroke/70 bg-void/50 py-2.5 pl-9 pr-3 text-[12.5px] text-ink outline-none transition-all placeholder:text-ink-faint/60 focus:border-hud/60 focus:bg-hud/[0.04]"
              />
            </label>

            {matches.length > 0 && (
              <ul className="flex flex-col gap-1">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        set('clientId', c.id);
                        setClientQuery('');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[3px] border border-stroke/60 px-3 py-2 text-left transition-colors hover:border-hud/40 hover:bg-hud/[0.05]"
                    >
                      <UserRound size={13} className="shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-dim">{c.name}</span>
                      <span className="shrink-0 font-mono text-[10.5px] text-ink-faint tnum">
                        {c.phone}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {clientQuery.trim().length > 1 && matches.length === 0 && (
              <p className="text-[11px] text-ink-faint">
                Nenhum paciente encontrado. Cadastre em <strong>Pacientes</strong> antes de agendar —
                o atendimento precisa de uma ficha para entrar no histórico.
              </p>
            )}
          </>
        )}
      </section>

      {/* ---------- serviços ---------- */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="tech-label">PROCEDIMENTOS</span>
          {chosen.length > 0 && (
            <span className="font-mono text-[10.5px] text-hud tnum">
              {formatBRL(totalCents)} · {formatDuration(totalMinutes)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {services
            .filter((s) => s.active)
            .map((s) => {
              const selected = draft.serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    set(
                      'serviceIds',
                      selected
                        ? draft.serviceIds.filter((id) => id !== s.id)
                        : [...draft.serviceIds, s.id],
                    )
                  }
                  className={cn(
                    'flex items-center gap-1.5 rounded-[3px] border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-200',
                    selected
                      ? 'border-hud/50 bg-hud/12 text-hud'
                      : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                  )}
                >
                  {selected && <Check size={10} />}
                  {s.name}
                </button>
              );
            })}
        </div>
      </section>

      {/* ---------- quando e com quem ---------- */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="tech-label">DATA</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value);
              setError(null);
            }}
            className="w-full rounded-[3px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="tech-label">HORÁRIO</span>
          <input
            type="time"
            step={300}
            value={draft.time}
            onChange={(e) => set('time', e.target.value)}
            className="w-full rounded-[3px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
          />
        </label>
      </div>

      <SelectField
        label="PROFISSIONAL"
        value={draft.professionalId}
        onChange={(e) => set('professionalId', e.target.value)}
      >
        {professionals
          .filter((p) => p.active)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.role}
            </option>
          ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="STATUS"
          value={draft.status}
          onChange={(e) => set('status', e.target.value as AppointmentStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="PAGAMENTO"
          value={draft.paymentMethod ?? ''}
          onChange={(e) => set('paymentMethod', (e.target.value || undefined) as PaymentMethod)}
        >
          <option value="">Não informado</option>
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextareaField
        label="OBSERVAÇÃO"
        rows={2}
        value={draft.notes ?? ''}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="Recado para quem vai atender"
      />

      {movingDay && (
        <Callout tone="info" icon={<CalendarClock size={13} />}>
          Vai sair de <strong>{formatLongDate(date)}</strong> e entrar no dia escolhido. O horário
          antigo fica livre para a fila de espera.
        </Callout>
      )}

      {error && (
        <Callout tone="critical" icon={<AlertTriangle size={13} />}>
          {error}
        </Callout>
      )}

      {/* ---------- ações ---------- */}
      <div className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <TechButton
          variant="primary"
          onClick={submit}
          disabled={saving}
          className="justify-center py-3"
        >
          {saving ? 'Confirmando…' : appointment ? 'Salvar atendimento' : 'Agendar'}
        </TechButton>

        {appointment && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 rounded-[3px] border border-hud/10 bg-white/[0.02] px-3 py-2">
              <span className="tech-label">REGISTRO</span>
              <Badge tone={appointment.status === 'concluido' ? 'ok' : 'live'}>
                {appointment.services.join(' + ')}
              </Badge>
            </div>
            <ConfirmButton
              icon={<Trash2 size={12} />}
              confirmLabel="Excluir mesmo assim?"
              onConfirm={async () => {
                const result = await removeAppointment(date, appointment.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onDone();
              }}
              className="justify-center"
            >
              Excluir da agenda
            </ConfirmButton>
          </div>
        )}
      </div>
    </div>
  );
}
