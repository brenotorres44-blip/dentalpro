import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase/client';
import { startDemoSession } from './authService';

/**
 * CADASTRO
 *
 * Três coisas precisam acontecer juntas para uma clínica nascer: a conta em
 * `auth.users`, a empresa, e o vínculo de dono entre as duas. As duas últimas
 * saem da função `create_company_and_owner` no banco, numa transação só — se o
 * frontend fizesse os três passos em sequência, uma falha no meio deixaria uma
 * conta órfã, sem empresa e sem como criar uma.
 */

export interface SignupInput {
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  companyName: string;
  document: string;
  companyPhone: string;
  city: string;
  state: string;
  themeId: string;
}

export type SignupResult =
  /**
   * Conta criada, empresa criada, sessão ativa: pode entrar.
   * `demo` marca o cadastro encenado do modo mock.
   */
  | { status: 'ready'; companyName: string; demo?: boolean }
  /** O projeto exige confirmação por e-mail — não há sessão para continuar. */
  | { status: 'confirm-email'; email: string };

export class SignupError extends Error {}

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Já existe uma conta com este e-mail. Tente entrar.';
  }
  if (m.includes('password') && m.includes('least')) {
    return 'A senha é curta demais para as regras do projeto.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'O cadastro está desativado no projeto. Ative em Authentication > Sign In / Providers.';
  }
  if (m.includes('ja_tem_empresa')) {
    return 'Esta conta já está vinculada a uma clínica.';
  }
  // A conta foi apagada no painel mas o token continua válido até expirar.
  if (m.includes('conta_removida') || m.includes('memberships_user_id_fkey')) {
    return 'Sua sessão aponta para uma conta que não existe mais. Saia e entre novamente.';
  }
  if (m.includes('nao_autenticado')) {
    return 'Sua sessão expirou. Entre novamente.';
  }
  if (m.includes('failed to fetch')) {
    return 'Não foi possível falar com o servidor. Verifique a conexão.';
  }
  return message;
}

export async function signUp(input: SignupInput): Promise<SignupResult> {
  // Sem backend o cadastro é encenação: não há onde gravar a conta. Entra na
  // clínica de demonstração para que o fluxo seja percorrível de ponta a
  // ponta, e a tela seguinte diz que foi isso que aconteceu.
  if (!isSupabaseConfigured) {
    await new Promise((r) => setTimeout(r, 600));
    if (!startDemoSession()) {
      throw new SignupError('Não há conta de demonstração disponível.');
    }
    return { status: 'ready', companyName: input.companyName.trim(), demo: true };
  }

  const sb = requireSupabase();

  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        name: input.ownerName.trim(),
        phone: input.phone,
        // A clínica viaja junto com a conta.
        //
        // Quando o projeto exige confirmação de e-mail, `signUp` não devolve
        // sessão — e sem sessão não dá para criar a empresa, porque a RPC
        // depende de `auth.uid()`. Guardando a intenção aqui, o primeiro acesso
        // já autenticado a executa. Sem isso, quem confirma o e-mail entra numa
        // conta órfã, para sempre.
        pending_company: {
          name: input.companyName.trim(),
          document: input.document,
          phone: input.companyPhone || input.phone,
          city: input.city,
          state: input.state,
          themeId: input.themeId,
        },
      },
    },
  });

  if (error) throw new SignupError(translate(error.message));

  if (!data.session) return { status: 'confirm-email', email: input.email.trim() };

  const created = await createCompanyFor({
    name: input.companyName.trim(),
    document: input.document,
    phone: input.companyPhone || input.phone,
    city: input.city,
    state: input.state,
    themeId: input.themeId,
  });

  if (!created.ok) {
    // A conta ficou criada; só a clínica falhou. Dizer isso evita que a
    // pessoa tente se cadastrar de novo e receba "e-mail já registrado".
    throw new SignupError(`Sua conta foi criada, mas a clínica não: ${created.error}`);
  }

  return { status: 'ready', companyName: input.companyName.trim() };
}

/**
 * Conta de quem foi convidado — sem clínica junto.
 *
 * O cadastro normal carrega `pending_company` no metadata, e é isso que faz uma
 * empresa nascer no primeiro acesso. Quem chega por convite **não** pode criar
 * empresa nenhuma: ele vai entrar na de outra pessoa, e uma clínica fantasma
 * a mais apareceria no painel do administrador a cada convite aceito.
 *
 * O e-mail não é escolhido aqui: vem do convite. Deixar o campo aberto faria a
 * pessoa criar a conta com outro endereço e receber "este convite é de outro
 * e-mail" depois — com a conta já criada.
 */
export async function signUpForInvite(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ status: 'ready' } | { status: 'confirm-email' }> {
  const sb = requireSupabase();

  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });

  if (error) throw new SignupError(translate(error.message));

  // Com confirmação de e-mail ligada não há sessão, e sem sessão não dá para
  // aceitar. O convite continua de pé — quem autoriza é o e-mail, não o link.
  return data.session ? { status: 'ready' } : { status: 'confirm-email' };
}

export interface CompanyDraft {
  name: string;
  document?: string;
  phone?: string;
  city?: string;
  state?: string;
  themeId?: string;
}

/**
 * Cria a clínica para quem já está autenticado.
 *
 * Usada em três momentos: no cadastro direto, no primeiro acesso depois da
 * confirmação por e-mail, e na tela de recuperação para contas que ficaram sem
 * empresa. Um caminho só para os três evita que se comportem diferente.
 */
export async function createCompanyFor(
  draft: CompanyDraft,
): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const sb = requireSupabase();

  const { data, error } = await sb.rpc('create_company_and_owner', {
    p_name: draft.name.trim(),
    p_document: draft.document ?? null,
    p_phone: draft.phone ?? null,
    p_city: draft.city ?? null,
    p_state: draft.state ?? null,
    p_theme_id: draft.themeId ?? 'clinic-clean',
  });

  if (error) return { ok: false, error: translate(error.message) };
  return { ok: true, companyId: data as string };
}
