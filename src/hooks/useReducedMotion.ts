import { useEffect, useState } from 'react';

/**
 * Fonte única para "o usuário pediu menos movimento".
 * Todo efeito contínuo (partículas, órbitas, scanner) consulta este hook
 * antes de existir — não basta encurtar a animação, o loop não deve rodar.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
