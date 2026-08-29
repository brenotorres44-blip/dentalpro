import type { MovementKind, ProductRecord, StockMovement } from '@/data/types';
import { getState, insert, mutate, nextId } from './store';

/**
 * ESTOQUE
 *
 * A quantidade de um produto nunca é digitada direto: ela é consequência das
 * movimentações. Corrigir o número na mão esconderia a diferença — e é
 * justamente a diferença entre o que entrou e o que saiu que revela furto,
 * quebra e erro de contagem.
 *
 * Para acertar um saldo existe o tipo `ajuste`, que grava a correção como
 * evento em vez de apagar o rastro.
 */

/** Sinal que cada tipo de movimento aplica ao saldo. */
const DIRECTION: Record<MovementKind, -1 | 0 | 1> = {
  entrada: 1,
  venda: -1,
  consumo: -1,
  perda: -1,
  ajuste: 0, // define o saldo em vez de somar
};

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  entrada: 'Entrada',
  venda: 'Venda',
  consumo: 'Consumo interno',
  perda: 'Perda',
  ajuste: 'Ajuste de saldo',
};

export interface MovementDraft {
  productId: string;
  kind: MovementKind;
  qty: number;
  unitCostCents: number;
  date: string;
  note: string;
  professionalId: string | null;
}

/**
 * Aplica um movimento: grava o evento e recalcula o saldo.
 *
 * Na entrada, o custo médio é reponderado pelo volume. Sem isso, comprar 10
 * unidades mais caras não moveria o custo e a margem exibida ficaria otimista
 * até o estoque antigo acabar.
 */
export function registerMovement(draft: MovementDraft) {
  const product = getState().products.find((p) => p.id === draft.productId);
  if (!product) return { ok: false as const, error: 'Produto não encontrado.' };
  if (draft.qty <= 0) return { ok: false as const, error: 'A quantidade precisa ser maior que zero.' };

  const direction = DIRECTION[draft.kind];
  const nextQty =
    draft.kind === 'ajuste' ? draft.qty : product.qty + direction * draft.qty;

  if (nextQty < 0) {
    return {
      ok: false as const,
      error: `Saldo insuficiente: há ${product.qty} ${product.unit} em estoque.`,
    };
  }

  const nextCost =
    draft.kind === 'entrada' && product.qty + draft.qty > 0
      ? Math.round(
          (product.qty * product.costCents + draft.qty * draft.unitCostCents) /
            (product.qty + draft.qty),
        )
      : product.costCents;

  const movement: StockMovement = { ...draft, id: nextId('m') };

  mutate((current) => ({
    movements: [...current.movements, movement],
    products: current.products.map((p) =>
      p.id === draft.productId ? { ...p, qty: nextQty, costCents: nextCost } : p,
    ),
  }));

  return { ok: true as const, movement };
}

/** Margem sobre o preço de venda. Produto de uso interno não tem margem. */
export function marginPct(product: ProductRecord) {
  if (product.priceCents <= 0) return null;
  return ((product.priceCents - product.costCents) / product.priceCents) * 100;
}

export const isCritical = (product: ProductRecord) => product.qty < product.min;

/** Quanto o estoque parado vale, a preço de custo. */
export function stockValueCents(products: ProductRecord[]) {
  return products.reduce((acc, p) => acc + p.qty * p.costCents, 0);
}

/**
 * Semeia o histórico de movimentação na primeira visita ao módulo.
 *
 * Sem isso, a tela abriria com saldo mas sem nenhuma explicação de como ele
 * chegou ali — um extrato vazio embaixo de um saldo cheio é exatamente o tipo
 * de contradição que o sistema não deve exibir.
 */
export function seedMovementsIfEmpty() {
  const { movements, products } = getState();
  if (movements.length > 0 || products.length === 0) return;

  const today = new Date();
  const iso = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  };

  const seeded: StockMovement[] = products.map((product, i) => ({
    id: `m-seed-${product.id}`,
    productId: product.id,
    kind: 'entrada',
    qty: product.qty,
    unitCostCents: product.costCents,
    date: iso(30 - (i % 20)),
    note: 'Carga inicial do estoque',
    professionalId: null,
  }));

  mutate(() => ({ movements: seeded }));
}

/** Registra a compra de um produto novo já com a carga inicial. */
export function createProduct(product: Omit<ProductRecord, 'id'>) {
  const id = nextId('i');
  insert('products', { ...product, id });

  if (product.qty > 0) {
    insert('movements', {
      id: nextId('m'),
      productId: id,
      kind: 'entrada',
      qty: product.qty,
      unitCostCents: product.costCents,
      date: new Date().toISOString().slice(0, 10),
      note: 'Cadastro com saldo inicial',
      professionalId: null,
    });
  }

  return id;
}
