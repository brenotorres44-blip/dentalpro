import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { Callout, Field } from '@/components/ui/Field';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { updatePassword } from '@/services/authService';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

/** Mesma régua do cadastro. Abaixo disso o próprio Supabase recusa. */
const MIN = 8;

/**
 * REDEFINIR SENHA — o destino do link do e-mail.
 *
 * Esta tela não existia, e sem ela a recuperação era um beco: o Supabase
 * mandava o link, o link caía numa rota que não existe, e a pessoa voltava para
 * o login sem senha nova.
 *
 * ## Por que não há token nesta tela
 *
 * O link traz o token no *fragmento* da URL, e o `supabase-js` o consome antes
 * de o React montar (`detectSessionInUrl`, ligado por padrão): quando chegamos
 * aqui já existe **sessão de recuperação**. Por isso a tela só pergunta a senha
 * nova — e por isso "não há sessão" é a forma de dizer "o link expirou ou já
 * foi usado", que é a única coisa verdadeira que dá para afirmar nesse caso.
 *
 * A rota é pública de propósito. Envolvê-la em `RedirectIfAuthenticated`
 * mandaria para `/app` justamente quem acabou de chegar pelo link — a sessão de
 * recuperação é uma sessão como outra qualquer para o guard.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [linkOk, setLinkOk] = useState<boolean | null>(null);

  /*
   * Conferir a sessão antes de mostrar o formulário.
   *
   * Sem isso, a pessoa digita a senha duas vezes, clica, e só então descobre
   * que o link não vale mais. O erro é o mesmo; o momento é que muda — e pedir
   * trabalho antes de dizer que não vai funcionar é a parte evitável.
   */
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLinkOk(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setLinkOk(Boolean(data.session));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < MIN) {
      setError(`A senha precisa ter pelo menos ${MIN} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
      // A sessão de recuperação já é uma sessão válida: depois de gravar, a
      // pessoa está dentro. Mandar para o login pediria a senha que ela acabou
      // de escolher, sem motivo.
      setTimeout(() => navigate('/app/dashboard', { replace: true }), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gravar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <div className="mb-6 text-center">
          <h1 className="font-display text-[17px] font-bold tracking-[0.24em] text-ink">
            NOVA SENHA
          </h1>
          <p className="tech-label mt-1.5">ESCOLHA A SENHA DE ACESSO</p>
        </div>

        <div className="holo-panel relative p-6">
          <CornerBrackets />

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-success/50 text-success shadow-[0_0_28px_-8px_var(--color-success)]">
                <ShieldCheck size={24} />
              </span>
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-success">
                Senha alterada
              </p>
              <p className="text-[12.5px] leading-relaxed text-ink-dim">
                Levando você para o painel…
              </p>
            </motion.div>
          ) : linkOk === false ? (
            <div className="flex flex-col gap-4 py-2">
              <Callout tone="critical" icon={<AlertTriangle size={13} />}>
                {isSupabaseConfigured
                  ? 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'
                  : 'Esta instalação está em modo demonstração: não há e-mail nem senha para redefinir.'}
              </Callout>
              <Link
                to="/forgot-password"
                className="flex items-center justify-center gap-2 rounded-[3px] border border-hud/50 bg-hud/12 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-hud transition-all duration-200 hover:bg-hud/20"
              >
                Pedir novo link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field
                label="Senha nova"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`No mínimo ${MIN} caracteres`}
              />
              <Field
                label="Repita a senha"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />

              {error && (
                <Callout tone="critical" icon={<AlertTriangle size={13} />}>
                  {error}
                </Callout>
              )}

              <button
                type="submit"
                disabled={busy || linkOk === null}
                className="flex items-center justify-center gap-2 rounded-[3px] border border-hud/50 bg-hud/12 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-hud transition-all duration-200 hover:bg-hud/20 hover:shadow-[0_0_24px_-8px_var(--color-hud)] disabled:opacity-45"
              >
                <KeyRound size={13} />
                {busy ? 'Gravando…' : 'Gravar senha'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center">
          <Link
            to="/login"
            className="tech-label inline-flex items-center gap-1.5 transition-colors hover:text-hud"
          >
            <ArrowLeft size={11} />
            VOLTAR AO LOGIN
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
