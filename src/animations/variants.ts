import type { Transition, Variants } from 'motion/react';


/**
 * Vocabulário de movimento do sistema.
 *
 * Regras: 120–260 ms, easing de desaceleração, só transform/opacity/filter.
 * Uma coisa se move por vez — nada entra girando e escalando ao mesmo tempo.
 */

export const EASE_OUT: Transition['ease'] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: Transition['ease'] = [0.65, 0, 0.35, 1];

/** Painel se materializa: sobe 12px, ganha nitidez. */
export const panelEnter: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, delay: delay / 1000, ease: EASE_OUT },
  }),
};

/** Linha de dado entrando lateralmente (agenda, estoque, profissionais). */
export const rowEnter: Variants = {
  hidden: { opacity: 0, x: -14 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, delay: delay / 1000, ease: EASE_OUT },
  }),
};

/** Transição entre páginas — curta, sem deslocamento grande. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.26, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.16, ease: EASE_IN_OUT } },
};
