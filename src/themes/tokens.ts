/**
 * MOTOR DE TEMAS
 *
 * Cada tema é um mapa de custom properties CSS. O ThemeProvider escreve esses
 * valores como estilo inline no <html>, que vence a declaração `@theme` do
 * Tailwind por especificidade — por isso a troca é instantânea e não exige
 * recarregar nem reconstruir nada.
 *
 * Os NOMES dos tokens são estáveis (`--color-hud` = acento primário,
 * `--color-electric` = secundário). Isso é o que permite os temas existirem
 * sem que nenhum componente saiba que temas existem — mesma arquitetura do
 * projeto de origem, só que a paleta parte de um consultório, não de uma nave.
 */

export type ThemeMode = 'dark' | 'light';

export interface ThemeTokens {
  // superfícies
  void: string;
  abyss: string;
  deep: string;
  panel: string;
  elevated: string;
  // estrutura
  stroke: string;
  'stroke-soft': string;
  // acento primário
  hud: string;
  'hud-bright': string;
  'hud-deep': string;
  // acento secundário
  electric: string;
  'electric-deep': string;
  // estados
  critical: string;
  warn: string;
  success: string;
  idle: string;
  // tipografia
  ink: string;
  'ink-dim': string;
  'ink-faint': string;
}

export interface ThemeEffects {
  /** Intensidade do brilho: 0 = plano, 1 = padrão, 1.6 = exagerado. */
  glow: number;
  /** Densidade da poeira de dados do fundo (0 desliga o canvas). */
  particles: number;
  /** Multiplicador de velocidade das animações contínuas. */
  motion: number;
  /** Raio dos cards, em px. 0 = cantos vivos (mais técnico). */
  radius: number;
  /** Opacidade do vidro dos painéis, 0–100. */
  panelMix: number;
  /**
   * Ornamentos de HUD: cantoneiras, varredura e faixa de telemetria.
   * 0 remove a moldura futurista sem apagar um componente sequer — é o que
   * permite um mesmo sistema parecer instrumento de comando ou produto sóbrio.
   */
  chrome: number;
  /** Elevação por sombra. É o que substitui o brilho nos temas discretos. */
  shadow: number;
  /** Respiro dos painéis. >1 abre espaço, <1 compacta. */
  density: number;
}

export interface ThemeTypography {
  /** Fonte de títulos e números. */
  display: string;
  /** Espaçamento dos rótulos técnicos em caixa alta. */
  tracking: string;
  /** Fonte do corpo de texto. */
  body?: string;
  /** Tamanho do rótulo técnico. `0.625rem` = 10px, o valor histórico do HUD. */
  labelSize?: string;
  /** `uppercase` no vocabulário de HUD; `none` numa leitura editorial/clínica. */
  labelCase?: 'uppercase' | 'none';
}

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
  effects: ThemeEffects;
  typography: ThemeTypography;
  /** Temas de sistema não podem ser editados nem excluídos pelo cliente. */
  system?: boolean;
}

const DEFAULT_EFFECTS: ThemeEffects = {
  glow: 0,
  particles: 0,
  motion: 0.9,
  radius: 12,
  panelMix: 100,
  chrome: 0,
  shadow: 0.5,
  density: 1.1,
};

/** Tipografia clínica: uma família só, rótulo em caixa normal, sem gritar. */
const CLEAN_TYPE: ThemeTypography = {
  display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  tracking: '0.02em',
  body: "'Inter', ui-sans-serif, system-ui, sans-serif",
  labelSize: '0.72rem',
  labelCase: 'none',
};

/**
 * PRODENT parte de um pedido explícito: layout limpo para consultório, sem o
 * vocabulário de HUD do projeto de origem (cantoneiras, varredura, brilho).
 * Por isso `chrome`, `glow` e `particles` já nascem em zero no padrão — não é
 * um tema "sóbrio" ao lado de outros futuristas, é a única família aqui. A
 * arquitetura de tokens continua a mesma: qualquer clínica pode ligar esses
 * efeitos de volta puxando os sliders no Theme Builder, o motor não proíbe.
 */
export const THEMES: Theme[] = [
  {
    id: 'clinic-clean',
    name: 'CLEAN',
    tagline: 'Branco e azul contido — a paleta de um consultório, não de um painel de comando',
    mode: 'light',
    tokens: {
      void: '#f7f8fa',
      abyss: '#f2f4f7',
      deep: '#edf0f3',
      panel: '#ffffff',
      elevated: '#ffffff',
      stroke: '#e4e9ee',
      'stroke-soft': '#edf1f4',
      hud: '#2d7dd2',
      'hud-bright': '#4c93de',
      'hud-deep': '#1a5fa8',
      electric: '#7c3aed',
      'electric-deep': '#5b21b6',
      critical: '#d94040',
      warn: '#d98b1a',
      success: '#1a9e75',
      idle: '#9aabb8',
      ink: '#0f1923',
      'ink-dim': '#475569',
      // 4,9:1 contra o painel branco — folga acima do mínimo da regra 10.
      'ink-faint': '#64748b',
    },
    effects: { ...DEFAULT_EFFECTS },
    typography: CLEAN_TYPE,
  },
  {
    id: 'clinic-night',
    name: 'CLEAN NOTURNO',
    tagline: 'A mesma clínica, para plantão e ambiente escuro',
    mode: 'dark',
    tokens: {
      void: '#0b1220',
      abyss: '#0f1829',
      deep: '#131f33',
      panel: '#182640',
      elevated: '#1e2f4d',
      stroke: '#2c3d5c',
      'stroke-soft': '#22324e',
      hud: '#5b9be0',
      'hud-bright': '#8ec0ee',
      'hud-deep': '#3672b0',
      electric: '#a78bfa',
      'electric-deep': '#7c5cf0',
      critical: '#f18b82',
      warn: '#f0c766',
      success: '#6ad9a3',
      idle: '#7c8aa0',
      ink: '#eef2f8',
      'ink-dim': '#b0bccf',
      'ink-faint': '#8393ab',
    },
    effects: {
      ...DEFAULT_EFFECTS,
      glow: 0.15,
      shadow: 0.7,
      chrome: 0.08,
    },
    typography: CLEAN_TYPE,
  },
];

/**
 * Tema exclusivo do painel administrativo do SaaS (SAAS CONTROL CENTER).
 *
 * Fica fora de `THEMES` de propósito: nenhuma clínica pode selecioná-lo e o
 * administrador não pode trocá-lo. É o sinal visual de que você está no
 * centro de comando da plataforma e não dentro do ambiente de um cliente —
 * mesma regra do projeto de origem, mesmo com o vocabulário visual limpo em
 * vez de HUD: ardósia escura e âmbar continuam sendo a única paleta que diverge.
 */
export const CONTROL_CENTER_THEME: Theme = {
  id: 'control-center',
  name: 'CONTROL CENTER',
  tagline: 'Identidade fixa do administrador da plataforma',
  mode: 'dark',
  system: true,
  tokens: {
    void: '#0c0e13',
    abyss: '#111319',
    deep: '#161923',
    panel: '#1b1f2b',
    elevated: '#232838',
    stroke: '#343b4d',
    'stroke-soft': '#262c3c',
    hud: '#c2a15e',
    'hud-bright': '#e0c07e',
    'hud-deep': '#8f7539',
    electric: '#8b93c9',
    'electric-deep': '#5c6499',
    critical: '#e8898f',
    warn: '#dcae57',
    success: '#7ec49a',
    idle: '#6f7590',
    ink: '#f1f0f6',
    'ink-dim': '#b0aec4',
    // 5,1:1 contra o painel.
    'ink-faint': '#8b899e',
  },
  effects: {
    ...DEFAULT_EFFECTS,
    glow: 0.12,
    shadow: 0.9,
    chrome: 0.1,
    panelMix: 92,
  },
  typography: CLEAN_TYPE,
};

export const DEFAULT_THEME_ID = 'clinic-clean';

export const getTheme = (id: string): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;

/**
 * Personalização por cima de um tema base.
 * Guardada por empresa — é o que o Theme Builder edita.
 */
export interface ThemeOverride {
  baseThemeId: string;
  /** Substitui `hud` (cor principal). */
  primary?: string;
  /** Substitui `electric` (cor secundária). */
  secondary?: string;
  /** Substitui `hud-bright` (cor de destaque). */
  accent?: string;
  /** Substitui `ink` (cor dos textos). */
  text?: string;
  /** Substitui `void` (cor de fundo). */
  background?: string;
  effects?: Partial<ThemeEffects>;
}

/**
 * Aplica um override sobre um tema **já resolvido**, sem mutá-lo.
 *
 * Separado de `resolveTheme` porque o centro de comando precisa exatamente
 * disto e não pode passar pelo caminho normal: `CONTROL_CENTER_THEME` não está
 * em `THEMES` — de propósito, para que nenhuma clínica possa escolhê-lo — e
 * `getTheme('control-center')` cairia no fallback, devolvendo o tema CLEAN.
 * O painel do administrador ficaria com a paleta de um cliente ao primeiro
 * ajuste de cor, que é o oposto do que a identidade fixa existe para garantir.
 */
export function applyOverride(base: Theme, override: Partial<ThemeOverride> | undefined): Theme {
  if (!override) return base;

  return {
    ...base,
    tokens: {
      ...base.tokens,
      ...(override.primary ? { hud: override.primary } : {}),
      ...(override.secondary ? { electric: override.secondary } : {}),
      ...(override.accent ? { 'hud-bright': override.accent } : {}),
      ...(override.text ? { ink: override.text } : {}),
      ...(override.background ? { void: override.background } : {}),
    },
    effects: { ...base.effects, ...override.effects },
  };
}

/** Aplica a personalização da clínica sobre o tema base, sem mutá-lo. */
export function resolveTheme(override: ThemeOverride | undefined): Theme {
  return applyOverride(getTheme(override?.baseThemeId ?? DEFAULT_THEME_ID), override);
}

export const FALLBACK_OVERRIDE: ThemeOverride = { baseThemeId: DEFAULT_THEME_ID };
