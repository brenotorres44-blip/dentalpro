import { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  CalendarRange,
  Percent,
  Plus,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { FilterChips, SearchInput } from '@/components/ui/Toolbar';
import { Callout, Field, Toggle } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { HolographicAvatar } from '@/components/dashboard/HolographicAvatar';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { extensionOf, photoPath, publicUrl } from '@/services/mediaService';
import { useSession } from '@/auth/SessionProvider';

import type { DayShift, ProfessionalRecord } from '@/data/types';
import { insert, nextId, remove, update, useOperations } from '@/services/store';
import {
  PERFORMANCE_DAYS,
  lastNDays,
  performanceByProfessional,
  type ProfessionalPerformance,
} from '@/services/insightsService';
import { formatBRL, formatInt, formatPercent, WEEKDAYS_SHORT } from '@/utils/format';
import { formatDuration } from '@/utils/time';
import { cn } from '@/utils/cn';

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

const DEFAULT_SHIFT: DayShift = { start: '09:00', end: '18:00' };

function blankProfessional(): ProfessionalRecord {
  return {
    id: '',
    name: '',
    role: 'Cirurgião-dentista',
    email: '',
    phone: '',
    hiredAt: new Date().toISOString().slice(0, 10),
    active: true,
    rating: 5,
    // Matiz distante das já usadas, para o avatar não nascer igual ao de outro.
    // É o retrato de quem ainda não enviou foto, e some quando `photoPath` vem.
    hue: Math.round(140 + Math.random() * 120),
    photoPath: null,
    serviceCommissionPct: 40,
    productCommissionPct: 8,
    schedule: [null, ...Array.from({ length: 5 }, () => ({ ...DEFAULT_SHIFT })), { ...DEFAULT_SHIFT }],
    serviceIds: [],
  };
}

export function Professionals() {
  const operations = useOperations();
  const { professionals, services } = operations;

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ProfessionalRecord | null>(null);

  const { from, to } = useMemo(() => lastNDays(PERFORMANCE_DAYS), []);

  const performance = useMemo(
    () => performanceByProfessional(from, to),
    // `operations` entra na lista porque a agenda e a equipe saem do store:
    // concluir um atendimento precisa mover o ranking na mesma leitura.
    [from, to, operations],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return professionals
      .filter((p) => {
        if (status === 'active' && !p.active) return false;
        if (status === 'inactive' && p.active) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.role.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Inativos sempre no fim: a lista serve para operar a equipe atual.
        if (a.active !== b.active) return a.active ? -1 : 1;
        const pa = performance.get(a.id)?.revenueCents ?? 0;
        const pb = performance.get(b.id)?.revenueCents ?? 0;
        return pb - pa;
      });
  }, [professionals, query, status, performance]);

  const stats = useMemo(() => {
    const active = professionals.filter((p) => p.active);
    const totals = [...performance.values()];
    const revenue = totals.reduce((acc, p) => acc + p.revenueCents, 0);
    const appointments = totals.reduce((acc, p) => acc + p.appointments, 0);
    const booked = totals.reduce((acc, p) => acc + p.bookedMinutes, 0);
    const available = totals.reduce((acc, p) => acc + p.availableMinutes, 0);
    const commission = totals.reduce(
      (acc, p) => acc + p.serviceCommissionCents + p.productCommissionCents,
      0,
    );

    return [
      {
        label: 'EQUIPE ATIVA',
        value: formatInt(active.length),
        hint: `${professionals.length - active.length} inativo(s)`,
        icon: Users,
      },
      {
        label: 'OCUPAÇÃO MÉDIA',
        value: formatPercent(available ? (booked / available) * 100 : 0),
        hint: `últimos ${PERFORMANCE_DAYS} dias`,
        icon: Activity,
        tone: 'electric' as const,
      },
      {
        label: 'TICKET MÉDIO',
        value: formatBRL(appointments ? Math.round(revenue / appointments) : 0),
        hint: `${formatInt(appointments)} atendimentos`,
        icon: Award,
        tone: 'success' as const,
      },
      {
        label: 'COMISSÕES',
        value: formatBRL(commission),
        hint: 'a pagar no período',
        icon: Percent,
        tone: 'warn' as const,
      },
    ];
  }, [professionals, performance]);

  /*
   * Quem decide entre criar e atualizar é a **lista**, não o `id` do rascunho.
   *
   * O formulário passou a nascer com um id (o caminho da foto no bucket precisa
   * dele antes de a ficha existir), então "tem id" deixou de significar "já foi
   * salvo". Perguntar à lista responde a pergunta certa.
   */
  function save(draft: ProfessionalRecord) {
    if (professionals.some((p) => p.id === draft.id)) update('professionals', draft.id, draft);
    else insert('professionals', draft);
    setEditing(null);
  }

  const columns: Array<Column<ProfessionalRecord>> = [
    {
      key: 'name',
      header: 'Profissional',
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <HolographicAvatar
            name={p.name}
            hue={p.hue}
            photoUrl={publicUrl(p.photoPath)}
            status={p.active ? 'disponivel' : 'offline'}
            size={30}
          />
          <span className="min-w-0">
            <span className={cn('block truncate text-[12.5px] font-medium', p.active ? 'text-ink' : 'text-ink-faint')}>
              {p.name}
            </span>
            <span className="block truncate text-[10.5px] text-ink-faint">{p.role}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Jornada',
      hideUntil: 'lg',
      render: (p) => {
        const days = p.schedule.filter(Boolean).length;
        const first = p.schedule.find(Boolean);
        return (
          <span className="min-w-0">
            <span className="block font-mono text-[11px] text-ink-dim tnum">
              {first ? `${first.start} — ${first.end}` : 'Sem escala'}
            </span>
            <span className="block text-[10.5px] text-ink-faint">
              {days} {days === 1 ? 'dia' : 'dias'} por semana
            </span>
          </span>
        );
      },
    },
    {
      key: 'occupancy',
      header: 'Ocupação',
      hideUntil: 'md',
      width: '130px',
      render: (p) => {
        const perf = performance.get(p.id);
        return (
          <div className="flex items-center gap-2">
            <ProgressBar value={perf?.occupancyPct ?? 0} label={`Ocupação de ${p.name}`} />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] text-ink-dim tnum">
              {perf?.occupancyPct ?? 0}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'revenue',
      header: 'Receita',
      align: 'right',
      hideUntil: 'sm',
      render: (p) => (
        <span className="min-w-0">
          <span className="block font-mono text-[12px] text-ink tnum">
            {formatBRL(performance.get(p.id)?.revenueCents ?? 0)}
          </span>
          <span className="block text-[10.5px] text-ink-faint">
            {formatInt(performance.get(p.id)?.appointments ?? 0)} atend.
          </span>
        </span>
      ),
    },
    {
      key: 'commission',
      header: 'Comissão',
      align: 'right',
      hideUntil: 'xl',
      render: (p) => (
        <span className="font-mono text-[11px] text-warn tnum">
          {p.serviceCommissionPct}%
          <span className="ml-1 text-ink-faint">/ {p.productCommissionPct}%</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (p) => <Badge tone={p.active ? 'ok' : 'idle'}>{p.active ? 'ativo' : 'inativo'}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatStrip stats={stats} />

      <HolographicPanel
        title="Equipe"
        meta={`ÚLTIMOS ${PERFORMANCE_DAYS} DIAS`}
        icon={<UserRound size={14} />}
        actions={
          <TechButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setEditing(blankProfessional())}
          >
            Novo
          </TechButton>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por nome, função ou e-mail"
          />
          <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={setEditing}
          empty="Nenhum profissional corresponde à busca."
        />
      </HolographicPanel>

      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? editing.name : 'Novo profissional'}
        subtitle={editing?.id ? editing.role : 'Cadastro na equipe'}
        icon={<UserRound size={15} />}
        width={460}
      >
        {editing && (
          <ProfessionalForm
            key={editing.id || 'new'}
            initial={editing}
            services={services}
            performance={performance.get(editing.id)}
            onSave={save}
            onDelete={(id) => {
              remove('professionals', id);
              setEditing(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

/* ==========================================================================
   FORMULÁRIO
   ========================================================================= */

function ProfessionalForm({
  initial,
  services,
  performance,
  onSave,
  onDelete,
}: {
  initial: ProfessionalRecord;
  services: ReturnType<typeof useOperations>['services'];
  performance?: ProfessionalPerformance;
  onSave: (draft: ProfessionalRecord) => void;
  onDelete: (id: string) => void;
}) {
  const { company } = useSession();
  const [draft, setDraft] = useState<ProfessionalRecord>(initial);

  /**
   * Id estável desde a abertura, mesmo antes de salvar.
   *
   * O caminho no bucket é `<empresa>/profissionais/<id>.<ext>`, e ele precisa
   * existir na hora do envio — que acontece antes do "Salvar". Gerar o id aqui
   * evita as duas saídas ruins: exigir salvar a ficha antes de poder escolher a
   * foto, ou gravar a imagem num caminho provisório e ter de movê-la depois.
   *
   * Quem envia foto e desiste de salvar deixa um arquivo órfão no bucket. É o
   * mesmo comportamento que a logo já tem, e o preço é um arquivo de até 2 MB
   * que ninguém referencia — barato perto das alternativas.
   */
  const [id] = useState(() => initial.id || nextId('p'));

  const set = <K extends keyof ProfessionalRecord>(key: K, value: ProfessionalRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function setDay(index: number, shift: DayShift | null) {
    set(
      'schedule',
      draft.schedule.map((day, i) => (i === index ? shift : day)) as ProfessionalRecord['schedule'],
    );
  }

  const invalid = draft.name.trim().length < 3;
  const activeServices = services.filter((s) => s.active);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- desempenho ---------- */}
      {initial.id && performance && (
        <section className="grid grid-cols-3 gap-2">
          {[
            ['ATENDIMENTOS', formatInt(performance.appointments)],
            ['RECEITA', formatBRL(performance.revenueCents)],
            ['TICKET', formatBRL(performance.avgTicketCents)],
            ['OCUPAÇÃO', `${performance.occupancyPct}%`],
            ['FALTAS', formatInt(performance.noShows)],
            [
              'COMISSÃO',
              formatBRL(performance.serviceCommissionCents + performance.productCommissionCents),
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[3px] border border-hud/10 bg-white/[0.02] px-2.5 py-2">
              <div className="tech-label">{label}</div>
              <div className="mt-1 truncate font-mono text-[11.5px] text-ink tnum">{value}</div>
            </div>
          ))}
        </section>
      )}

      {/* A imagem vai para o bucket no envio; o **caminho** entra no rascunho e
          só chega à tabela ao salvar — mesmo desenho da logo em Configurações. */}
      {company && (
        <ImageUpload
          label="FOTO"
          hint="Aparece na página pública da clínica. Sem foto, fica o avatar colorido. Até 2 MB."
          currentPath={draft.photoPath}
          path={(file) => photoPath(company.id, id, extensionOf(file))}
          onUploaded={(path) => set('photoPath', path)}
        />
      )}

      <Field label="NOME" value={draft.name} onChange={(e) => set('name', e.target.value)} />
      <Field
        label="FUNÇÃO"
        value={draft.role}
        onChange={(e) => set('role', e.target.value)}
        hint="Aparece na agenda e no perfil público"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="E-MAIL" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
        <Field label="TELEFONE" value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="ADMISSÃO"
          type="date"
          value={draft.hiredAt.slice(0, 10)}
          onChange={(e) => set('hiredAt', e.target.value)}
        />
        <Field
          label="AVALIAÇÃO"
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={draft.rating}
          onChange={(e) => set('rating', Math.min(5, Math.max(0, Number(e.target.value))))}
        />
      </div>

      <Toggle
        label="Profissional ativo"
        description="Inativo não aparece na agenda nem recebe novos agendamentos."
        checked={draft.active}
        onChange={(checked) => set('active', checked)}
      />

      {/* ---------- comissões ---------- */}
      <section className="flex flex-col gap-3 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
        <span className="tech-label">COMISSÕES</span>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="SERVIÇO (%)"
            type="number"
            min={0}
            max={100}
            value={draft.serviceCommissionPct}
            onChange={(e) =>
              set('serviceCommissionPct', Math.min(100, Math.max(0, Number(e.target.value))))
            }
          />
          <Field
            label="PRODUTO (%)"
            type="number"
            min={0}
            max={100}
            value={draft.productCommissionPct}
            onChange={(e) =>
              set('productCommissionPct', Math.min(100, Math.max(0, Number(e.target.value))))
            }
          />
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Incide sobre o valor efetivamente cobrado. O financeiro calcula a partir dos atendimentos
          concluídos — não há lançamento manual de comissão.
        </p>
      </section>

      {/* ---------- jornada ---------- */}
      <section className="flex flex-col gap-2 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={13} className="text-hud/70" />
          <span className="tech-label">JORNADA SEMANAL</span>
        </div>

        {draft.schedule.map((shift, index) => (
          <div key={index} className="flex flex-col gap-2 border-t border-hud/[0.07] pt-2 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'font-mono text-[11px] uppercase tracking-[0.14em]',
                  shift ? 'text-ink' : 'text-ink-faint',
                )}
              >
                {WEEKDAYS_SHORT[index]}
              </span>
              <button
                type="button"
                onClick={() => setDay(index, shift ? null : { ...DEFAULT_SHIFT })}
                className={cn(
                  'rounded-[3px] border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-200',
                  shift
                    ? 'border-hud/40 bg-hud/10 text-hud'
                    : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                )}
              >
                {shift ? 'Trabalha' : 'Folga'}
              </button>
            </div>

            {shift && (
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ['start', 'ENTRA'],
                    ['end', 'SAI'],
                    ['breakStart', 'PAUSA'],
                    ['breakEnd', 'VOLTA'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="tech-label text-[9px]">{label}</span>
                    <input
                      type="time"
                      value={shift[key] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const next: DayShift = { ...shift };
                        if (key === 'start' || key === 'end') next[key] = value;
                        else if (value) next[key] = value;
                        else delete next[key];
                        setDay(index, next);
                      }}
                      className="w-full rounded-[3px] border border-stroke/70 bg-void/50 px-1.5 py-1.5 text-center font-mono text-[11px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <p className="text-[11px] text-ink-faint">
          Total semanal:{' '}
          <span className="font-mono text-ink-dim">
            {formatDuration(
              draft.schedule.reduce((acc, shift) => {
                if (!shift) return acc;
                const [sh, sm] = shift.start.split(':').map(Number);
                const [eh, em] = shift.end.split(':').map(Number);
                return acc + Math.max(0, eh * 60 + em - (sh * 60 + sm));
              }, 0),
            )}
          </span>
        </p>
      </section>

      {/* ---------- serviços executados ---------- */}
      <section className="flex flex-col gap-2 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
        <span className="tech-label">SERVIÇOS QUE EXECUTA</span>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Nenhum marcado significa <strong>todos</strong> — é o caso comum, e obrigar a marcar oito
          itens no cadastro de cada dentista só geraria erro de omissão.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {activeServices.map((s) => {
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
                  'rounded-[3px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-200',
                  selected
                    ? 'border-hud/50 bg-hud/12 text-hud'
                    : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <TechButton
          variant="primary"
          disabled={invalid}
          onClick={() => onSave({ ...draft, id, name: draft.name.trim() })}
          className="justify-center py-3"
        >
          {initial.id ? 'Salvar alterações' : 'Cadastrar profissional'}
        </TechButton>

        {initial.id && (
          <>
            {(performance?.appointments ?? 0) > 0 && (
              <Callout tone="warn">
                {formatInt(performance?.appointments ?? 0)} atendimento(s) nos últimos{' '}
                {PERFORMANCE_DAYS} dias estão vinculados a esta pessoa. Desative em vez de excluir
                para manter o histórico e as comissões auditáveis.
              </Callout>
            )}
            <ConfirmButton
              icon={<Trash2 size={12} />}
              confirmLabel="Excluir mesmo assim?"
              onConfirm={() => onDelete(initial.id)}
              className="justify-center"
            >
              Excluir da equipe
            </ConfirmButton>
          </>
        )}
      </div>
    </div>
  );
}
