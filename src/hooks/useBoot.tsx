import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Sequência de inicialização do sistema.
 *
 * A tela não "aparece": ela é montada em ordem, como um instrumento ligando.
 * Cada componente pergunta `stage >= BootStage.X` para decidir se já existe.
 * Total: ~1,4 s — rápido o bastante para não atrapalhar quem só quer trabalhar.
 */
export const BootStage = {
  DARK: 0,
  BACKGROUND: 1, // o vazio e a malha técnica
  LINES: 2, // linhas estruturais desenhadas
  PANELS: 3, // painéis montados
  CHARTS: 4, // gráficos construídos
  INDICATORS: 5, // indicadores ativados
  DATA: 6, // informações preenchidas
  CORE: 7, // núcleo central online
} as const;

export type BootStageValue = (typeof BootStage)[keyof typeof BootStage];

const SCHEDULE: Array<[BootStageValue, number]> = [
  [BootStage.BACKGROUND, 60],
  [BootStage.LINES, 240],
  [BootStage.PANELS, 430],
  [BootStage.CHARTS, 640],
  [BootStage.INDICATORS, 830],
  [BootStage.DATA, 1010],
  [BootStage.CORE, 1220],
];

interface BootContextValue {
  stage: number;
  booted: boolean;
  /** Atraso em ms para escalonar itens dentro de um mesmo estágio. */
  stagger: (index: number, step?: number) => number;
}

const BootContext = createContext<BootContextValue>({
  stage: BootStage.CORE,
  booted: true,
  stagger: () => 0,
});

export function BootProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<number>(reduced ? BootStage.CORE : BootStage.DARK);

  useEffect(() => {
    if (reduced) {
      setStage(BootStage.CORE);
      return;
    }
    const timers = SCHEDULE.map(([value, delay]) =>
      window.setTimeout(() => setStage((current) => Math.max(current, value)), delay),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  const value = useMemo<BootContextValue>(
    () => ({
      stage,
      booted: stage >= BootStage.CORE,
      stagger: (index: number, step = 55) => (reduced ? 0 : index * step),
    }),
    [stage, reduced],
  );

  return <BootContext.Provider value={value}>{children}</BootContext.Provider>;
}

export const useBoot = () => useContext(BootContext);
