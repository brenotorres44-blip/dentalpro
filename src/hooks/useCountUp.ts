import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Contagem animada até o valor final.
 *
 * Roda em rAF (nunca setInterval — intervalo desalinha do frame e treme) e
 * reinicia a partir do valor exibido quando o alvo muda, para que trocar de
 * data no calendário faça o número transitar em vez de saltar.
 */
export function useCountUp(target: number, options?: { duration?: number; delay?: number; enabled?: boolean }) {
  const { duration = 1100, delay = 0, enabled = true } = options ?? {};
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced || !enabled ? target : 0);
  const fromRef = useRef(reduced || !enabled ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || !enabled) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    let start: number | null = null;
    let timeoutId: number | undefined;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const next = from + (target - from) * easeOutExpo(t);
      fromRef.current = next;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };

    timeoutId = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay, reduced, enabled]);

  return value;
}
