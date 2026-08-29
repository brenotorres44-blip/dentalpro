import { useSyncExternalStore } from 'react';
import { CONTROL_CENTER_THEME, THEMES, getTheme, type Theme, type ThemeOverride } from './tokens';

/**
 * O TEMA DO CENTRO DE COMANDO.
 *
 * A base continua sendo `CONTROL_CENTER_THEME`, e continua fora de `THEMES` —
 * nenhuma empresa pode escolhê-la. O que passou a existir é uma camada por
 * cima: cores e efeitos, ajustados por quem opera o painel.
 *
 * **Por que `localStorage`, se acabamos de tirar o tema da empresa de lá.**
 *
 * São coisas diferentes, e a diferença é quem enxerga o resultado. O tema da
 * clínica é um dado do negócio: a vitrine `/<slug>` o mostra para os clientes
 * dela, e guardá-lo por navegador significava que o público-alvo nunca o via —
 * foi esse o defeito do `0017`. O tema do centro de comando não tem público:
 * ninguém além de quem está olhando a tela. Uma tabela no banco para guardar
 * uma preferência de cor de um operador seria um custo sem leitor.
 *
 * O preço é conhecido e aceito: trocar de máquina pede reconfigurar.
 */

const KEY = 'prodent.admin-theme';

/**
 * `baseThemeId` é opcional, e ausente significa `control-center`.
 *
 * A primeira versão disto **removia** o campo do tipo, para travar a base na
 * identidade da plataforma. Estava restritivo demais: quem opera o painel
 * quer escolher entre os temas prontos, não só mexer em cinco cores.
 *
 * Os dois ambientes são independentes: usar no `/admin` o mesmo tema que uma
 * clínica usa é válido e não afeta nada dela. A assimetria que permanece é só
 * de catálogo — `CONTROL_CENTER_THEME` fica fora de `THEMES`, então o caminho é
 * de mão única: o administrador alcança qualquer tema de cliente, e nenhum
 * cliente alcança o da plataforma.
 */
export type AdminThemeOverride = Partial<ThemeOverride>;

/** Ausente ou este valor = a identidade da plataforma. */
export const ADMIN_BASE_ID = CONTROL_CENTER_THEME.id;

/**
 * As bases que o painel aceita: a identidade da plataforma primeiro, depois os
 * temas prontos.
 *
 * `CONTROL_CENTER_THEME` continua **fora** de `THEMES`, e essa lista não muda
 * isso: aqui é o administrador escolhendo para si. Nenhuma clínica alcança
 * este array, então o tema da plataforma segue indisponível para os clientes.
 */
export const ADMIN_BASE_CHOICES: Theme[] = [CONTROL_CENTER_THEME, ...THEMES];

/**
 * De volta ao objeto `Theme`.
 *
 * Não dá para usar `getTheme()` sozinho: ele procura em `THEMES`, onde a
 * identidade da plataforma não está, e cairia no fallback devolvendo PREMIUM.
 */
export function resolveAdminBase(override: AdminThemeOverride): Theme {
  const id = override.baseThemeId;
  if (!id || id === ADMIN_BASE_ID) return CONTROL_CENTER_THEME;
  return getTheme(id);
}

const VAZIO: AdminThemeOverride = {};

function ler(): AdminThemeOverride {
  if (typeof window === 'undefined') return VAZIO;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return VAZIO;
    return JSON.parse(raw) as AdminThemeOverride;
  } catch {
    return VAZIO;
  }
}

/*
 * Estado de módulo com `useSyncExternalStore`, e não contexto.
 *
 * Quem edita é `/admin/themes`; quem aplica no `<html>` é o `AdminLayout`, que
 * está **acima** dela na árvore. Com contexto, a página teria de empurrar a
 * mudança para cima. Aqui os dois leem a mesma fonte, e o painel repinta no
 * mesmo quadro em que o slider anda.
 */
let estado = ler();
const listeners = new Set<() => void>();

function notificar() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => estado;

export function useAdminTheme(): AdminThemeOverride {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setAdminTheme(next: AdminThemeOverride) {
  estado = next;

  try {
    // Objeto vazio some da chave em vez de gravar `{}`: o painel volta a ser o
    // `control-center` puro, e não o `control-center` "com uma personalização
    // que por acaso não muda nada".
    if (Object.keys(next).length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Modo privativo ou cota cheia: o ajuste vale até o próximo reload. Perder
    // a preferência é aceitável; derrubar o painel não é.
  }

  notificar();
}

export function resetAdminTheme() {
  setAdminTheme(VAZIO);
}
