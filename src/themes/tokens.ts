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
    tagline: 'Branco, verde-consultório e azul contido — claro e sem ruído',
    mode: 'light',
    tokens: {
      void: '#f5f7f6',
      abyss: '#eef2f0',
      deep: '#e6ebe8',
      panel: '#ffffff',
      elevated: '#ffffff',
      stroke: '#d9e2de',
      'stroke-soft': '#e6ece9',
      hud: '#0d8f7a',
      'hud-bright': '#14b8a6',
      'hud-deep': '#0a6b5c',
      electric: '#2f6fed',
      'electric-deep': '#1e4fb8',
      critical: '#d1483c',
      warn: '#b3790f',
      success: '#1f8a5f',
      idle: '#9aa6a2',
      ink: '#101917',
      'ink-dim': '#48534f',
      // 4,8:1 contra o painel branco — folga acima do mínimo da regra 10.
      'ink-faint': '#6d7874',
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
      void: '#0e1412',
      abyss: '#131a18',
      deep: '#18201d',
      panel: '#1d2623',
      elevated: '#24302c',
      stroke: '#33413c',
      'stroke-soft': '#283530',
      hud: '#2dd4bf',
      'hud-bright': '#5eead4',
      'hud-deep': '#0f766e',
      electric: '#60a5fa',
      'electric-deep': '#3b82f6',
      critical: '#f18b82',
      warn: '#f0c766',
      success: '#6ad9a3',
      idle: '#7c8a85',
      ink: '#eef4f2',
      'ink-dim': '#aebab5',
      'ink-faint': '#7f8d88',
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
