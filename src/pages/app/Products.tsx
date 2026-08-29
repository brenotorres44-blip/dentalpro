import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  Package,
  PackagePlus,
  Percent,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { FilterChips, SearchInput, SortCycle } from '@/components/ui/Toolbar';
import { Callout, Field, MoneyField, SelectField, TextareaField, Toggle } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';

import type { MovementKind, ProductCategory, ProductRecord } from '@/data/types';
import { remove, update, useOperations } from '@/services/store';
import {
  MOVEMENT_LABEL,
  createProduct,
  isCritical,
  marginPct,
  registerMovement,
  seedMovementsIfEmpty,
  stockValueCents,
  type MovementDraft,
} from '@/services/inventoryService';
import { formatBRL, formatInt, formatPercent, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  descartavel: 'Descartável',
  material: 'Material',
  medicamento: 'Medicamento',
  instrumental: 'Instrumental',
  protecao: 'Proteção',
};

type ProductFilter = 'all' | ProductCategory | 'critical';

type SortKey = 'name' | 'qty' | 'value' | 'margin';

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'name', label: 'Nome' },
  { value: 'qty', label: 'Saldo' },
  { value: 'value', label: 'Valor' },
  { value: 'margin', label: 'Margem' },
];

function blankProduct(): ProductRecord {
  return {
    id: '',
    name: '',
    brand: '',
    sku: '',
    category: 'descartavel',
    qty: 0,
    min: 5,
    capacity: 30,
    unit: 'un.',
    costCents: 0,
    priceCents: 0,
    active: true,
  };
}

export function Products() {
  const operations = useOperations();
  const { products, movements, professionals } = operations;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [moving, setMoving] = useState<ProductRecord | null>(null);

  // O extrato precisa existir na primeira abertura: saldo sem histórico é uma
  // contradição na cara do usuário.
  useEffect(() => {
    seedMovementsIfEmpty();
  }, []);

  const critical = products.filter((p) => p.active && isCritical(p));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (filter === 'critical' && !isCritical(p)) return false;
        if (filter !== 'all' && filter !== 'critical' && p.category !== filter) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === 'qty') return a.qty / Math.max(1, a.min) - b.qty / Math.max(1, b.min);
        if (sort === 'value') return b.qty * b.costCents - a.qty * a.costCents;
        if (sort === 'margin') return (marginPct(b) ?? -1) - (marginPct(a) ?? -1);
        return a.name.localeCompare(b.name);
      });
  }, [products, query, filter, sort]);

  const stats = useMemo(() => {
    const sellable = products.filter((p) => p.active && p.priceCents > 0);
    const margins = sellable.map(marginPct).filter((m): m is number => m !== null);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthMovements = movements.filter((m) => m.date.startsWith(thisMonth));
    const sold = monthMovements.filter((m) => m.kind === 'venda');
    const soldValue = sold.reduce((acc, m) => {
      const product = products.find((p) => p.id === m.productId);
      return acc + (product?.priceCents ?? 0) * m.qty;
    }, 0);

    return [
      {
        label: 'ITENS EM ALERTA',
        value: formatInt(critical.length),
        hint: critical.length > 0 ? critical.map((p) => p.name).join(', ') : 'estoque estável',
        icon: AlertTriangle,
        tone: critical.length > 0 ? ('critical' as const) : ('success' as const),
      },
      {
        label: 'VALOR EM ESTOQUE',
        value: formatBRL(stockValueCents(products.filter((p) => p.active))),
        hint: `${formatInt(products.filter((p) => p.active).length)} itens ativos`,
        icon: Boxes,
      },
      {
        label: 'MARGEM MÉDIA',
        value: margins.length ? formatPercent(margins.reduce((a, b) => a + b, 0) / margins.length, 1) : '—',
        hint: `${formatInt(sellable.length)} itens de revenda`,
        icon: Percent,
        tone: 'success' as const,
      },
      {
        label: 'VENDAS DO MÊS',
        value: formatBRL(soldValue),
        hint: `${formatInt(monthMovements.length)} movimentações`,
        icon: Wallet,
        tone: 'electric' as const,
      },
    ];
  }, [products, movements, critical]);

  const FILTERS: Array<{ value: ProductFilter; label: string; count?: number }> = [
    { value: 'all', label: 'Todos', count: products.length },
    { value: 'critical', label: 'Em alerta', count: critical.length },
    ...(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map((c) => ({
      value: c as ProductFilter,
      label: CATEGORY_LABEL[c],
    })),
  ];

  const columns: Array<Column<ProductRecord>> = [
    {
      key: 'product',
      header: 'Item',
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-[2px] border',
              isCritical(p)
                ? 'border-critical/35 bg-critical/10 text-critical'
                : 'border-hud/20 bg-hud/[0.06] text-hud',
            )}
          >
            <Package size={13} />
          </span>
          <span className="min-w-0">
            <span className={cn('block truncate text-[12.5px] font-medium', p.active ? 'text-ink' : 'text-ink-faint')}>
              {p.name}
            </span>
            <span className="block truncate text-[10.5px] text-ink-faint">
              {p.brand} · {p.sku}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Saldo',
      width: '150px',
      render: (p) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn('font-mono text-[12px] tnum', isCritical(p) ? 'text-critical' : 'text-ink')}>
              {formatInt(p.qty)} {p.unit}
            </span>
            <span className="font-mono text-[10px] text-ink-faint tnum">mín {p.min}</span>
          </div>
          <ProgressBar
            value={(p.qty / Math.max(1, p.capacity)) * 100}
            tone={isCritical(p) ? 'critical' : 'hud'}
            label={`Estoque de ${p.name}`}
          />
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Custo médio',
      align: 'right',
      hideUntil: 'lg',
      render: (p) => (
        <span className="font-mono text-[11.5px] text-ink-dim tnum">{formatBRL(p.costCents)}</span>
      ),
    },
    {
      key: 'price',
      header: 'Venda',
      align: 'right',
      hideUntil: 'md',
      render: (p) =>
        p.priceCents > 0 ? (
          <span className="font-mono text-[12px] text-ink tnum">{formatBRL(p.priceCents)}</span>
        ) : (
          <span className="text-[10.5px] text-ink-faint">uso interno</span>
        ),
    },
    {
      key: 'margin',
      header: 'Margem',
      align: 'right',
      hideUntil: 'xl',
      render: (p) => {
        const margin = marginPct(p);
        if (margin === null) return <span className="text-[10.5px] text-ink-faint">—</span>;
        return (
          <span
            className={cn(
              'font-mono text-[11.5px] tnum',
              margin >= 50 ? 'text-success' : margin >= 30 ? 'text-ink-dim' : 'text-warn',
            )}
          >
            {formatPercent(margin, 1)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMoving(p);
          }}
          className="grid h-7 w-7 place-items-center rounded-[2px] border border-transparent text-ink-faint transition-all duration-150 hover:border-hud/40 hover:text-hud"
          aria-label={`Movimentar ${p.name}`}
        >
          <ArrowDownUp size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StatStrip stats={stats} />

      {critical.length > 0 && filter !== 'critical' && (
        <Callout tone="critical" icon={<AlertTriangle size={13} />}>
          <strong>{critical.length} item(ns)</strong> abaixo do estoque mínimo.{' '}
          <button onClick={() => setFilter('critical')} className="underline underline-offset-2">
            Ver a lista
          </button>{' '}
          para repor antes de faltar no atendimento.
        </Callout>
      )}

      <HolographicPanel
        title="Itens de consultório"
        meta={`${formatInt(rows.length)} DE ${formatInt(products.length)}`}
        icon={<Boxes size={14} />}
        tone={critical.length > 0 ? 'critical' : 'default'}
        actions={
          <TechButton
            variant="primary"
            icon={<Plus size={12} />}
            onClick={() => setEditing(blankProduct())}
          >
            Novo
          </TechButton>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nome, marca ou SKU" />
            <SortCycle options={SORTS} value={sort} onChange={setSort} />
          </div>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={setEditing}
          empty="Nenhum item corresponde a esse recorte."
        />
      </HolographicPanel>

      {/* ---------- ficha do item ---------- */}
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? editing.name : 'Novo item'}
        subtitle={editing?.id ? `${editing.brand} · ${editing.sku}` : 'Cadastro no estoque'}
        icon={<Package size={15} />}
        width={460}
      >
        {editing && (
          <ProductForm
            key={editing.id || 'new'}
            initial={editing}
            onSave={(draft) => {
              if (draft.id) update('products', draft.id, draft);
              else createProduct(draft);
              setEditing(null);
            }}
            onDelete={(id) => {
              remove('products', id);
              setEditing(null);
            }}
          />
        )}
      </Drawer>

      {/* ---------- movimentação ---------- */}
      <Drawer
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title={moving ? `Movimentar ${moving.name}` : ''}
        subtitle={moving ? `Saldo atual: ${moving.qty} ${moving.unit}` : undefined}
        icon={<ArrowDownUp size={15} />}
        width={420}
      >
        {moving && (
          <MovementForm
            key={moving.id}
            product={moving}
            professionals={professionals}
            movements={movements.filter((m) => m.productId === moving.id)}
            onDone={() => setMoving(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

/* ==========================================================================
   CADASTRO
   ========================================================================= */

function ProductForm({
  initial,
  onSave,
  onDelete,
}: {
  initial: ProductRecord;
  onSave: (draft: ProductRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ProductRecord>(initial);
  const set = <K extends keyof ProductRecord>(key: K, value: ProductRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const margin = marginPct(draft);
  const invalid = draft.name.trim().length < 2;

  return (
    <div className="flex flex-col gap-4">
      <Field label="NOME" value={draft.name} onChange={(e) => set('name', e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="MARCA" value={draft.brand} onChange={(e) => set('brand', e.target.value)} />
        <Field label="SKU" value={draft.sku} onChange={(e) => set('sku', e.target.value)} />
      </div>

      <SelectField
        label="CATEGORIA"
        value={draft.category}
        onChange={(e) => set('category', e.target.value as ProductCategory)}
      >
        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label="CUSTO MÉDIO"
          value={draft.costCents}
          onValueChange={(cents) => set('costCents', cents)}
          hint={initial.id ? 'Recalculado a cada entrada' : undefined}
          disabled={Boolean(initial.id)}
        />
        <MoneyField
          label="PREÇO DE VENDA"
          value={draft.priceCents}
          onValueChange={(cents) => set('priceCents', cents)}
          hint="Zero = uso interno"
        />
      </div>

      {margin !== null && (
        <Callout tone={margin >= 40 ? 'success' : margin >= 0 ? 'warn' : 'critical'}>
          Margem de <strong>{formatPercent(margin, 1)}</strong> — lucro de{' '}
          {formatBRL(draft.priceCents - draft.costCents)} por {draft.unit}
        </Callout>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field
          label="SALDO"
          type="number"
          min={0}
          value={draft.qty}
          onChange={(e) => set('qty', Math.max(0, Number(e.target.value)))}
          disabled={Boolean(initial.id)}
          hint={initial.id ? 'Via movimentação' : undefined}
        />
        <Field
          label="MÍNIMO"
          type="number"
          min={0}
          value={draft.min}
          onChange={(e) => set('min', Math.max(0, Number(e.target.value)))}
        />
        <Field
          label="CAPACIDADE"
          type="number"
          min={1}
          value={draft.capacity}
          onChange={(e) => set('capacity', Math.max(1, Number(e.target.value)))}
        />
      </div>

      <Field
        label="UNIDADE"
        value={draft.unit}
        onChange={(e) => set('unit', e.target.value)}
        hint="un., ml, g, cx"
      />

      <Toggle
        label="Item ativo"
        description="Inativo some do estoque e dos alertas, sem apagar o histórico."
        checked={draft.active}
        onChange={(checked) => set('active', checked)}
      />

      <div className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <TechButton
          variant="primary"
          disabled={invalid}
          onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          className="justify-center py-3"
        >
          {initial.id ? 'Salvar alterações' : 'Cadastrar item'}
        </TechButton>

        {initial.id && (
          <ConfirmButton
            icon={<Trash2 size={12} />}
            confirmLabel="Excluir mesmo assim?"
            onConfirm={() => onDelete(initial.id)}
            className="justify-center"
          >
            Excluir item
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   MOVIMENTAÇÃO
   ========================================================================= */

function MovementForm({
  product,
  professionals,
  movements,
  onDone,
}: {
  product: ProductRecord;
  professionals: ReturnType<typeof useOperations>['professionals'];
  movements: ReturnType<typeof useOperations>['movements'];
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MovementDraft>({
    productId: product.id,
    kind: 'entrada',
    qty: 1,
    unitCostCents: product.costCents,
    date: new Date().toISOString().slice(0, 10),
    note: '',
    professionalId: null,
  });

  const set = <K extends keyof MovementDraft>(key: K, value: MovementDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  const history = [...movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="TIPO"
        value={draft.kind}
        onChange={(e) => set('kind', e.target.value as MovementKind)}
      >
        {(Object.keys(MOVEMENT_LABEL) as MovementKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {MOVEMENT_LABEL[kind]}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={draft.kind === 'ajuste' ? 'SALDO CORRETO' : 'QUANTIDADE'}
          type="number"
          min={0}
          value={draft.qty}
          onChange={(e) => set('qty', Math.max(0, Number(e.target.value)))}
        />
        <Field
          label="DATA"
          type="date"
          value={draft.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>

      {draft.kind === 'entrada' && (
        <MoneyField
          label="CUSTO UNITÁRIO DA COMPRA"
          value={draft.unitCostCents}
          onValueChange={(cents) => set('unitCostCents', cents)}
          hint={`Custo médio atual: ${formatBRL(product.costCents)} — será reponderado pelo volume.`}
        />
      )}

      {(draft.kind === 'venda' || draft.kind === 'consumo') && (
        <SelectField
          label="PROFISSIONAL"
          value={draft.professionalId ?? ''}
          onChange={(e) => set('professionalId', e.target.value || null)}
        >
          <option value="">Não atribuído</option>
          {professionals
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>
      )}

      <TextareaField
        label="OBSERVAÇÃO"
        rows={2}
        value={draft.note}
        onChange={(e) => set('note', e.target.value)}
        placeholder="Nota fiscal, motivo da perda, cliente da venda"
      />

      {draft.kind === 'venda' && (
        <Callout tone="info">
          A venda entra no faturamento e gera comissão de item para o profissional atribuído. O
          financeiro deriva desses lançamentos — não há registro em duplicidade.
        </Callout>
      )}

      {error && (
        <Callout tone="critical" icon={<AlertTriangle size={13} />}>
          {error}
        </Callout>
      )}

      <TechButton
        variant="primary"
        icon={<PackagePlus size={12} />}
        className="justify-center py-3"
        onClick={() => {
          const result = registerMovement(draft);
          if (!result.ok) setError(result.error);
          else onDone();
        }}
      >
        Registrar movimentação
      </TechButton>

      {/* ---------- extrato ---------- */}
      <section className="flex flex-col gap-2 border-t border-hud/12 pt-4">
        <span className="tech-label">ÚLTIMAS MOVIMENTAÇÕES</span>

        {history.length === 0 ? (
          <EmptyState
            icon={ArrowDownUp}
            title="Sem movimentação"
            description="Este item ainda não teve entrada nem saída registrada."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2.5 rounded-[3px] border border-hud/[0.09] bg-white/[0.015] px-2.5 py-2"
              >
                <Badge
                  tone={
                    m.kind === 'entrada'
                      ? 'ok'
                      : m.kind === 'perda'
                        ? 'critical'
                        : m.kind === 'ajuste'
                          ? 'idle'
                          : 'live'
                  }
                >
                  {MOVEMENT_LABEL[m.kind]}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-faint">
                  {m.note || '—'}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[11.5px] text-ink tnum">
                    {m.kind === 'entrada' ? '+' : m.kind === 'ajuste' ? '=' : '−'}
                    {m.qty}
                  </span>
                  <span className="block font-mono text-[9.5px] text-ink-faint tnum">
                    {formatShortDate(new Date(`${m.date}T12:00:00`))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
