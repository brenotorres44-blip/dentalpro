import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useSession } from '@/auth/SessionProvider';
import { homeFor } from '@/auth/guards';
import { DEMO_ACCOUNTS } from '@/data/saas';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { cn } from '@/utils/cn';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      const session = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homeFor(session.user.role), { replace: true });
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[400px]"
      >
        {/* marca */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-hud/10 font-display text-[17px] font-bold text-hud">
            P
          </span>
          <div className="text-center">
            <h1 className="font-display text-[20px] font-bold text-ink">PRODENT</h1>
            <p className="mt-1 text-[12.5px] text-ink-faint">Entrar no painel</p>
          </div>
        </div>

        <div className="holo-panel relative p-6">
          {busy ? (
            <div className="flex min-h-[286px] flex-col items-center justify-center gap-4">
              <span
                className="h-8 w-8 rounded-full border-2 border-hud/20 border-t-hud anim-spin-fast"
                aria-hidden
              />
              <span className="text-[13px] text-ink-faint">Entrando...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field
                icon={<Mail size={14} />}
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="voce@suaclinica.com"
                autoComplete="username"
                required
              />
              <Field
                icon={<Lock size={14} />}
                label="Senha"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-[8px] border border-critical/30 bg-critical/10 px-3 py-2 text-[12px] text-critical"
                  role="alert"
                >
                  <StatusIndicator tone="critical" />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                className={cn(
                  'mt-1 flex items-center justify-center gap-2 rounded-[8px]',
                  'bg-hud py-3 text-[13px] font-semibold text-white',
                  'transition-all duration-200 hover:bg-hud-deep active:scale-[0.99]',
                )}
              >
                Entrar
                <ArrowRight size={14} />
              </button>

              <div className="flex items-center justify-between pt-1">
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-ink-faint transition-colors hover:text-hud"
                >
                  Esqueci minha senha
                </Link>
                <Link
                  to="/register"
                  className="text-[11px] text-hud/80 transition-colors hover:text-hud"
                >
                  Criar minha conta
                </Link>
              </div>
            </form>
          )}
        </div>

        {/*
          Contas de demonstração — só no modo demonstração.

          Elas apareciam sempre, e com banco configurado isso é a tela
          oferecendo três contas que **não existem**: clicar preenche o
          formulário e o login falha. Pior, some o sinal de qual modo está
          rodando — foi assim que dois servidores de teste esquecidos no ar
          passaram por servidor de verdade, com o cadastro "entrando" numa conta
          de mentira e nada aparecendo no banco.

          Agora a lista é, ela própria, o indicador: se ela está na tela, nada
          do que você fizer é gravado.
        */}
        {!busy && !isSupabaseConfigured && (
          <div className="mt-5">
            <p className="tech-label mb-2 text-center text-warn">
              MODO DEMONSTRAÇÃO · NADA É GRAVADO
            </p>
            <div className="flex flex-col gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('demo');
                  }}
                  className="group flex items-center justify-between gap-3 rounded-[8px] border border-hud/12 bg-white/[0.02] px-3 py-2 text-left transition-colors duration-200 hover:border-hud/40 hover:bg-hud/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] text-ink">{a.email}</span>
                    <span className="block truncate text-[10px] text-ink-faint">{a.label}</span>
                  </span>
                  <ArrowRight
                    size={12}
                    className="shrink-0 text-ink-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-hud"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center">
          <Link to="/" className="text-[12px] text-ink-faint transition-colors hover:text-hud">
            ← Voltar ao site
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  label,
  ...props
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const { onChange, ...rest } = props;
  return (
    <label className="group flex flex-col gap-1.5">
      <span className="tech-label">{label}</span>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-ink-faint transition-colors duration-200 group-focus-within:text-hud">
          {icon}
        </span>
        <input
          {...rest}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-[8px] border border-stroke/70 bg-void/50 py-2.5 pl-9 pr-3',
            'text-[13px] text-ink placeholder:text-ink-faint/60',
            'transition-all duration-200 outline-none',
            'focus:border-hud/60 focus:bg-hud/[0.04]',
          )}
        />
      </span>
    </label>
  );
}
