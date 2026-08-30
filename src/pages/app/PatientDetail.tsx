import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Plus, Smile } from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { TechButton } from '@/components/ui/TechButton';
import { TextareaField } from '@/components/ui/Field';
import { Odontograma } from '@/components/patient/Odontograma';
import { useOperations, update } from '@/services/store';
import { useSession } from '@/auth/SessionProvider';
import { HISTORY_DAYS, clientHistory, daysAgo } from '@/services/insightsService';
import { formatBRL, formatShortDate, initials } from '@/utils/format';
import type { EvolutionNote } from '@/data/types';

const STATUS_LABEL: Record<string, string> = {
  concluido: 'Concluído',
  em_andamento: 'Em andamento',
  agendado: 'Agendado',
  cancelado: 'Cancelado',
  falta: 'Falta',
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'critical' | 'idle'> = {
  concluido: 'ok',
  em_andamento: 'warn',
  agendado: 'idle',
  cancelado: 'critical',
  falta: 'critical',
};

type Tab = 'odontograma' | 'evolucao' | 'historico';

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { clients } = useOperations();
  const [tab, setTab] = useState<Tab>('odontograma');
  const [novaNota, setNovaNota] = useState('');

  const client = clients.find((c) => c.id === id);

  const from = useMemo(() => daysAgo(HISTORY_DAYS), []);
  const to = useMemo(() => new Date(), []);
  const history = useMemo(() => (id ? clientHistory(id, from, to) : []), [id, from, to]);

  if (!client) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon={Smile}
          title="Paciente não encontrado"
          description="A ficha pode ter sido removida."
          action={
            <Link to="/app/clients">
              <TechButton icon={<ArrowLeft size={12} />}>Voltar para pacientes</TechButton>
            </Link>
          }
        />
      </div>
    );
  }

  function salvarNota() {
    const texto = novaNota.trim();
    if (!texto || !client) return;
    const nota: EvolutionNote = {
      id: `ev${Date.now()}`,
      at: new Date().toISOString(),
      text: texto,
      author: session?.user.name ?? 'Equipe',
    };
    update('clients', client.id, { evolution: [nota, ...(client.evolution ?? [])] });
    setNovaNota('');
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <button
        onClick={() => navigate('/app/clients')}
        className="flex w-fit items-center gap-1.5 text-[12.5px] text-ink-faint transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} /> Pacientes
      </button>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ---------- ficha do paciente ---------- */}
        <div className="flex flex-col gap-4">
          <HolographicPanel bodyClassName="p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full border border-hud/25 bg-hud/[0.08] font-display text-[19px] font-semibold text-hud">
                {initials(client.name)}
              </span>
              <div className="font-display text-[16px] font-semibold text-ink">{client.name}</div>
              {client.birthDate && (
                <div className="text-[12px] text-ink-faint">
                  {new Date().getFullYear() - new Date(client.birthDate).getFullYear()} anos
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2.5 border-t border-stroke pt-4 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-faint">Telefone</span>
                <span className="font-medium text-ink">{client.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-faint">E-mail</span>
                <span className="truncate font-medium text-ink">{client.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-faint">Convênio</span>
                <span className="font-medium text-ink">{client.insurance || 'Particular'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-faint">Status</span>
                <Badge tone={client.active ? 'ok' : 'idle'}>{client.active ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              {client.allergies && (
                <div className="rounded-[4px] border border-critical/25 bg-critical/[0.06] px-2.5 py-2 text-critical">
                  <span className="font-semibold">Alergias: </span>
                  {client.allergies}
                </div>
              )}
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {client.tags.map((t) => (
                    <Badge key={t} tone="idle">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </HolographicPanel>

          <HolographicPanel title="Resumo" bodyClassName="p-4">
            <div className="flex flex-col gap-2 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Consultas ({HISTORY_DAYS}d)</span>
                <span className="font-semibold text-ink tnum">{history.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-faint">Faturado ({HISTORY_DAYS}d)</span>
                <span className="font-semibold text-ink tnum">
                  {formatBRL(history.reduce((acc, h) => acc + h.appointment.priceCents, 0))}
                </span>
              </div>
            </div>
          </HolographicPanel>
        </div>

        {/* ---------- prontuário ---------- */}
        <HolographicPanel bodyClassName="p-0" className="overflow-hidden">
          <div className="flex border-b border-stroke">
            {(
              [
                ['odontograma', 'Odontograma'],
                ['evolucao', 'Evolução clínica'],
                ['historico', 'Histórico'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-3 text-[13px] font-medium transition-colors ${
                  tab === key
                    ? 'border-b-2 border-hud text-hud'
                    : 'border-b-2 border-transparent text-ink-faint hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'odontograma' && (
              <Odontograma
                value={client.odontogram ?? {}}
                onChange={(next) => update('clients', client.id, { odontogram: next })}
              />
            )}

            {tab === 'evolucao' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <TextareaField
                    label="Nova anotação"
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    rows={3}
                    placeholder="Descreva o atendimento, observações clínicas..."
                  />
                  <TechButton
                    variant="primary"
                    icon={<Plus size={13} />}
                    onClick={salvarNota}
                    className="w-fit"
                  >
                    Registrar
                  </TechButton>
                </div>

                {!client.evolution?.length ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="Nenhuma evolução registrada"
                    description="As anotações de cada atendimento aparecem aqui, mais recente primeiro."
                  />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {client.evolution.map((n) => (
                      <div key={n.id} className="rounded-[6px] border-l-2 border-hud bg-hud/[0.03] px-4 py-3">
                        <div className="text-[11px] text-ink-faint">
                          {formatShortDate(new Date(n.at))} · {n.author}
                        </div>
                        <div className="mt-1 text-[13px] leading-relaxed text-ink">{n.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'historico' &&
              (history.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Nenhum procedimento no período"
                  description={`Sem atendimentos nos últimos ${HISTORY_DAYS} dias.`}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-stroke text-[11px] text-ink-faint">
                        <th className="pb-2 pr-3 font-medium">Data</th>
                        <th className="pb-2 pr-3 font-medium">Procedimento</th>
                        <th className="pb-2 pr-3 font-medium">Valor</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(({ date, appointment }) => (
                        <tr key={appointment.id} className="border-b border-stroke/60">
                          <td className="py-2.5 pr-3 text-ink-dim">{formatShortDate(date)}</td>
                          <td className="py-2.5 pr-3 font-medium text-ink">
                            {appointment.services.join(', ')}
                          </td>
                          <td className="py-2.5 pr-3 tnum text-ink">{formatBRL(appointment.priceCents)}</td>
                          <td className="py-2.5">
                            <Badge tone={STATUS_TONE[appointment.status]}>
                              {STATUS_LABEL[appointment.status]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </HolographicPanel>
      </div>
    </div>
  );
}
