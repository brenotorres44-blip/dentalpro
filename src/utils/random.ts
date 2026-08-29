/**
 * Aleatoriedade semeada.
 *
 * Todo dado mockado do sistema nasce daqui: a mesma semente sempre produz a
 * mesma sequência. É o que garante que trocar de dia no calendário e voltar não
 * reembaralhe a tela, e que a ficha de um cliente mostre sempre o mesmo
 * histórico. Extraído de `dashboardService` quando os módulos passaram a
 * precisar das mesmas garantias.
 */

export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerador pronto a partir de uma chave textual. */
export const seeded = (key: string) => mulberry32(hashString(key));

export const between = (rnd: () => number, min: number, max: number) => min + rnd() * (max - min);

export const intBetween = (rnd: () => number, min: number, max: number) =>
  Math.round(between(rnd, min, max));

export const pick = <T,>(rnd: () => number, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/**
 * Remove acentos preservando as letras.
 *
 * NFD separa a letra do diacrítico, e `\p{Diacritic}` remove só o acento. Uma
 * limpeza ingênua de caracteres não-ASCII transformaria "Vinícius" em
 * "vincius" — some com a letra junto com o acento.
 */
export const deburr = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Fisher–Yates sobre uma cópia — a lista de origem nunca é tocada. */
export function shuffle<T>(rnd: () => number, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
