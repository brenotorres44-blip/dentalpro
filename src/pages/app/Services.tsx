import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  Layers,
  Plus,
  Smile,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { FilterChips, SearchInput, SortCycle } from '@/components/ui/Toolbar';
import {
  Callout,
  Field,
  MoneyField,
  SelectField,
  TextareaField,
  Toggle,
} from '@/components/ui/Field';

import type { ServiceCategory, ServiceItem } from '@/data/types';
import { insert, nextId, remove, update, useOperations } from '@/services/store';
import { listRange } from '@/services/agendaService';
import { formatBRL, formatInt } from '@/utils/format';
import { formatDuration } from '@/utils/time';
import { cn } from '@/utils/cn';

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  avaliacao: 'Avaliação',
  preventivo: 'Preventivo',
  restaurador: 'Restaurador',
  estetico: 'Estético',
  cirurgico: 'Cirúrgico',
  combo: 'Combo',
};

const CATEGORY_FILTERS: Array<{ value: ServiceCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'restaurador', label: 'Restaurador' },
  { value: 'estetico', label: 'Estético' },
  { value: 'cirurgico', label: 'Cirúrgico' },
  { value: 'combo', label: 'Combos' },
];

type SortKey = 'name' | 'price' | 'duration';

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'name', label: 'Nome' },
  { value: 'price', label: 'Preço' },
  { value: 'duration', label: 'Duração' },
];

/** Procedimento em branco — o formulário nasce com valores plausíveis, não com zeros. */
function blankService(): ServiceItem {
  return {
    id: '',
    name: '',
    description: '',
    category: 'avaliacao',
    priceCents: 5000,
    durationMin: 30,
    bufferMin: 5,
    active: true,
    priceOverrides: {},
    comboOf: [],
    weight: 0,
  };
}

export function Services() {
  const { services, professionals } = useOperations();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ServiceCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [editing, setEditing] = useState<ServiceItem | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services
      .filter((s) => {
        if (category !== 'all' && s.category !== category) return false;
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sort === 'price') return b.priceCents - a.priceCents;
        if (sort === 'duration') return b.durationMin - a.durationMin;
        return a.name.localeCompare(b.name);
      });
  }, [services, query, category, sort]);

  const active = services.filter((s) => s.active);

  const stats = useMemo(() => {
    const simple = active.filter((s) => s.comboOf.length === 0);
    const avgPrice = simple.length
      ? Math.round(simple.reduce((acc, s) => acc + s.priceCents, 0) / simple.length)
      : 0;
    const avgDuration = simple.length
      ? Math.round(simple.reduce((acc, s) => acc + s.durationMin, 0) / simple.length)
      : 0;
    const withOverrides = active.filter((s) => Object.keys(s.priceOverrides).length > 0).length;

    return [
      {
        label: 'PROCEDIMENTOS ATIVOS',
        value: formatInt(active.length),
        hint: `${services.length - active.length} desativado(s)`,
        icon: Smile,
      },
      {
        label: 'PREÇO MÉDIO',
        value: formatBRL(avgPrice),
        hint: 'somente procedimentos avulsos',
        icon: Wallet,
        tone: 'success' as const,
      },
      {
        label: 'DURAÇÃO MÉDIA',
        value: formatDuration(avgDuration),
        hint: 'tempo de cadeira',
        icon: Clock3,
        tone: 'electric' as const,
      },
      {
        label: 'TABELA PRÓPRIA',
        value: formatInt(withOverrides),
        hint: 'com preço por profissional',
        icon: Layers,
      },
    ];
  }, [services, active]);

  function save(draft: ServiceItem) {
    if (draft.id) {
      update('services', draft.id, draft);
    } else {
      insert('services', { ...draft, id: nextId('s') });
    }
    setEditing(null);
  }

  const columns: Array<Column<ServiceItem>> = [
    {
      key: 'name',
      header: 'Procedimento',
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border',
              s.active ? 'border-hud/25 bg-hud/[0.08] text-hud' : 'border-stroke/60 text-ink-faint',
            )}
          >
            {s.comboOf.length > 0 ? <Sparkles size={13} /> : <Smile size={13} />}
          </span>
          <span className="min-w-0">
            <span className={cn('block truncate text-[12.5px] font-medium', s.active ? 'text-ink' : 'text-ink-faint')}>
              {s.name}
            </span>
            <span className="block truncate text-[10.5px] text-ink-faint">{s.description}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      hideUntil: 'sm',
      render: (s) => (
        <span className="font-mono text-[11px] tracking-wider text-ink-dim">
          {CATEGORY_LABEL[s.category]}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duração',
      align: 'right',
      hideUntil: 'md',
      render: (s) => (
        <span className="font-mono text-[11px] text-ink-dim tnum">
          {formatDuration(s.durationMin)}
          {s.bufferMin > 0 && <span className="text-ink-faint"> +{s.bufferMin}</span>}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Preço',
      align: 'right',
      render: (s) => (
        <span className="font-mono text-[12px] text-ink tnum">
          {formatBRL(s.priceCents)}
          {Object.keys(s.priceOverrides).length > 0 && (
            <span className="ml-1 text-hud" title="Tem preço próprio por profissional">
              *
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (s) => <Badge tone={s.active ? 'ok' : 'idle'}>{s.active ? 'ativo' : 'inativo'}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatStrip stats={stats} />

      <HolographicPanel
        title="Catálogo de procedimentos"
        meta={`${formatInt(rows.length)} DE ${formatInt(services.length)}`}
        icon={<Smile size={14} />}
        actions={
          <TechButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setEditing(blankService())}
          >
            Novo
          </TechButton>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar por nome ou descrição"
            />
            <SortCycle options={SORTS} value={sort} onChange={setSort} />
          </div>
          <FilterChips options={CATEGORY_FILTERS} value={category} onChange={setCategory} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={setEditing}
          empty="Nenhum procedimento corresponde à busca. Ajuste os filtros ou cadastre um novo."
        />
      </HolographicPanel>

      <ServiceDrawer
        service={editing}
        professionals={professionals}
        services={services}
        onClose={() => setEditing(null)}
        onSave={save}
        onDelete={(id) => {
          remove('services', id);
          setEditing(null);
        }}
      />
    </div>
  );
}

/* ==========================================================================
   FORMULÁRIO
   ========================================================================= */

function ServiceDrawer({
  service,
  professionals,
  services,
  onClose,
  onSave,
  onDelete,
}: {
  service: ServiceItem | null;
  professionals: ReturnType<typeof useOperations>['professionals'];
  services: ServiceItem[];
  onClose: () => void;
  onSave: (draft: ServiceItem) => void;
  onDelete: (id: string) => void;
}) {
  // A chave remonta o formulário a cada procedimento aberto: sem isso, abrir outro
  // registro herdaria o rascunho do anterior.
  return (
    <Drawer
      open={Boolean(service)}
      onClose={onClose}
      title={service?.id ? service.name : 'Novo procedimento'}
      subtitle={service?.id ? 'Alterações valem para os próximos agendamentos' : 'Cadastro no catálogo'}
      icon={<Smile size={15} />}
      width={460}
    >
      {service && (
        <ServiceForm
          key={service.id || 'new'}
          initial={service}
          professionals={professionals}
          services={services}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Drawer>
  );
}

function ServiceForm({
  initial,
  professionals,
  services,
  onSave,
  onDelete,
}: {
  initial: ServiceItem;
  professionals: ReturnType<typeof useOperations>['professionals'];
  services: ServiceItem[];
  onSave: (draft: ServiceItem) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ServiceItem>(initial);
  const set = <K extends keyof ServiceItem>(key: K, value: ServiceItem[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /**
   * Quantas vezes o procedimento aparece na agenda dos últimos 90 dias.
   *
   * É o número que justifica desativar em vez de excluir: some com o procedimento e
   * esses atendimentos ficam órfãos nos relatórios.
   */
  const usage = useMemo(() => {
    if (!initial.id) return 0;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return listRange(from, to).filter((a) => a.serviceIds?.includes(initial.id)).length;
  }, [initial.id]);

  const comboParts = services.filter((s) => s.comboOf.length === 0 && s.id !== draft.id);
  const partsTotal = draft.comboOf.reduce(
    (acc, id) => acc + (services.find((s) => s.id === id)?.priceCents ?? 0),
    0,
  );

  const invalid = draft.name.trim().length < 2 || draft.durationMin < 5;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="NOME"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Corte Masculino"
      />

      <TextareaField
        label="DESCRIÇÃO"
        rows={2}
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
        placeholder="O que está incluso no atendimento"
      />

      <SelectField
        label="CATEGORIA"
        value={draft.category}
        onChange={(e) => set('category', e.target.value as ServiceCategory)}
      >
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label="PREÇO BASE"
          value={draft.priceCents}
          onValueChange={(cents) => set('priceCents', cents)}
        />
        <Field
          label="DURAÇÃO (MIN)"
          type="number"
          min={5}
          step={5}
          value={draft.durationMin}
          onChange={(e) => set('durationMin', Math.max(0, Number(e.target.value)))}
        />
      </div>

      <Field
        label="PREPARO APÓS O ATENDIMENTO (MIN)"
        type="number"
        min={0}
        step={5}
        value={draft.bufferMin}
        onChange={(e) => set('bufferMin', Math.max(0, Number(e.target.value)))}
        hint="Ocupa a agenda e não é cobrado. Higienização, troca de lâmina, limpeza."
      />

      <Toggle
        label="Procedimento ativo"
        description="Desativado, some da agenda e do site — o histórico continua intacto."
        checked={draft.active}
        onChange={(checked) => set('active', checked)}
      />

      {/* ---------- composição do combo ---------- */}
      {draft.category === 'combo' && (
        <section className="flex flex-col gap-2 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
          <span className="tech-label">PROCEDIMENTOS INCLUSOS</span>
          <div className="flex flex-wrap gap-1.5">
            {comboParts.map((part) => {
              const selected = draft.comboOf.includes(part.id);
              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() =>
                    set(
                      'comboOf',
                      selected
                        ? draft.comboOf.filter((id) => id !== part.id)
                        : [...draft.comboOf, part.id],
                    )
                  }
                  className={cn(
                    'rounded-[3px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-200',
                    selected
                      ? 'border-hud/50 bg-hud/12 text-hud'
                      : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                  )}
                >
                  {part.name}
                </button>
              );
            })}
          </div>
          {draft.comboOf.length > 0 && (
            <p className="text-[11px] text-ink-faint">
              Avulsos somam <span className="font-mono text-ink-dim">{formatBRL(partsTotal)}</span> ·
              o combo sai por{' '}
              <span className="font-mono text-hud">{formatBRL(draft.priceCents)}</span>
              {partsTotal > 0 && (
                <>
                  {' '}
                  ({(((partsTotal - draft.priceCents) / partsTotal) * 100).toFixed(0)}% de desconto)
                </>
              )}
            </p>
          )}
        </section>
      )}

      {/* ---------- preço por profissional ---------- */}
      <section className="flex flex-col gap-3 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
        <div>
          <span className="tech-label">PREÇO POR PROFISSIONAL</span>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
            Zerado, o profissional cobra o preço base. O valor gravado no atendimento é o vigente
            no dia — mudar aqui não reescreve o passado.
          </p>
        </div>

        {professionals
          .filter((p) => p.active)
          .map((p) => (
            <MoneyField
              key={p.id}
              label={p.name}
              value={draft.priceOverrides[p.id] ?? 0}
              onValueChange={(cents) => {
                const next = { ...draft.priceOverrides };
                if (cents === 0) delete next[p.id];
                else next[p.id] = cents;
                set('priceOverrides', next);
              }}
            />
          ))}
      </section>

      <div className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <TechButton
          variant="primary"
          disabled={invalid}
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          className="justify-center py-3"
        >
          {initial.id ? 'Salvar alterações' : 'Cadastrar procedimento'}
        </TechButton>

        {initial.id && (
          <>
            {usage > 0 && (
              <Callout tone="warn" icon={<AlertTriangle size={13} />}>
                Usado em <strong>{usage}</strong> atendimento(s) nos últimos 90 dias. Prefira
                desativar: excluir deixa esses registros sem referência nos relatórios.
              </Callout>
            )}
            <ConfirmButton
              icon={<Trash2 size={12} />}
              confirmLabel="Excluir mesmo assim?"
              onConfirm={() => onDelete(initial.id)}
              className="justify-center"
            >
              Excluir do catálogo
            </ConfirmButton>
          </>
        )}
      </div>
    </div>
  );
}
