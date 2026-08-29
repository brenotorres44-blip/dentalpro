import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '@/lib/supabase/client';
import type { Company, Role, SaasUser } from '@/data/saas';
import { FALLBACK_OVERRIDE, type ThemeOverride } from '@/themes/tokens';
import type { Session } from './authService';
import { createCompanyFor, type CompanyDraft } from './signupService';

/**
 * AUTENTICAÇÃO CONTRA O SUPABASE
 *
 * Devolve a mesma `Session` que o mock devolvia. É o que faz a troca não tocar
 * em componente nenhum: `SessionProvider` continua chamando `login()` e
 * recebendo a mesma forma.
 *
 * A diferença real está embaixo: a senha agora é verificada, o papel vem de
 * `memberships` no banco, e a RLS decide o que cada requisição enxerga. O que
 * antes era convenção da interface virou barreira.
 */

export class SupabaseAuthError extends Error {}

/** Mensagens do Supabase são em inglês e genéricas por segurança. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado. No painel do Supabase, em Authentication > Users, use "Confirm email".';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Tentativas demais. Espere um minuto e tente de novo.';
  }
  // O projeto sem SMTP próprio usa o remetente do Supabase, que é limitado a
  // poucos e-mails por hora. Dizer isso evita a conclusão errada de que o
  // endereço está errado.
  if (m.includes('error sending') || m.includes('smtp')) {
    return 'O projeto não conseguiu enviar o e-mail. Verifique o SMTP em Authentication → Emails.';
  }
  if (m.includes('same as the old') || m.includes('should be different')) {
    return 'A senha nova precisa ser diferente da atual.';
  }
  if (m.includes('at least') && m.includes('characters')) {
    return 'A senha é curta demais para as regras do projeto.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Não foi possível falar com o servidor. Verifique a conexão e a URL do projeto.';
  }
  return message;
}

/* ==========================================================================
   EMPRESAS VISÍVEIS À SESSÃO
   ========================================================================= */

interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: Company['status'];
  plan_id: string;
  theme_id: string;
  /** Cores e efeitos por cima do tema base. `{}` quando nunca foi personalizado. */
  theme_override: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Cache preenchido no login.
 *
 * `getCompany()` é síncrono e chamado durante o render — não pode virar uma ida
 * ao servidor sem espalhar estado de carregamento por toda a árvore. Como o
 * conjunto de empresas de uma sessão é pequeno e estável, buscar uma vez e
 * guardar resolve sem custo.
 */
const companyCache = new Map<string, Company>();

export function cachedCompany(id: string): Company | null {
  return companyCache.get(id) ?? null;
}

/**
 * Aplica o tema no cache **antes** de o servidor responder.
 *
 * `getCompanyTheme()` é síncrono e lido durante o render; sem isto, o slider
 * voltaria ao valor antigo no próximo ciclo do React e só andaria de novo quando
 * a resposta chegasse — um controle que resiste ao dedo do usuário.
 */
export function cacheCompanyTheme(id: string, theme: ThemeOverride) {
  const current = companyCache.get(id);
  if (current) companyCache.set(id, { ...current, theme });
}

/**
 * Grava o tema, uma vez só por rajada.
 *
 * O `ThemeProvider` chama `onChange` a **cada** quadro do slider — arrastar o
 * brilho de ponta a ponta são dezenas de eventos. Mandar cada um ao banco seria
 * o defeito que a tela de planos acabou de perder, agora por segundo: escritas
 * demais, e o valor final decidido por qual resposta chegar por último, que não
 * é necessariamente a última que o usuário escolheu.
 *
 * O `Map` por empresa, e não um timer só, existe porque o administrador de
 * plataforma pode ter mais de um ambiente em jogo na mesma sessão.
 */
const themeWrites = new Map<string, ReturnType<typeof setTimeout>>();

/** Tempo depois do último movimento do slider. Curto o bastante para parecer imediato. */
const THEME_DEBOUNCE_MS = 700;

export function persistCompanyTheme(
  id: string,
  theme: ThemeOverride,
  onError: (message: string) => void,
) {
  const pending = themeWrites.get(id);
  if (pending) clearTimeout(pending);

  themeWrites.set(
    id,
    setTimeout(() => {
      themeWrites.delete(id);

      // `baseThemeId` viaja como coluna, não dentro do jsonb: é o que a vitrine
      // pública lê sem precisar entender o override, e o que `/admin/themes`
      // agrupa para montar a adoção.
      const { baseThemeId, ...override } = theme;

      void requireSupabase()
        .rpc('set_company_theme', {
          p_company: id,
          p_theme_id: baseThemeId,
          p_override: override,
        })
        .then(({ error }) => {
          if (!error) return;
          onError(
            error.message.includes('SEM_PERMISSAO_TEMA')
              ? 'Você não tem permissão para alterar o tema desta clínica.'
              : 'Não foi possível salvar o tema. A última alteração não foi gravada.',
          );
        });
    }, THEME_DEBOUNCE_MS),
  );
}

/**
 * A empresa como a sessão precisa dela: identidade, tema e plano.
 *
 * Contagens e faturamento ficam em zero de propósito. Quem os calcula é
 * `platform_companies()`, e o SAAS CONTROL CENTER lê de lá — repetir a conta
 * aqui criaria dois números para a mesma pergunta, com o desta função sempre
 * atrasado, porque a sessão só é montada no login.
 */
function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    document: row.document ?? '',
    email: '',
    ownerName: '',
    ownerEmail: '',
    phone: row.phone ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    status: row.status,
    planId: row.plan_id,
    users: 0,
    professionals: 0,
    clients: 0,
    monthlyRevenueCents: 0,
    createdAt: row.created_at,
    lastActivityAt: row.created_at,
    // O override vem primeiro e `baseThemeId` depois, de propósito: o tema base
    // é coluna própria e manda sobre qualquer `baseThemeId` que tenha sobrado
    // dentro do jsonb de uma versão anterior.
    theme: { ...FALLBACK_OVERRIDE, ...(row.theme_override ?? {}), baseThemeId: row.theme_id },
  };
}

const COMPANY_COLUMNS =
  'id, name, slug, document, phone, city, state, status, plan_id, theme_id, theme_override, created_at';

/* ==========================================================================
   SESSÃO
   ========================================================================= */

/**
 * Monta a sessão a partir do usuário autenticado.
 *
 * As três consultas correm juntas: em série somariam três viagens de rede antes
 * do primeiro pixel depois do login.
 */
async function buildSession(authUser: User): Promise<Session> {
  const sb = requireSupabase();

  const [membership, platformAdmin] = await Promise.all([
    sb
      .from('memberships')
      .select('company_id, role')
      .eq('user_id', authUser.id)
      .limit(1)
      .maybeSingle(),
    // A policy só devolve linha para quem é admin de plataforma; a contagem
    // funciona como o próprio teste.
    sb.from('platform_admins').select('user_id').limit(1).maybeSingle(),
  ]);

  const isPlatformAdmin = Boolean(platformAdmin.data);
  let link = membership.data;

  /*
   * Clínica pendente do cadastro.
   *
   * Quando o projeto exige confirmação de e-mail, `signUp` não devolve sessão e
   * a empresa não pôde ser criada na hora. A intenção ficou guardada no
   * metadata; este é o primeiro momento em que existe `auth.uid()` para
   * executá-la. É o "nasce no primeiro acesso confirmado" que a tela de
   * cadastro promete.
   */
  const pending = authUser.user_metadata?.pending_company as CompanyDraft | undefined;

  if (!isPlatformAdmin && !link && pending?.name) {
    const created = await createCompanyFor(pending);
    if (created.ok) {
      const again = await sb
        .from('memberships')
        .select('company_id, role')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle();
      link = again.data;
    }
  }

  /*
   * A intenção é de uso único, e isso precisou ser dito em código.
   *
   * `pending_company` ficava no metadata para sempre. Como o bloco acima roda
   * em **todo** login sem vínculo, apagar a clínica fazia outra nascer no
   * acesso seguinte — vazia, com slug novo, e sem ninguém ter pedido. Quem
   * cancelou o contrato voltava a ter empresa; o painel da plataforma ganhava
   * uma clínica fantasma por login.
   *
   * Descoberto do jeito mais direto possível: apagamos a empresa de teste, eu
   * entrei para conferir, e ela reapareceu com 62 segundos de idade.
   *
   * A limpeza vale também para quem **já** tinha vínculo: com clínica na mão,
   * a intenção guardada não significa mais nada, e guardá-la é só manter a
   * armadilha armada. Falha aqui não derruba o login — o pior caso é continuar
   * como estava.
   */
  if (pending?.name && (link || isPlatformAdmin)) {
    await sb.auth.updateUser({ data: { pending_company: null } }).catch(() => undefined);
  }

  // Quem administra a plataforma entra no centro de comando, não no ambiente de
  // um cliente — mesmo tendo vínculo com uma clínica. Para operar a clínica
  // ele usa "acessar ambiente", que registra a entrada.
  const role: Role = isPlatformAdmin ? 'super_admin' : ((link?.role as Role) ?? 'owner');
  const companyId = isPlatformAdmin ? null : (link?.company_id ?? null);

  /*
   * Conta sem clínica deixa de ser erro fatal.
   *
   * Antes isto derrubava o login com uma instrução de SQL na tela — inútil para
   * quem não administra o banco, e um beco sem saída para quem se cadastrou
   * antes desta correção. Agora vira um estado que a aplicação sabe tratar:
   * a pessoa é levada a criar a clínica.
   */
  const needsCompany = !isPlatformAdmin && !link;

  // Carrega as empresas visíveis (uma para o dono; todas para o admin).
  const { data: companies } = await sb.from('companies').select(COMPANY_COLUMNS);
  companyCache.clear();
  for (const row of (companies ?? []) as CompanyRow[]) {
    companyCache.set(row.id, toCompany(row));
  }

  const user: SaasUser = {
    id: authUser.id,
    name:
      (authUser.user_metadata?.name as string | undefined) ??
      authUser.email?.split('@')[0] ??
      'Usuário',
    email: authUser.email ?? '',
    companyId,
    companyName: companyId ? (companyCache.get(companyId)?.name ?? null) : null,
    role,
    lastAccessAt: new Date().toISOString(),
    active: true,
  };

  return { user, companyId, impersonatingCompanyId: null, issuedAt: Date.now(), needsCompany };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const sb = requireSupabase();

  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw new SupabaseAuthError(translate(error.message));
  if (!data.user) throw new SupabaseAuthError('Login sem usuário na resposta.');

  return buildSession(data.user);
}

/**
 * Recupera a sessão gravada, se o token ainda vale.
 *
 * O `supabase-js` renova o token sozinho; aqui só perguntamos o estado atual.
 * Um erro ao montar a sessão (vínculo removido, por exemplo) derruba o login em
 * vez de deixar o usuário numa aplicação sem dado nenhum.
 */
export async function restoreSession(): Promise<Session | null> {
  const sb = requireSupabase();

  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.user) return null;

  try {
    return await buildSession(data.session.user);
  } catch {
    await sb.auth.signOut();
    return null;
  }
}

export async function signOut() {
  await requireSupabase().auth.signOut();
  companyCache.clear();
}

/* ==========================================================================
   SENHA
   ========================================================================= */

/**
 * Pede o e-mail de redefinição.
 *
 * `redirectTo` precisa estar na lista de **Redirect URLs** do projeto
 * (Authentication → URL Configuration). Fora dela, o Supabase manda o link para
 * a URL do site e a pessoa cai numa tela que não sabe o que fazer com o token.
 *
 * O retorno é sempre o mesmo, com ou sem conta: dizer "este e-mail não existe"
 * entrega uma lista de contas válidas a quem estiver testando endereços.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const sb = requireSupabase();

  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });

  // Só erro de infraestrutura sobe (limite de envio, projeto sem SMTP). O
  // "não achei este e-mail" o Supabase já não devolve, pelo mesmo motivo.
  if (error) throw new SupabaseAuthError(translate(error.message));
}

/**
 * Grava a senha nova.
 *
 * Quem chega aqui já está autenticado: o link do e-mail cria uma sessão de
 * recuperação antes de a tela montar (`detectSessionInUrl`, ligado por padrão).
 * É por isso que não existe um "token" a passar — se não houver sessão, o link
 * expirou ou já foi usado, e é isso que a tela precisa dizer.
 */
export async function updatePassword(password: string): Promise<void> {
  const sb = requireSupabase();

  const { data } = await sb.auth.getSession();
  if (!data.session) {
    throw new SupabaseAuthError(
      'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
    );
  }

  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new SupabaseAuthError(translate(error.message));
}
