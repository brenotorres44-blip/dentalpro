const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const INT = new Intl.NumberFormat('pt-BR');

/** Valores monetários chegam em centavos e saem formatados. Nunca use float. */
export const formatBRL = (cents: number) => BRL.format(cents / 100);
export const formatBRLCompact = (cents: number) => BRL_COMPACT.format(cents / 100);
export const formatInt = (value: number) => INT.format(Math.round(value));
export const formatPercent = (value: number, digits = 0) =>
  `${value.toFixed(digits).replace('.', ',')}%`;

/** Delta assinado, para comparativos ("+12,5%"). */
export const formatDelta = (value: number, digits = 1) =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits).replace('.', ',')}%`;

export const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const MONTHS = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

/** Chave estável YYYY-MM-DD em horário local (sem passar por UTC). */
export function dateKey(date: Date) {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export const isSameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Iniciais para o avatar holográfico ("João Silva" → "JS"). */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
