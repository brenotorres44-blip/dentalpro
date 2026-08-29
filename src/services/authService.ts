import { COMPANIES, USERS, type Company, type SaasUser } from '@/data/saas';
import { FALLBACK_OVERRIDE, type ThemeOverride } from '@/themes/tokens';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  cacheCompanyTheme,
  cachedCompany,
  persistCompanyTheme,
  requestPasswordReset as supabaseRequestPasswordReset,
  restoreSession as restoreSupabaseSession,
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
  updatePassword as supabaseUpdatePassword,
} from './supabaseAuth';

/**
 * SERVIÇO DE AUTENTICAÇÃO
 *
 * A promessa se cumpriu: a assinatura era `login(email, senha) => Session` e
 * continua sendo. Nenhum componente mudou quando o Supabase entrou — este
 * arquivo virou a fachada que escolhe a implementação.
 *
 * **Com `.env.local` preenchido**, a senha é verificada de verdade, o papel vem
 * de `memberships` no banco e a RLS decide o que cada requisição enxerga.
 *
 * **Sem ele**, cai no modo mock: usuários em memória, qualquer senha aceita. É
 * o que mantém o repositório clonável sem provisionar nada — e o que permite
 * migrar um módulo de cada vez em vez de um corte que derruba tudo até a última
 * tela estar pronta.
 */

const SESSION_KEY = 'prodent.session';
const THEME_KEY = 'prodent.themes';

/**
 * Qual ambiente o administrador está visitando.
 *
 * Chave própria, separada da sessão, porque no modo banco a sessão **não é
 * nossa**: `restoreSession()` remonta tudo a partir do token do Supabase e
 * devolve `impersonatingCompanyId: null` sempre. O resultado era um F5 dentro
 * da clínica do cliente devolvendo as capacidades de plataforma — e
 * `RequireCapability` expulsando o admin para `/admin/dashboard` sem dizer
 * nada, no meio do que ele estava fazendo.
 *
 * Não é credencial: quem decide se ele pode entrar é `is_platform_admin()` no
 * banco. Forjar esta chave dá acesso a telas que carregam vazias.
 */
const IMPERSONATION_KEY = 'prodent.impersonating';

function readImpersonation(): string | null {
  try {
    return localStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return null;
  }
}

function writeImpersonation(companyId: string | null) {
  try {
    if (companyId) localStorage.setItem(IMPERSONATION_KEY, companyId);
    else localStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    // Sem storage, a visita dura até o próximo reload — que é o comportamento
    // que existia para todo mundo antes desta correção.
  }
}

export interface Session {
  user: SaasUser;
  /** Empresa cujo ambiente está sendo exibido (null no centro de comando). */
  companyId: string | null;
  /** Preenchido quando o super admin entra no ambiente de um cliente. */
  impersonatingCompanyId: string | null;
  issuedAt: number;
  /**
   * Autenticado, mas sem clínica.
   *
   * Acontece com quem confirmou o e-mail antes de a empresa ser criada, e com
   * contas anteriores à criação diferida. A aplicação leva essa sessão para a
   * tela de criar clínica em vez de para o painel vazio.
   */
  needsCompany?: boolean;
}

export class AuthError extends Error {}

function persist(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Modo privativo / storage cheio: a sessão vira apenas de memória.
  }
}

/**
 * Assíncrona mesmo no modo mock.
 *
 * Recuperar a sessão do Supabase é uma ida ao servidor; se a assinatura mudasse
 * de forma conforme o modo, cada chamador precisaria saber qual está ativo —
 * exatamente o vazamento que esta fachada existe para evitar.
 */
export async function loadSession(): Promise<Session | null> {
  if (isSupabaseConfigured) {
    const restored = await restoreSupabaseSession();
    return restored ? withImpersonation(restored) : null;
  }

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    // Revalida contra a base: um usuário removido não pode ressuscitar via
    // storage antigo.
    const user = USERS.find((u) => u.id === parsed.user.id);
    if (!user || !user.active) return null;
    return { ...parsed, user };
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  if (isSupabaseConfigured) {
    try {
      return await supabaseSignIn(email, password);
    } catch (error) {
      // Normaliza para o tipo que a tela de login já trata.
      throw new AuthError(error instanceof Error ? error.message : 'Falha ao entrar.');
    }
  }

  await new Promise((r) => setTimeout(r, 620)); // latência simulada do fluxo real

  const user = USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) throw new AuthError('Usuário não encontrado.');
  if (!user.active) throw new AuthError('Esta conta está desativada.');

  const session: Session = {
    user,
    companyId: user.companyId,
    impersonatingCompanyId: null,
    issuedAt: Date.now(),
  };
  persist(session);
  return session;
}

/**
 * Sessão de demonstração para o cadastro em modo mock.
 *
 * Sem backend não há onde gravar a conta que a pessoa acabou de digitar, e
 * tentar entrar com o e-mail dela falharia — ele não existe na lista fixa. O
 * cadastro então entra na conta de demonstração, e a tela deixa isso explícito
 * em vez de fingir que criou algo.
 */
export function startDemoSession(): Session | null {
  const user = USERS.find((u) => u.role === 'owner' && u.active);
  if (!user) return null;

  const session: Session = {
    user,
    companyId: user.companyId,
    impersonatingCompanyId: null,
    issuedAt: Date.now(),
  };
  persist(session);
  return session;
}

/* ==========================================================================
   SENHA

   No modo mock a senha não existe — qualquer uma entra. Encenar um envio aqui
   seria a tela dizendo "verifique seu e-mail" sobre um e-mail que ninguém
   mandou, e a pessoa esperaria por ele. Recusar em voz alta é a única resposta
   honesta, e é a mesma linha do envio de arquivos.
   ========================================================================= */

export const MOCK_SEM_EMAIL =
  'A recuperação de senha exige o Supabase configurado. No modo demonstração qualquer senha entra — use os botões de conta na tela de login.';

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new AuthError(MOCK_SEM_EMAIL);
  try {
    await supabaseRequestPasswordReset(email);
  } catch (error) {
    throw new AuthError(error instanceof Error ? error.message : 'Falha ao enviar o link.');
  }
}

export async function updatePassword(password: string): Promise<void> {
  if (!isSupabaseConfigured) throw new AuthError(MOCK_SEM_EMAIL);
  try {
    await supabaseUpdatePassword(password);
  } catch (error) {
    throw new AuthError(error instanceof Error ? error.message : 'Falha ao gravar a senha.');
  }
}

export function logout() {
  // Sair encerra a visita junto. Sem isto, o próximo login neste navegador
  // abriria dentro da clínica que o administrador anterior estava vendo.
  writeImpersonation(null);

  if (isSupabaseConfigured) {
    void supabaseSignOut();
    return;
  }
  persist(null);
}

/**
 * Devolve a sessão ao ambiente que o administrador estava visitando.
 *
 * Só se aplica a `super_admin`: se o papel mudou entre uma sessão e outra — o
 * vínculo de plataforma foi removido, ou outra pessoa entrou neste navegador —
 * a marca é lixo de uma sessão que acabou, e sair dela em silêncio é melhor que
 * deixar o próximo usuário com a empresa errada carregada.
 */
function withImpersonation(session: Session): Session {
  const companyId = readImpersonation();
  if (!companyId) return session;

  if (session.user.role !== 'super_admin') {
    writeImpersonation(null);
    return session;
  }

  return { ...session, companyId, impersonatingCompanyId: companyId };
}

/** Super admin assume o ambiente de uma empresa. */
export function impersonate(session: Session, companyId: string): Session {
  if (session.user.role !== 'super_admin') {
    throw new AuthError('Somente o administrador da plataforma pode acessar outro ambiente.');
  }
  const next: Session = { ...session, companyId, impersonatingCompanyId: companyId };
  writeImpersonation(companyId);
  persist(next);
  return next;
}

export function stopImpersonating(session: Session): Session {
  const next: Session = {
    ...session,
    companyId: session.user.companyId,
    impersonatingCompanyId: null,
  };
  writeImpersonation(null);
  persist(next);
  return next;
}

// ---------------------------------------------------------------------------
// Temas por empresa
// ---------------------------------------------------------------------------

/**
 * A personalização visual é por empresa e fica fora da sessão de propósito:
 * o tema pertence ao tenant, não a quem está olhando. Um admin entrando no
 * ambiente enxerga exatamente o que o cliente vê.
 */
function readThemeStore(): Record<string, ThemeOverride> {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY) ?? '{}') as Record<string, ThemeOverride>;
  } catch {
    return {};
  }
}

export function getCompanyTheme(companyId: string): ThemeOverride {
  /*
   * Com banco, o `localStorage` não entra na conta.
   *
   * Ele foi a única casa do tema por tempo demais, e o override velho de um
   * navegador qualquer ficaria por cima do que o banco passou a guardar — a
   * pessoa trocaria o tema em outro dispositivo e este continuaria mostrando a
   * escolha antiga, sem nada na tela explicando por quê. É a mesma decisão que
   * `store.persist()` já tomava: a fonte é o servidor, a memória é o espelho.
   */
  if (isSupabaseConfigured) return getCompany(companyId)?.theme ?? FALLBACK_OVERRIDE;

  const stored = readThemeStore()[companyId];
  if (stored) return stored;
  return getCompany(companyId)?.theme ?? FALLBACK_OVERRIDE;
}

export function saveCompanyTheme(companyId: string, theme: ThemeOverride) {
  if (isSupabaseConfigured) {
    // Otimista, como as nove coleções do store: o cache muda agora e o banco
    // recebe a rajada inteira em uma escrita só. Se recusar, o aviso sobe no
    // mesmo `SyncStatus` que já cobre o resto da operação.
    cacheCompanyTheme(companyId, theme);
    persistCompanyTheme(companyId, theme, (message) => {
      void import('./store').then((m) => m.mutate(() => ({ lastError: message })));
    });
    return;
  }

  try {
    localStorage.setItem(THEME_KEY, JSON.stringify({ ...readThemeStore(), [companyId]: theme }));
  } catch {
    /* sem persistência disponível */
  }
}

/**
 * Empresa por id.
 *
 * Síncrona porque é chamada durante o render. No modo Supabase lê do cache
 * preenchido no login; o `??` para o mock cobre o painel administrativo, que
 * ainda não migrou e continua listando empresas fictícias.
 */
export function getCompany(companyId: string | null): Company | null {
  if (!companyId) return null;
  if (isSupabaseConfigured) {
    const fromDb = cachedCompany(companyId);
    if (fromDb) return fromDb;
  }
  return COMPANIES.find((c) => c.id === companyId) ?? null;
}
