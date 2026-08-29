import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * CLIENTE SUPABASE
 *
 * Um só, criado uma vez. Instanciar por chamada abriria uma conexão de Realtime
 * a cada render e perderia a sessão entre elas.
 *
 * ## Por que ele pode não existir
 *
 * Sem `.env.local`, `supabase` é `null` e a aplicação continua rodando com os
 * dados mockados. É o que mantém o repositório clonável e o `npm run dev`
 * funcionando para quem nunca provisionou um projeto — e o que permite migrar
 * um módulo de cada vez, em vez de um corte que derruba tudo até a última tela
 * estar pronta.
 *
 * A chave publicável (`sb_publishable_…`, antiga `anon`) vai para o bundle de
 * propósito: ela não autoriza nada sozinha. Quem decide o que cada requisição
 * enxerga é a RLS. A `sb_secret_…` ignora RLS e nunca pode aparecer aqui —
 * qualquer variável com prefixo `VITE_` é lida por quem abrir o DevTools.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** Erro de configuração é erro de quem instala, e precisa ser dito na hora. */
function validate(): string | null {
  if (!url && !anonKey) return null; // modo mock, deliberado
  if (!url) return 'VITE_SUPABASE_URL está faltando no .env.local';
  if (!anonKey) return 'VITE_SUPABASE_ANON_KEY está faltando no .env.local';

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return `VITE_SUPABASE_URL não parece um endereço de projeto: "${url}"`;
  }
  // Barreira contra o acidente mais caro possível.
  if (anonKey.startsWith('sb_secret_') || anonKey.includes('service_role')) {
    return 'A chave secreta (service_role) foi colocada no lugar da publicável. Ela ignora RLS e não pode ir para o navegador — troque pela sb_publishable_… e rotacione a que vazou.';
  }
  return null;
}

export const configError = validate();

if (configError) console.error(`[supabase] ${configError}`);

export const supabase: SupabaseClient | null =
  url && anonKey && !configError
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // O token vive no localStorage sob esta chave; o mock usava
          // `prodent.session`. Nomes distintos para que uma sessão antiga do
          // modo mock não seja lida como se fosse do Supabase.
          storageKey: 'prodent.auth',
        },
      })
    : null;

/** O app está falando com um banco de verdade? */
export const isSupabaseConfigured = supabase !== null;

/**
 * Cliente garantido, para os caminhos que só existem com backend.
 * Falha alto em vez de devolver `null` e espalhar `?.` pela camada de dados.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Esta operação exige o Supabase configurado. Preencha o .env.local — veja docs/05-supabase.md.',
    );
  }
  return supabase;
}
