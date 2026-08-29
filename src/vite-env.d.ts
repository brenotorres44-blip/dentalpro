/// <reference types="vite/client" />

/**
 * Variáveis de ambiente do cliente.
 *
 * Declaradas para que `import.meta.env.VITE_SUPABASE_URL` seja `string |
 * undefined` em vez de `any` — errar o nome de uma variável passa a ser erro de
 * compilação, não uma tela em branco em produção.
 *
 * Ambas são opcionais: sem elas a aplicação roda no modo mock.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
