import type {
  Appointment,
  CashCategory,
  CashDirection,
  PaymentMethod,
  Shift,
} from '@/data/types';
import { dateKey } from '@/utils/format';
import { toMinutes } from '@/utils/time';
import { listRangeDated } from './agendaService';
import { isBillable, performanceByProfessional } from './insightsService';
import { getState } from './store';

/**
 * CAIXA
 *
 * O livro é montado, não digitado. Receita de serviço sai da agenda, receita de
 * produto sai das movimentações de estoque, comissão sai do desempenho — só
 * despesa e entrada avulsa são lançamento manual.
 *
 * Isso resolve a contradição clássica: um caixa digitado à parte sempre acaba
 * discordando da agenda, e aí ninguém confia em nenhum dos dois.
 */

export const CATEGORY_LABEL: Record<CashCategory, string> = {
  servico: 'Serviços',
  produto: 'Produtos',
  comissao: 'Comissões',
  aluguel: 'Aluguel',
  insumo: 'Insumos',
  salario: 'Salários',
  marketing: 'Marketing',
  imposto: 'Impostos',
  manutencao: 'Manutenção',
  outro: 'Outros',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
};

export const SHIFT_LABEL: Record<Shift, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

/** Turno a partir do horário. Fronteiras fixas para o fechamento ser comparável. */
export function shiftOf(time: string): Shift {
  const minutes = toMinutes(time);
  if (minutes < 12 * 60) return 'manha';
  if (minutes < 18 * 60) return 'tarde';
  return 'noite';
}

/* ==========================================================================
   LIVRO
   ========================================================================= */

export interface LedgerLine {
  id: string;
  date: string;
  direction: CashDirection;
  category: CashCategory;
  description: string;
  amountCents: number;
  method: PaymentMethod | null;
  shift: Shift;
  professionalId: string | null;
  /** Derivado da operação ou digitado à mão. */
  source: 'agenda' | 'estoque' | 'comissao' | 'manual';
}

export interface Ledger {
  lines: LedgerLine[];
  inflowCents: number;
  outflowCents: number;
  resultCents: number;
  byCategory: Map<CashCategory, number>;
  byMethod: Map<PaymentMethod, number>;
  byShift: Map<Shift, { inflowCents: number; outflowCents: number }>;
}

/** Método presumido quando o atendimento antigo não gravou nenhum. */
const FALLBACK_METHOD: PaymentMethod = 'dinheiro';

function serviceLine(date: Date, appointment: Appointment): LedgerLine {
  return {
    id: `svc-${appointment.id}`,
    date: dateKey(date),
    direction: 'entrada',
    category: 'servico',
    description: `${appointment.client} — ${appointment.services.join(' + ')}`,
    amountCents: appointment.priceCents,
    method: appointment.paymentMethod ?? FALLBACK_METHOD,
    shift: shiftOf(appointment.time),
    professionalId: appointment.professionalId,
    source: 'agenda',
  };
}

export function buildLedger(from: Date, to: Date): Ledger {
  const { entries, movements, products, professionals } = getState();
  const fromKey = dateKey(from);
  const toKey = dateKey(to);

  const lines: LedgerLine[] = [];

  // 1. Serviços prestados
  for (const { date, appointment } of listRangeDated(from, to)) {
    if (!isBillable(appointment)) continue;
    lines.push(serviceLine(date, appointment));
  }

  // 2. Produtos vendidos
  for (const movement of movements) {
    if (movement.kind !== 'venda') continue;
    if (movement.date < fromKey || movement.date > toKey) continue;

    const product = products.find((p) => p.id === movement.productId);
    if (!product) continue;

    lines.push({
      id: `prd-${movement.id}`,
      date: movement.date,
      direction: 'entrada',
      category: 'produto',
      description: `${product.name} × ${movement.qty}`,
      amountCents: product.priceCents * movement.qty,
      method: null,
      shift: 'tarde',
      professionalId: movement.professionalId,
      source: 'estoque',
    });
  }

  // 3. Comissões do período — uma linha por profissional, não por atendimento.
  //    O extrato por atendimento já existe acima; repetir aqui só faria ruído.
  const performance = performanceByProfessional(from, to);
  for (const [professionalId, perf] of performance) {
    const total = perf.serviceCommissionCents + perf.productCommissionCents;
    if (total === 0) continue;

    const record = professionals.find((p) => p.id === professionalId);
    lines.push({
      id: `com-${professionalId}-${fromKey}`,
      date: toKey,
      direction: 'saida',
      category: 'comissao',
      description: `Comissão de ${record?.name ?? 'profissional'} (${record?.serviceCommissionPct ?? 0}%)`,
      amountCents: total,
      method: null,
      shift: 'noite',
      professionalId,
      source: 'comissao',
    });
  }

  // 4. Lançamentos manuais
  for (const entry of entries) {
    if (entry.date < fromKey || entry.date > toKey) continue;
    lines.push({
      id: entry.id,
      date: entry.date,
      direction: entry.direction,
      category: entry.category,
      description: entry.description,
      amountCents: entry.amountCents,
      method: entry.method,
      shift: entry.shift,
      professionalId: entry.professionalId,
      source: 'manual',
    });
  }

  lines.sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category));

  const byCategory = new Map<CashCategory, number>();
  const byMethod = new Map<PaymentMethod, number>();
  const byShift = new Map<Shift, { inflowCents: number; outflowCents: number }>([
    ['manha', { inflowCents: 0, outflowCents: 0 }],
    ['tarde', { inflowCents: 0, outflowCents: 0 }],
    ['noite', { inflowCents: 0, outflowCents: 0 }],
  ]);

  let inflowCents = 0;
  let outflowCents = 0;

  for (const line of lines) {
    byCategory.set(line.category, (byCategory.get(line.category) ?? 0) + line.amountCents);

    const bucket = byShift.get(line.shift)!;
    if (line.direction === 'entrada') {
      inflowCents += line.amountCents;
      bucket.inflowCents += line.amountCents;
      if (line.method) byMethod.set(line.method, (byMethod.get(line.method) ?? 0) + line.amountCents);
    } else {
      outflowCents += line.amountCents;
      bucket.outflowCents += line.amountCents;
    }
  }

  return {
    lines,
    inflowCents,
    outflowCents,
    resultCents: inflowCents - outflowCents,
    byCategory,
    byMethod,
    byShift,
  };
}

/**
 * Quanto deveria haver na gaveta ao fim de um turno.
 *
 * Só dinheiro vivo entra na conta: Pix e cartão não passam pela gaveta, e
 * incluí-los faria toda conferência fechar com uma diferença enorme e inútil.
 */
export function expectedCashCents(date: Date, shift: Shift) {
  const ledger = buildLedger(date, date);
  return ledger.lines
    .filter((line) => line.shift === shift && line.method === 'dinheiro')
    .reduce(
      (acc, line) => acc + (line.direction === 'entrada' ? line.amountCents : -line.amountCents),
      0,
    );
}
