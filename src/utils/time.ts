/** Conversões entre "HH:MM" e minutos desde a meia-noite. */

export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function toTime(minutes: number) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`;
}

/** "40" → "40min"; "95" → "1h35". Duração é leitura rápida, não cálculo. */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${`${m}`.padStart(2, '0')}`;
}

/** Dois intervalos [aStart, aEnd) e [bStart, bEnd) se cruzam? */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Grade de horários entre dois limites, no passo informado. */
export function slotsBetween(open: string, close: string, stepMinutes: number) {
  const out: string[] = [];
  for (let m = toMinutes(open); m < toMinutes(close); m += stepMinutes) out.push(toTime(m));
  return out;
}
