import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CircleUserRound,
  Plus,
  Repeat,
  Smile,
  Tag,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { FilterChips, SearchInput, SortCycle } from '@/components/ui/Toolbar';
import { Callout, Field, SelectField, TextareaField, Toggle } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';

import { CLIENT_TAGS } from '@/data/mock';
import type { ClientInsights, ClientRecord } from '@/data/types';
import { insert, nextId, remove, update, useOperations } from '@/services/store';
import {
  HISTORY_DAYS,
  LAPSED_DAYS,
  clientHistory,
  daysAgo,
  insightsByClient,
  isLapsed,
} from '@/services/insightsService';
import { formatBRL, formatInt, formatShortDate, initials } from '@/utils/format';
import { cn } from '@/utils/cn';

type ClientFilter = 'all' | 'recurring' | 'lapsed' | 'new' | 'noshow';

type SortKey = 'name' | 'lastVisit' | 'spent' | 'visits';

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'lastVisit', label: 'Última visita' },
  { value: 'name', label: 'Nome' },
  { value: 'spent', label: 'Gasto' },
  { value: 'visits', label: 'Visitas' },
];

/** Paciente cadastrado nos últimos 30 dias. */
const NEW_CLIENT_DAYS = 30;

/** Quantas fichas a lista mostra antes de pedir para carregar mais. */
const PAGE_SIZE = 40;

function blankClient(): ClientRecord {
  return {
    id: '',
    name: '',
    phone: '',
    email: '',
    birthDate: null,
    tags: [],
    notes: '',
    createdAt: new Date().toISOString(),
    preferredProfessionalId: null,
    active: true,
  };
}

function daysSince(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function Clients() {
  const navigate = useNavigate();
  const operations = useOperations();
  const { clients, professionals } = operations;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [sort, setSort] = useState<SortKey>('lastVisit');
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  // A base cresce sem teto; mostrar tudo de uma vez faria a página passar de
  // dez mil pixels de altura já com algumas centenas de fichas.
  const [limit, setLimit] = useState(PAGE_SIZE);

  const from = useMemo(() => daysAgo(HISTORY_DAYS), []);
  const to = useMemo(() => new Date(), []);

  // Uma varredura da janela inteira alimenta a tabela toda. Recalcular por
  // linha custaria 84 releituras de 180 dias a cada tecla digitada na busca.
  const insights = useMemo(() => insightsByClient(from, to), [from, to, operations]);

  const counts = useMemo(() => {
    let recurring = 0;
    let lapsed = 0;
    let fresh = 0;
    let noshow = 0;

    for (const client of clients) {
      const data = insights.get(client.id);
      if ((data?.visits ?? 0) >= 3) recurring += 1;
      if (isLapsed(data)) lapsed += 1;
      if (daysSince(client.createdAt) <= NEW_CLIENT_DAYS) fresh += 1;
      if ((data?.noShows ?? 0) > 0) noshow += 1;
    }
    return { recurring, lapsed, fresh, noshow };
  }, [clients, insights]);

  const FILTERS: Array<{ value: ClientFilter; label: string; count?: number }> = [
    { value: 'all', label: 'Todos', count: clients.length },
    { value: 'recurring', label: 'Recorrentes', count: counts.recurring },
    { value: 'lapsed', label: `Sumidos +${LAPSED_DAYS}d`, count: counts.lapsed },
    { value: 'new', label: 'Novos', count: counts.fresh },
    { value: 'noshow', label: 'Com faltas', count: counts.noshow },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clients
      .filter((c) => {
        const data = insights.get(c.id);

        if (filter === 'recurring' && (data?.visits ?? 0) < 3) return false;
        if (filter === 'lapsed' && !isLapsed(data)) return false;
        if (filter === 'new' && daysSince(c.createdAt) > NEW_CLIENT_DAYS) return false;
        if (filter === 'noshow' && (data?.noShows ?? 0) === 0) return false;

        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.tags.some((t) => t.includes(q))
        );
      })
      .sort((a, b) => {
        const da = insights.get(a.id);
        const db = insights.get(b.id);

        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'spent') return (db?.spentCents ?? 0) - (da?.spentCents ?? 0);
        if (sort === 'visits') return (db?.visits ?? 0) - (da?.visits ?? 0);

        // Sem visita na janela vai para o fim, não para o topo: quem nunca veio
        // não é "o mais recente".
        const ta = da?.lastVisitAt ? new Date(da.lastVisitAt).getTime() : -Infinity;
        const tb = db?.lastVisitAt ? new Date(db.lastVisitAt).getTime() : -Infinity;
        return tb - ta;
      });
  }, [clients, insights, query, filter, sort]);

  const stats = useMemo(() => {
    const totals = [...insights.values()];
    const visits = totals.reduce((acc, d) => acc + d.visits, 0);
    const noShows = totals.reduce((acc, d) => acc + d.noShows, 0);
    const spent = totals.reduce((acc, d) => acc + d.spentCents, 0);

    return [
      {
        label: 'PACIENTES ATIVOS',
        value: formatInt(clients.filter((c) => c.active).length),
        hint: `${formatInt(counts.fresh)} novos em ${NEW_CLIENT_DAYS} dias`,
        icon: Users,
      },
      {
        label: 'RECORRENTES',
        value: formatInt(counts.recurring),
        hint: '3 ou mais visitas na janela',
        icon: Repeat,
        tone: 'success' as const,
      },
      {
        label: `SUMIDOS +${LAPSED_DAYS}D`,
        value: formatInt(counts.lapsed),
        hint: 'já vieram e pararam',
        icon: TrendingDown,
        tone: 'warn' as const,
      },
      {
        label: 'ÍNDICE DE FALTAS',
        value: `${visits + noShows ? ((noShows / (visits + noShows)) * 100).toFixed(1).replace('.', ',') : '0,0'}%`,
        hint: `${formatInt(noShows)} faltas · ticket ${formatBRL(visits ? Math.round(spent / visits) : 0)}`,
        icon: CalendarClock,
        tone: noShows > 0 ? ('critical' as const) : ('hud' as const),
      },
    ];
  }, [clients, insights, counts]);

  function save(draft: ClientRecord) {
    if (draft.id) update('clients', draft.id, draft);
    else insert('clients', { ...draft, id: nextId('c') });
    setEditing(null);
  }

  const columns: Array<Column<ClientRecord>> = [
    {
      key: 'client',
      header: 'Paciente',
      render: (c) => {
        const data = insights.get(c.id);
        return (
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[10px] font-semibold',
                isLapsed(data)
                  ? 'border border-warn/40 bg-warn/10 text-warn'
                  : 'border border-hud/25 bg-hud/[0.08] text-hud',
              )}
            >
              {initials(c.name)}
            </span>
            <span className="min-w-0">
              <span className={cn('block truncate text-[12.5px] font-medium', c.active ? 'text-ink' : 'text-ink-faint')}>
                {c.name}
              </span>
              <span className="block truncate font-mono text-[10.5px] text-ink-faint tnum">
                {c.phone}
              </span>
            </span>
          </div>
        );
      },
    },
    {
      key: 'tags',
      header: 'Etiquetas',
      hideUntil: 'xl',
      render: (c) =>
        c.tags.length === 0 ? (
          <span className="text-[11px] text-ink-faint">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {c.tags.slice(0, 2).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            {c.tags.length > 2 && <span className="text-[10px] text-ink-faint">+{c.tags.length - 2}</span>}
          </span>
        ),
    },
    {
      key: 'lastVisit',
      header: 'Última visita',
      hideUntil: 'md',
      render: (c) => {
        const data = insights.get(c.id);
        if (!data?.lastVisitAt) {
          return <span className="text-[11px] text-ink-faint">Sem visita na janela</span>;
        }
        const days = data.daysSinceLastVisit ?? 0;
        return (
          <span className="min-w-0">
            <span className="block font-mono text-[11.5px] text-ink-dim tnum">
              {formatShortDate(new Date(data.lastVisitAt))}
            </span>
            <span className={cn('block text-[10.5px]', isLapsed(data) ? 'text-warn' : 'text-ink-faint')}>
              {days === 0 ? 'hoje' : `há ${days} dia${days === 1 ? '' : 's'}`}
            </span>
          </span>
        );
      },
    },
    {
      key: 'visits',
      header: 'Visitas',
      align: 'right',
      hideUntil: 'sm',
      render: (c) => {
        const data = insights.get(c.id);
        return (
          <span className="min-w-0">
            <span className="block font-mono text-[12px] text-ink tnum">
              {formatInt(data?.visits ?? 0)}
            </span>
            {(data?.noShows ?? 0) > 0 && (
              <span className="block font-mono text-[10px] text-warn tnum">
                {data?.noShows} falta{data?.noShows === 1 ? '' : 's'}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'spent',
      header: 'Gasto',
      align: 'right',
      hideUntil: 'lg',
      render: (c) => (
        <span className="font-mono text-[12px] text-ink tnum">
          {formatBRL(insights.get(c.id)?.spentCents ?? 0)}
        </span>
      ),
    },
    {
      key: 'prontuario',
      header: '',
      align: 'right',
      render: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/app/clients/${c.id}`);
          }}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-stroke px-2.5 py-1.5 text-[11.5px] font-medium text-ink-dim transition-colors hover:border-hud/40 hover:text-hud"
        >
          <Smile size={13} /> Prontuário
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatStrip stats={stats} />

      {counts.lapsed > 0 && filter !== 'lapsed' && (
        <Callout tone="warn" icon={<TrendingDown size={13} />}>
          <strong>{counts.lapsed} paciente(s)</strong> não voltam há mais de {LAPSED_DAYS} dias.{' '}
          <button
            onClick={() => setFilter('lapsed')}
            className="underline underline-offset-2 hover:text-ink"
          >
            Ver a lista
          </button>{' '}
          para decidir quem vale uma mensagem.
        </Callout>
      )}

      <HolographicPanel
        title="Pacientes"
        meta={`${formatInt(Math.min(limit, rows.length))} DE ${formatInt(rows.length)}`}
        icon={<Users size={14} />}
        actions={
          <TechButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setEditing(blankClient())}
          >
            Novo
          </TechButton>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                // Busca nova recomeça do topo: manter a página anterior
                // esconderia resultados que acabaram de entrar na lista.
                setLimit(PAGE_SIZE);
              }}
              placeholder="Buscar por nome, telefone, e-mail ou etiqueta"
            />
            <SortCycle options={SORTS} value={sort} onChange={setSort} />
          </div>
          <FilterChips
            options={FILTERS}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setLimit(PAGE_SIZE);
            }}
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows.slice(0, limit)}
          onRowClick={setEditing}
          empty="Nenhum paciente corresponde a esse recorte."
        />

        {rows.length > limit && (
          <div className="mt-4 flex items-center justify-center gap-3 border-t border-hud/10 pt-4">
            <span className="tech-label">
              {formatInt(rows.length - limit)} FICHA{rows.length - limit === 1 ? '' : 'S'} A MAIS
            </span>
            <TechButton onClick={() => setLimit((l) => l + PAGE_SIZE)}>Carregar mais</TechButton>
          </div>
        )}
      </HolographicPanel>

      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? editing.name : 'Novo paciente'}
        subtitle={editing?.id ? editing.phone : 'Cadastro na base'}
        icon={<CircleUserRound size={15} />}
        width={480}
      >
        {editing && (
          <ClientForm
            key={editing.id || 'new'}
            initial={editing}
            insights={insights.get(editing.id)}
            professionals={professionals}
            onSave={save}
            onDelete={(id) => {
              remove('clients', id);
              setEditing(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

/* ==========================================================================
   FICHA DO CLIENTE
   ========================================================================= */

function ClientForm({
  initial,
  insights,
  professionals,
  onSave,
  onDelete,
}: {
  initial: ClientRecord;
  insights?: ClientInsights;
  professionals: ReturnType<typeof useOperations>['professionals'];
  onSave: (draft: ClientRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ClientRecord>(initial);
  const [tab, setTab] = useState<'ficha' | 'historico'>('ficha');
  const [customTag, setCustomTag] = useState('');

  const set = <K extends keyof ClientRecord>(key: K, value: ClientRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const history = useMemo(
    () => (initial.id ? clientHistory(initial.id, daysAgo(HISTORY_DAYS), new Date()) : []),
    [initial.id],
  );

  const staffName = (id: string | null) =>
    professionals.find((p) => p.id === id)?.name ?? null;

  const invalid = draft.name.trim().length < 3;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- resumo derivado ---------- */}
      {initial.id && (
        <section className="grid grid-cols-2 gap-2">
          {[
            ['VISITAS', formatInt(insights?.visits ?? 0)],
            ['GASTO TOTAL', formatBRL(insights?.spentCents ?? 0)],
            ['TICKET MÉDIO', formatBRL(insights?.avgTicketCents ?? 0)],
            [
              'CADÊNCIA',
              insights?.cadenceDays ? `${insights.cadenceDays} dias` : '—',
            ],
            ['FALTAS', formatInt(insights?.noShows ?? 0)],
            ['CANCELAMENTOS', formatInt(insights?.cancellations ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-hud/10 bg-white/[0.02] px-3 py-2">
              <div className="tech-label">{label}</div>
              <div className="mt-1 truncate font-mono text-[12px] text-ink tnum">{value}</div>
            </div>
          ))}
        </section>
      )}

      {isLapsed(insights) && (
        <Callout tone="warn" icon={<TrendingDown size={13} />}>
          Sem voltar há <strong>{insights?.daysSinceLastVisit} dias</strong>
          {insights?.cadenceDays ? `, contra uma cadência de ${insights.cadenceDays} dias.` : '.'}{' '}
          {insights?.topServiceName && `Costumava fazer ${insights.topServiceName}.`}
        </Callout>
      )}

      {/* ---------- abas ---------- */}
      {initial.id && (
        <div className="flex gap-1.5 border-b border-hud/12 pb-3">
          {(
            [
              ['ficha', 'Ficha'],
              ['historico', `Histórico (${history.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'rounded-[8px] border px-3 py-1.5 font-mono text-[10px] transition-all duration-200',
                tab === value
                  ? 'border-hud/50 bg-hud/12 text-hud'
                  : 'border-stroke/60 text-ink-faint hover:border-hud/30',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'historico' && initial.id ? (
        history.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Sem atendimentos"
            description={`Nenhum registro nos últimos ${HISTORY_DAYS} dias. O histórico anterior a essa janela não é carregado.`}
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.map(({ date, appointment }) => (
              <li
                key={appointment.id}
                className="flex items-center gap-3 rounded-[8px] border border-hud/[0.09] bg-white/[0.015] px-3 py-2.5"
              >
                <div className="shrink-0">
                  <div className="font-mono text-[11.5px] text-ink tnum">
                    {formatShortDate(date)}
                  </div>
                  <div className="font-mono text-[10px] text-ink-faint tnum">{appointment.time}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-ink-dim">
                    {appointment.services.join(' + ')}
                  </div>
                  <div className="truncate text-[10.5px] text-ink-faint">
                    {staffName(appointment.professionalId) ?? '—'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-[11.5px] text-ink tnum">
                    {formatBRL(appointment.priceCents)}
                  </span>
                  <Badge
                    tone={
                      appointment.status === 'concluido'
                        ? 'ok'
                        : appointment.status === 'falta'
                          ? 'warn'
                          : appointment.status === 'cancelado'
                            ? 'critical'
                            : 'live'
                    }
                  >
                    {appointment.status === 'falta' ? 'faltou' : appointment.status.replace('_', ' ')}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <Field label="NOME" value={draft.name} onChange={(e) => set('name', e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="TELEFONE"
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(11) 90000-0000"
            />
            <Field
              label="NASCIMENTO"
              type="date"
              value={draft.birthDate ?? ''}
              onChange={(e) => set('birthDate', e.target.value || null)}
            />
          </div>

          <Field
            label="E-MAIL"
            type="email"
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="CONVÊNIO"
              value={draft.insurance ?? ''}
              onChange={(e) => set('insurance', e.target.value)}
              placeholder="Particular"
            />
            <Field
              label="ALERGIAS"
              value={draft.allergies ?? ''}
              onChange={(e) => set('allergies', e.target.value)}
              placeholder="Nenhuma conhecida"
            />
          </div>

          <SelectField
            label="PROFISSIONAL DE PREFERÊNCIA"
            value={draft.preferredProfessionalId ?? ''}
            onChange={(e) => set('preferredProfessionalId', e.target.value || null)}
          >
            <option value="">Sem preferência</option>
            {professionals
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </SelectField>

          {/* ---------- etiquetas ---------- */}
          <section className="flex flex-col gap-2 rounded-[8px] border border-hud/12 bg-white/[0.015] p-3">
            <div className="flex items-center gap-2">
              <Tag size={13} className="text-hud/70" />
              <span className="tech-label">ETIQUETAS</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...CLIENT_TAGS, ...draft.tags])].map((tag) => {
                const selected = draft.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      set('tags', selected ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag])
                    }
                    className={cn(
                      'rounded-[8px] border px-2 py-1 font-mono text-[10px] transition-all duration-200',
                      selected
                        ? 'border-hud/50 bg-hud/12 text-hud'
                        : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const tag = customTag.trim().toLowerCase();
                  if (tag && !draft.tags.includes(tag)) set('tags', [...draft.tags, tag]);
                  setCustomTag('');
                }}
                placeholder="Nova etiqueta e Enter"
                className="flex-1 rounded-[8px] border border-stroke/70 bg-void/50 px-2.5 py-1.5 text-[11.5px] text-ink outline-none transition-colors placeholder:text-ink-faint/60 focus:border-hud/60"
              />
            </div>
          </section>

          <TextareaField
            label="OBSERVAÇÕES"
            rows={3}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Alergias, preferências de corte, o que não repetir"
            hint="Visível para toda a equipe na hora do atendimento."
          />

          <Toggle
            label="Paciente ativo"
            description="Inativo some das buscas da agenda, sem perder o histórico."
            checked={draft.active}
            onChange={(checked) => set('active', checked)}
          />
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <TechButton
          variant="primary"
          disabled={invalid}
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          className="justify-center py-3"
        >
          {initial.id ? 'Salvar alterações' : 'Cadastrar paciente'}
        </TechButton>

        {initial.id && (
          <ConfirmButton
            icon={<Trash2 size={12} />}
            confirmLabel="Excluir mesmo assim?"
            onConfirm={() => onDelete(initial.id)}
            className="justify-center"
          >
            Excluir cadastro
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
