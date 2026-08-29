import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useSession } from '@/auth/SessionProvider';
import { homeFor } from '@/auth/guards';
import { DEMO_ACCOUNTS } from '@/data/saas';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/themes/ThemeProvider';
import { cn } from '@/utils/cn';

const SEQUENCE = ['AUTHENTICATING...', 'VERIFYING USER...', 'LOADING ENVIRONMENT...'];

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSession();
  const reduced = useReducedMotion();
  const { theme } = useTheme();
  const chrome = theme.effects.chrome;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'authenticating' | 'granted'>('idle');
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;

    setError(null);
    setPhase('authenticating');
    setStep(0);

    // A sequência é encenação, mas roda em paralelo com a autenticação real —
    // não é um atraso artificial somado ao tempo de resposta.
    const beat = reduced ? 0 : 420;
    if (!reduced) {
      timers.current.push(window.setTimeout(() => setStep(1), beat));
      timers.current.push(window.setTimeout(() => setStep(2), beat * 2));
    }

    try {
      const [session] = await Promise.all([
        login(email, password),
        new Promise((r) => setTimeout(r, reduced ? 0 : beat * 3)),
      ]);

      setPhase('granted');
      const from = (location.state as { from?: string } | null)?.from;
      timers.current.push(
        window.setTimeout(
          () => navigate(from ?? homeFor(session.user.role), { replace: true }),
          reduced ? 0 : 620,
        ),
      );
    } catch (err) {
      setPhase('idle');
      setStep(0);
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    }
  }

  const busy = phase !== 'idle';

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
          <div className="relative grid h-14 w-14 place-items-center">
            <span className="absolute inset-0 rotate-45 rounded-[4px] border border-hud/50 shadow-[0_0_26px_-6px_var(--color-hud)]" />
            <span className="absolute inset-2.5 rotate-45 rounded-[3px] bg-hud/15" />
            {chrome >= 0.5 && (
              <span
                className="absolute inset-[-10px] rounded-full border border-dashed border-hud/25 anim-spin-slow"
                aria-hidden
              />
            )}
            <span className="relative font-display text-[15px] font-bold text-hud">P</span>
          </div>
          <div className="text-center">
            <h1 className="font-display text-[19px] font-bold tracking-[0.34em] text-ink">
              PRODENT
            </h1>
            <p className="tech-label mt-1">ACESSO AO SISTEMA</p>
          </div>
        </div>

        <div className="holo-panel relative p-6">
          <CornerBrackets />

          <AnimatePresence mode="wait">
            {phase === 'idle' ? (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
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
                    className="flex items-center gap-2 rounded-[3px] border border-critical/30 bg-critical/10 px-3 py-2 text-[12px] text-critical"
                    role="alert"
                  >
                    <StatusIndicator tone="critical" />
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  className={cn(
                    'group relative mt-1 flex items-center justify-center gap-2 overflow-hidden',
                    'rounded-[3px] border border-hud/50 bg-hud/12 py-3',
                    'font-mono text-[11px] uppercase tracking-[0.24em] text-hud',
                    'transition-all duration-200 hover:border-hud hover:bg-hud/20',
                    'hover:shadow-[0_0_28px_-8px_var(--color-hud)] active:scale-[0.99]',
                  )}
                >
                  {chrome >= 0.5 && (
                    <span className="anim-sweep pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-hud/15 to-transparent" />
                  )}
                  <span className="relative">Entrar</span>
                  <ArrowRight
                    size={13}
                    className="relative transition-transform duration-200 group-hover:translate-x-1"
                  />
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
              </motion.form>
            ) : (
              <motion.div
                key="sequence"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-[286px] flex-col items-center justify-center gap-5"
              >
                {phase === 'authenticating' ? (
                  <>
                    <span
                      className="h-10 w-10 rounded-full border-2 border-hud/20 border-t-hud anim-spin-fast"
                      aria-hidden
                    />
                    <div className="flex flex-col items-center gap-1.5">
                      {SEQUENCE.map((line, i) => (
                        <motion.span
                          key={line}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: i <= step ? 1 : 0.18 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            'font-mono text-[11px] tracking-[0.2em]',
                            i === step ? 'text-hud' : 'text-ink-faint',
                          )}
                        >
                          {line}
                        </motion.span>
                      ))}
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-success/60 text-success shadow-[0_0_30px_-6px_var(--color-success)]">
                      <ShieldCheck size={24} />
                    </span>
                    <span className="font-mono text-[13px] font-semibold tracking-[0.24em] text-success text-glow">
                      ACCESS GRANTED
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
                  className="group flex items-center justify-between gap-3 rounded-[3px] border border-hud/12 bg-white/[0.02] px-3 py-2 text-left transition-colors duration-200 hover:border-hud/40 hover:bg-hud/[0.05]"
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
          <Link to="/" className="tech-label transition-colors hover:text-hud">
            ← VOLTAR AO SITE
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
            'w-full rounded-[3px] border border-stroke/70 bg-void/50 py-2.5 pl-9 pr-3',
            'text-[13px] text-ink placeholder:text-ink-faint/60',
            'transition-all duration-200 outline-none',
            'focus:border-hud/60 focus:bg-hud/[0.04] focus:shadow-[0_0_20px_-8px_var(--color-hud)]',
          )}
        />
      </span>
    </label>
  );
}
