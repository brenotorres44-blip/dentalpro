import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Percent,
  Plus,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { Badge, DataTable, type Column } from '@/components/ui/DataTable';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { TechButton } from '@/components/ui/TechButton';
import { Callout, Field, MoneyField, SelectField } from '@/components/ui/Field';
import { FilterChips } from '@/components/ui/Toolbar';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';

import type {
  CashCategory,
  CashDirection,
  CashEntry,
  PaymentMethod,
  Shift,
} from '@/data/types';
import { insert, nextId, remove, useOperations } from '@/services/store';
import {
  CATEGORY_LABEL,
  METHOD_LABEL,
  SHIFT_LABEL,
  buildLedger,
  expectedCashCents,
  type LedgerLine,
} from '@/services/financeService';
import { performanceByProfessional } from '@/services/insightsService';
import { dateKey, formatBRL, formatInt, formatShortDate } from '@/utils/format';
import { cn } from '@/utils/cn';

type Period = 'hoje' | 'semana' | 'mes';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: '7 dias' },
  { value: 'mes', label: 'Mês' },
];

const SOURCE_LABEL: Record<LedgerLine['source'], string> = {
  agenda: 'agenda',
  estoque: 'estoque',
  comissao: 'comissão',
  manual: 'manual',
};

function rangeFor(period: Period): { from: Date; to: Date } {
  const to = new Date();
  if (period === 'hoje') return { from: new Date(), to };

  const from = new Date();
  if (period === 'semana') from.setDate(from.getDate() - 6);
  else from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function Financial() {
  const operations = useOperations();
  const { professionals, closings } = operations;

  const [period, setPeriod] = useState<Period>('mes');
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState<Shift | null>(null);

  const { from, to } = useMemo(() => rangeFor(period), [period]);
  const ledger = useMemo(() => buildLedger(from, to), [from, to, operations]);
  const performance = useMemo(
    () => performanceByProfessional(from, to),
    [from, to, operations],
  );

  const commissionTotal = ledger.byCategory.get('comissao') ?? 0;

  const stats = useMemo(
    () => [
      {
        label: 'ENTRADAS',
        value: formatBRL(ledger.inflowCents),
        hint: `serviços ${formatBRL(ledger.byCategory.get('servico') ?? 0)}`,
        icon: ArrowUpRight,
        tone: 'success' as const,
      },
      {
        label: 'SAÍDAS',
        value: formatBRL(ledger.outflowCents),
        hint: `comissões ${formatBRL(commissionTotal)}`,
        icon: ArrowDownRight,
        tone: 'warn' as const,
      },
      {
        label: 'RESULTADO',
        value: formatBRL(ledger.resultCents),
        hint:
          ledger.inflowCents > 0
            ? `margem de ${((ledger.resultCents / ledger.inflowCents) * 100).toFixed(1).replace('.', ',')}%`
            : 'sem movimento',
        icon: Scale,
        tone: ledger.resultCents >= 0 ? ('hud' as const) : ('critical' as const),
      },
      {
        label: 'LANÇAMENTOS',
        value: formatInt(ledger.lines.length),
        hint: `${formatInt(ledger.lines.filter((l) => l.source === 'manual').length)} manuais`,
        icon: Wallet,
        tone: 'electric' as const,
      },
    ],
    [ledger, commissionTotal],
  );

  const columns: Array<Column<LedgerLine>> = [
    {
      key: 'date',
      header: 'Data',
      render: (l) => (
        <span className="font-mono text-[11.5px] text-ink-faint tnum">
          {formatShortDate(new Date(`${l.date}T12:00:00`))}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (l) => (
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] text-ink">{l.description}</span>
          <span className="block truncate text-[10.5px] text-ink-faint">
            {CATEGORY_LABEL[l.category]} · {SOURCE_LABEL[l.source]}
          </span>
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Forma',
      hideUntil: 'lg',
      render: (l) =>
        l.method ? (
          <span className="font-mono text-[11px] text-ink-dim">{METHOD_LABEL[l.method]}</span>
        ) : (
          <span className="text-[10.5px] text-ink-faint">—</span>
        ),
    },
    {
      key: 'shift',
      header: 'Turno',
      hideUntil: 'xl',
      render: (l) => <span className="text-[11px] text-ink-faint">{SHIFT_LABEL[l.shift]}</span>,
    },
    {
      key: 'amount',
      header: 'Valor',
      align: 'right',
      render: (l) => (
        <span
          className={cn(
            'font-mono text-[12px] tnum',
            l.direction === 'entrada' ? 'text-success' : 'text-warn',
          )}
        >
          {l.direction === 'entrada' ? '+' : '−'}
          {formatBRL(l.amountCents)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) =>
        l.source === 'manual' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              remove('entries', l.id);
            }}
            className="grid h-7 w-7 place-items-center rounded-[2px] border border-transparent text-ink-faint transition-all hover:border-critical/40 hover:text-critical"
            aria-label="Excluir lançamento"
          >
            <Trash2 size={13} />
          </button>
        ) : (
          // Linha derivada não se apaga aqui: some quando a origem muda.
          <span className="text-[9.5px] text-ink-faint" title="Derivado da operação">
            auto
          </span>
        ),
    },
  ];

  const methodTotal = [...ledger.byMethod.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips options={PERIODS} value={period} onChange={setPeriod} />
        <TechButton variant="primary" icon={<Plus size={12} />} onClick={() => setAdding(true)}>
          Novo lançamento
        </TechButton>
      </div>

      <StatStrip stats={stats} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---------- livro ---------- */}
        <HolographicPanel
          title="Fluxo de caixa"
          meta={`${formatShortDate(from)} — ${formatShortDate(to)}`}
          icon={<Wallet size={14} />}
          className="xl:col-span-8"
          // O extrato de um mês passa de 40 linhas e esticava o painel muito
          // além da coluna lateral, deixando meia tela vazia. Rola por dentro.
          bodyClassName="holo-body max-h-[640px] overflow-y-auto"
        >
          {ledger.lines.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sem movimento"
              description="Nenhuma entrada ou saída no período. Atendimentos concluídos e vendas de produto aparecem aqui automaticamente."
            />
          ) : (
            <DataTable columns={columns} rows={ledger.lines} />
          )}
        </HolographicPanel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          {/* ---------- conciliação ---------- */}
          <HolographicPanel
            title="Conciliação"
            meta="POR FORMA"
            icon={<CreditCard size={14} />}
            bodyClassName="holo-body-compact"
          >
            {methodTotal === 0 ? (
              <p className="px-1 py-3 text-[11.5px] leading-relaxed text-ink-faint">
                Nenhum recebimento com forma identificada no período.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((method) => {
                  const value = ledger.byMethod.get(method) ?? 0;
                  const share = (value / methodTotal) * 100;
                  return (
                    <li key={method} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11.5px] text-ink-dim">{METHOD_LABEL[method]}</span>
                        <span className="font-mono text-[11.5px] text-ink tnum">
                          {formatBRL(value)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={share} label={METHOD_LABEL[method]} />
                        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-ink-faint tnum">
                          {share.toFixed(0)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </HolographicPanel>

          {/* ---------- comissões ---------- */}
          <HolographicPanel
            title="Comissões"
            meta={formatBRL(commissionTotal)}
            icon={<Percent size={14} />}
            bodyClassName="holo-body-compact"
          >
            <ul className="flex flex-col gap-1.5">
              {professionals
                .filter((p) => (performance.get(p.id)?.appointments ?? 0) > 0)
                .sort(
                  (a, b) =>
                    (performance.get(b.id)?.serviceCommissionCents ?? 0) -
                    (performance.get(a.id)?.serviceCommissionCents ?? 0),
                )
                .map((p) => {
                  const perf = performance.get(p.id);
                  const total =
                    (perf?.serviceCommissionCents ?? 0) + (perf?.productCommissionCents ?? 0);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-[3px] border border-hud/[0.09] bg-white/[0.015] px-2.5 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] text-ink">{p.name}</span>
                        <span className="block font-mono text-[10px] text-ink-faint tnum">
                          {formatInt(perf?.appointments ?? 0)} atend. ·{' '}
                          {formatBRL(perf?.revenueCents ?? 0)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-[12px] text-warn tnum">
                          {formatBRL(total)}
                        </span>
                        <span className="block font-mono text-[9.5px] text-ink-faint tnum">
                          {p.serviceCommissionPct}%
                        </span>
                      </span>
                    </li>
                  );
                })}

              {[...performance.values()].every((p) => p.appointments === 0) && (
                <p className="px-1 py-3 text-[11.5px] leading-relaxed text-ink-faint">
                  Nenhum atendimento concluído no período — nada a comissionar.
                </p>
              )}
            </ul>
          </HolographicPanel>

          {/* ---------- fechamento ---------- */}
          <HolographicPanel
            title="Fechamento de hoje"
            meta="EM DINHEIRO"
            icon={<Banknote size={14} />}
            bodyClassName="holo-body-compact"
          >
            <ul className="flex flex-col gap-1.5">
              {(Object.keys(SHIFT_LABEL) as Shift[]).map((shift) => {
                const expected = expectedCashCents(new Date(), shift);
                const done = closings.find(
                  (c) => c.date === dateKey(new Date()) && c.shift === shift,
                );
                const diff = done ? done.countedCents - done.expectedCents : 0;

                return (
                  <li
                    key={shift}
                    className="flex items-center gap-2 rounded-[3px] border border-hud/[0.09] bg-white/[0.015] px-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] text-ink">{SHIFT_LABEL[shift]}</span>
                      <span className="block font-mono text-[10px] text-ink-faint tnum">
                        previsto {formatBRL(expected)}
                      </span>
                    </span>

                    {done ? (
                      <Badge tone={diff === 0 ? 'ok' : Math.abs(diff) < 1000 ? 'warn' : 'critical'}>
                        {diff === 0
                          ? 'conferido'
                          : `${diff > 0 ? '+' : '−'}${formatBRL(Math.abs(diff))}`}
                      </Badge>
                    ) : (
                      <button
                        onClick={() => setClosing(shift)}
                        className="shrink-0 rounded-[3px] border border-hud/35 bg-hud/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-hud transition-colors hover:bg-hud/20"
                      >
                        Fechar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </HolographicPanel>
        </div>
      </div>

      <EntryDrawer open={adding} onClose={() => setAdding(false)} />

      <ClosingDrawer shift={closing} onClose={() => setClosing(null)} />
    </div>
  );
}

/* ==========================================================================
   LANÇAMENTO MANUAL
   ========================================================================= */

function EntryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { professionals } = useOperations();

  const [draft, setDraft] = useState<Omit<CashEntry, 'id' | 'createdAt'>>({
    date: new Date().toISOString().slice(0, 10),
    direction: 'saida',
    category: 'insumo',
    description: '',
    amountCents: 0,
    method: 'pix',
    shift: 'manha',
    professionalId: null,
  });

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const invalid = draft.amountCents <= 0 || draft.description.trim().length < 3;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Novo lançamento"
      subtitle="Despesa ou entrada avulsa"
      icon={<Plus size={15} />}
      width={420}
    >
      <div className="flex flex-col gap-4">
        <Callout tone="info">
          Serviços, vendas de produto e comissões já entram sozinhos. Use este formulário para o que
          não passa pela operação — aluguel, insumo, imposto, um recebimento fora da agenda.
        </Callout>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['saida', 'Saída'],
              ['entrada', 'Entrada'],
            ] as Array<[CashDirection, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('direction', value)}
              className={cn(
                'rounded-[3px] border py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-all duration-200',
                draft.direction === value
                  ? value === 'entrada'
                    ? 'border-success/50 bg-success/12 text-success'
                    : 'border-warn/50 bg-warn/12 text-warn'
                  : 'border-stroke/60 text-ink-faint hover:border-hud/30',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Field
          label="DESCRIÇÃO"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Aluguel de março, compra de toalhas"
        />

        <MoneyField
          label="VALOR"
          value={draft.amountCents}
          onValueChange={(cents) => set('amountCents', cents)}
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="CATEGORIA"
            value={draft.category}
            onChange={(e) => set('category', e.target.value as CashCategory)}
          >
            {(Object.keys(CATEGORY_LABEL) as CashCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="FORMA"
            value={draft.method}
            onChange={(e) => set('method', e.target.value as PaymentMethod)}
          >
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="DATA"
            type="date"
            value={draft.date}
            onChange={(e) => set('date', e.target.value)}
          />
          <SelectField
            label="TURNO"
            value={draft.shift}
            onChange={(e) => set('shift', e.target.value as Shift)}
          >
            {(Object.keys(SHIFT_LABEL) as Shift[]).map((s) => (
              <option key={s} value={s}>
                {SHIFT_LABEL[s]}
              </option>
            ))}
          </SelectField>
        </div>

        <SelectField
          label="PROFISSIONAL (OPCIONAL)"
          value={draft.professionalId ?? ''}
          onChange={(e) => set('professionalId', e.target.value || null)}
        >
          <option value="">Não vinculado</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>

        <TechButton
          variant="primary"
          disabled={invalid}
          className="justify-center py-3"
          onClick={() => {
            insert('entries', {
              ...draft,
              description: draft.description.trim(),
              id: nextId('e'),
              createdAt: new Date().toISOString(),
            });
            onClose();
          }}
        >
          Lançar
        </TechButton>
      </div>
    </Drawer>
  );
}

/* ==========================================================================
   FECHAMENTO DE TURNO
   ========================================================================= */

function ClosingDrawer({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState('');

  const expected = useMemo(
    () => (shift ? expectedCashCents(new Date(), shift) : 0),
    [shift],
  );

  const diff = counted - expected;

  return (
    <Drawer
      open={Boolean(shift)}
      onClose={onClose}
      title={shift ? `Fechar turno da ${SHIFT_LABEL[shift].toLowerCase()}` : ''}
      subtitle="Conferência da gaveta"
      icon={<Banknote size={15} />}
      width={400}
    >
      {shift && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[3px] border border-hud/15 bg-hud/[0.05] p-3">
            <span className="tech-label">PREVISTO EM DINHEIRO</span>
            <p className="mt-1 font-display text-[20px] font-semibold text-hud tnum">
              {formatBRL(expected)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
              Só dinheiro vivo. Pix e cartão não passam pela gaveta e ficariam de fora da conferência
              de qualquer maneira.
            </p>
          </div>

          <MoneyField label="CONTADO NA GAVETA" value={counted} onValueChange={setCounted} />

          {counted > 0 && (
            <Callout tone={diff === 0 ? 'success' : Math.abs(diff) < 1000 ? 'warn' : 'critical'}>
              {diff === 0 ? (
                <>Fecha exato.</>
              ) : (
                <>
                  Diferença de <strong>{formatBRL(Math.abs(diff))}</strong>{' '}
                  {diff > 0 ? 'a mais' : 'a menos'} do que o sistema esperava.
                </>
              )}
            </Callout>
          )}

          <Field
            label="OBSERVAÇÃO"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Troco inicial, sangria, o que explica a diferença"
          />

          <TechButton
            variant="primary"
            className="justify-center py-3"
            onClick={() => {
              insert('closings', {
                id: nextId('f'),
                date: dateKey(new Date()),
                shift,
                expectedCents: expected,
                countedCents: counted,
                note: note.trim(),
                closedAt: new Date().toISOString(),
                closedBy: 'Operador',
              });
              onClose();
            }}
          >
            Registrar fechamento
          </TechButton>
        </div>
      )}
    </Drawer>
  );
}
