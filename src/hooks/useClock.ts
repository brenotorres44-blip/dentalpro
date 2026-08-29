import { useEffect, useState } from 'react';

/**
 * Relógio do sistema. Um único intervalo para toda a aplicação — o TopBar é o
 * único consumidor, então não vale a pena um contexto.
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(now)
    .replace(/\./g, '')
    .toUpperCase();

  return { now, time, date };
}
