import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CONTROL_CENTER_THEME,
  FALLBACK_OVERRIDE,
  applyOverride,
  resolveTheme,
  type Theme,
  type ThemeEffects,
  type ThemeOverride,
} from './tokens';

interface ThemeContextValue {
  theme: Theme;
  override: ThemeOverride;
  /** Falso enquanto o ambiente administrativo estiver no comando. */
  editable: boolean;
  setBaseTheme: (id: string) => void;
  setColor: (key: keyof Omit<ThemeOverride, 'baseThemeId' | 'effects'>, value: string) => void;
  setEffect: <K extends keyof ThemeEffects>(key: K, value: ThemeEffects[K]) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Escreve os tokens como estilo inline no <html>: vence o `@theme` do Tailwind. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--color-${key}`, value);
  }

  root.style.setProperty('--fx-glow', `${theme.effects.glow}`);
  root.style.setProperty('--fx-particles', `${theme.effects.particles}`);
  // Velocidade maior = duração menor, por isso o inverso.
  root.style.setProperty('--fx-motion', `${1 / Math.max(theme.effects.motion, 0.05)}`);
  root.style.setProperty('--radius-card', `${theme.effects.radius}px`);
  root.style.setProperty('--panel-mix', `${theme.effects.panelMix}%`);
  root.style.setProperty('--fx-chrome', `${theme.effects.chrome}`);
  root.style.setProperty('--fx-shadow', `${theme.effects.shadow}`);
  root.style.setProperty('--density', `${theme.effects.density}`);
  root.style.setProperty('--font-display', theme.typography.display);
  root.style.setProperty('--tech-tracking', theme.typography.tracking);
  // PROTÓTIPO — eixo de forma. Cai no valor histórico quando o tema não opina.
  root.style.setProperty('--font-sans', theme.typography.body ?? "'Inter', ui-sans-serif, system-ui, sans-serif");
  root.style.setProperty('--tech-size', theme.typography.labelSize ?? '0.625rem');
  root.style.setProperty('--tech-case', theme.typography.labelCase ?? 'uppercase');

  root.style.colorScheme = theme.mode;
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
}

export function ThemeProvider({
  /** Personalização da empresa ativa. */
  value,
  onChange,
  /**
   * Força **a base** do centro de comando e tira a edição das mãos do cliente.
   *
   * Deixou de significar "nenhuma personalização": o administrador ajusta cores
   * e efeitos do próprio painel em `/admin/themes`, e eles chegam aqui por
   * `value`. O que continua imutável é a base — `CONTROL_CENTER_THEME` está
   * fora de `THEMES`, então não há como o painel virar o tema de um cliente, e
   * o sinal de "onde estou operando" sobrevive ao ajuste.
   */
  locked = false,
  /**
   * Base explícita, quando quem chama já sabe qual é.
   *
   * O centro de comando precisa disto porque a base dele pode ser
   * `CONTROL_CENTER_THEME`, que **não está em `THEMES`** — de propósito, para
   * nenhuma clínica poder escolhê-lo. Pelo caminho normal,
   * `getTheme('control-center')` cairia no fallback e devolveria PREMIUM.
   */
  baseTheme,
  children,
}: {
  value?: Partial<ThemeOverride>;
  onChange?: (next: ThemeOverride) => void;
  locked?: boolean;
  baseTheme?: Theme;
  children: ReactNode;
}) {
  // `baseThemeId` sempre presente: `value` pode vir parcial — o centro de
  // comando manda um override sem base, porque a dele chega por `baseTheme`.
  const [local, setLocal] = useState<ThemeOverride>({ ...FALLBACK_OVERRIDE, ...value });

  // A empresa ativa é a fonte da verdade; o estado local só existe para telas
  // sem empresa (login, landing) e para o preview antes de salvar.
  useEffect(() => {
    if (value) setLocal({ ...FALLBACK_OVERRIDE, ...value });
  }, [value]);

  const theme = useMemo(
    () =>
      baseTheme ? applyOverride(baseTheme, local)
      : locked ? applyOverride(CONTROL_CENTER_THEME, local)
      : resolveTheme(local),
    [baseTheme, locked, local],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const commit = useCallback(
    (next: ThemeOverride) => {
      setLocal(next);
      onChange?.(next);
    },
    [onChange],
  );

  const api = useMemo<ThemeContextValue>(
    () => ({
      theme,
      override: local,
      editable: !locked,
      setBaseTheme: (id) =>
        // Trocar de tema base descarta as cores personalizadas: manter um roxo
        // do Cyberpunk por cima do Luxury produziria uma paleta que ninguém escolheu.
        commit({ baseThemeId: id }),
      setColor: (key, value) => commit({ ...local, [key]: value }),
      setEffect: (key, value) =>
        commit({ ...local, effects: { ...local.effects, [key]: value } }),
      reset: () => commit({ baseThemeId: local.baseThemeId }),
    }),
    [theme, local, locked, commit],
  );

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>.');
  return ctx;
}
