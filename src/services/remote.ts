import {
  blockToRow,
  cashClosingToRow,
  cashEntryToRow,
  clientToRow,
  movementToRow,
  productToRow,
  professionalToRow,
  serviceToRow,
  waitlistToRow,
} from './mappers';

/**
 * REGISTRO DE ESCRITA
 *
 * Liga cada coleção do store à sua tabela e ao conversor que a traduz. Existe
 * para que `insert`/`update`/`remove` continuem genéricos: sem ele, cada uma
 * viraria um `switch` de nove braços repetido três vezes.
 *
 * Coleções ausentes daqui são calculadas, não gravadas.
 */

export type RemoteKey =
  | 'services'
  | 'professionals'
  | 'clients'
  | 'products'
  | 'movements'
  | 'entries'
  | 'closings'
  | 'blocks'
  | 'waitlist';

interface RemoteSpec {
  table: string;
  /** Converte o registro do app para a linha do banco. */
  toRow: (record: never, companyId: string, timezone: string) => Record<string, unknown>;
  /**
   * Registro que não se altera depois de gravado.
   *
   * Movimentação de estoque é o caso: corrigir um saldo é um `ajuste` novo, não
   * a edição do evento anterior — apagar o rastro esconde a diferença que
   * revela furto e quebra.
   */
  immutable?: boolean;
}

export const REMOTE: Record<RemoteKey, RemoteSpec> = {
  services: { table: 'services', toRow: serviceToRow as RemoteSpec['toRow'] },
  professionals: { table: 'professionals', toRow: professionalToRow as RemoteSpec['toRow'] },
  clients: { table: 'clients', toRow: clientToRow as RemoteSpec['toRow'] },
  products: { table: 'products', toRow: productToRow as RemoteSpec['toRow'] },
  movements: {
    table: 'stock_movements',
    toRow: movementToRow as RemoteSpec['toRow'],
    immutable: true,
  },
  entries: { table: 'cash_entries', toRow: cashEntryToRow as RemoteSpec['toRow'] },
  closings: { table: 'cash_closings', toRow: cashClosingToRow as RemoteSpec['toRow'] },
  blocks: { table: 'schedule_blocks', toRow: blockToRow as RemoteSpec['toRow'] },
  waitlist: { table: 'waitlist', toRow: waitlistToRow as RemoteSpec['toRow'] },
};

export const isRemoteKey = (key: string): key is RemoteKey => key in REMOTE;
