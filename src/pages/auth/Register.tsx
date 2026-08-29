import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  MailCheck,
  Palette,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Callout, Field, SelectField } from '@/components/ui/Field';
import { TechButton } from '@/components/ui/TechButton';
import { signUp } from '@/services/signupService';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { THEMES } from '@/themes/tokens';
import { useTheme } from '@/themes/ThemeProvider';
import { limitLabel, type PlanId } from '@/data/saas';
import { usePublicPlans } from '@/services/publicPlans';
import { useSession } from '@/auth/SessionProvider';
import { formatBRL } from '@/utils/format';
import { cn } from '@/utils/cn';

const STEPS = [
  { icon: UserRound, label: 'Responsável' },
  { icon: Building2, label: 'Empresa' },
  { icon: Palette, label: 'Visual' },
  { icon: Sparkles, label: 'Plano' },
];

const UF = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

interface FormState {
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  companyName: string;
  tradeName: string;
  document: string;
  companyPhone: string;
  address: string;
  city: string;
  state: string;
  displayName: string;
  themeId: string;
  planId: PlanId;
}

const EMPTY: FormState = {
  ownerName: '', email: '', phone: '', password: '', confirm: '',
  companyName: '', tradeName: '', document: '', companyPhone: '', address: '', city: '', state: 'SP',
  displayName: '', themeId: 'clinic-clean', planId: '',
};

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useSession();
  const { setBaseTheme } = useTheme();

  const plans = usePublicPlans();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    planId: (location.state as { planId?: PlanId } | null)?.planId ?? '',
  });

  /**
   * O plano padrão é o do meio, escolhido depois que a lista chega.
   *
   * Fixar `'pro'` no estado inicial parou de funcionar quando os planos
   * passaram a vir do banco: o id não existe mais, e o cadastro seguiria com um
   * plano que a função de signup recusaria — depois de a pessoa preencher
   * quatro etapas.
   */
  useEffect(() => {
    if (form.planId || !plans.length) return;
    const padrao = plans.find((p) => p.sortOrder === 2) ?? plans[0];
    setForm((f) => ({ ...f, planId: padrao.id }));
  }, [plans, form.planId]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  /** Nome da clínica criada — presente significa "deu certo". */
  const [done, setDone] = useState<string | null>(null);
  /** E-mail aguardando confirmação, quando o projeto a exige. */
  const [pending, setPending] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Cadastro encenado do modo mock — a tela precisa dizer isso. */
  const [demo, setDemo] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Valida só a etapa visível — travar o usuário por um campo de três telas à frente é hostil. */
  function validate(current: number) {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (current === 0) {
      if (!form.ownerName.trim()) e.ownerName = 'Informe seu nome.';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'E-mail inválido.';
      if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone incompleto.';
      if (form.password.length < 6) e.password = 'Mínimo de 6 caracteres.';
      if (form.password !== form.confirm) e.confirm = 'As senhas não coincidem.';
    }
    if (current === 1) {
      if (!form.companyName.trim()) e.companyName = 'Informe o nome da clínica.';
      if (form.document.replace(/\D/g, '').length < 14) e.document = 'CNPJ incompleto.';
      if (!form.city.trim()) e.city = 'Informe a cidade.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    finish();
  }

  async function finish() {
    if (!validate(step)) return;
    setSubmitting(true);
    setFatal(null);

    try {
      const result = await signUp({
        ownerName: form.ownerName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        companyName: form.companyName,
        document: form.document,
        companyPhone: form.companyPhone,
        city: form.city,
        state: form.state,
        themeId: form.themeId,
      });

      if (result.status === 'confirm-email') {
        setPending(result.email);
        return;
      }

      // A sessão já está gravada, mas o provider **não** pode saber ainda:
      // `/register` vive dentro de `RedirectIfAuthenticated`, e uma sessão
      // visível aqui dispara o redirecionamento no mesmo frame — a contagem
      // nunca chegaria a aparecer. Ela é lida quando o contador termina.
      setDemo(Boolean(result.demo));
      setDone(result.companyName);
    } catch (error) {
      // Antes, uma falha aqui deixava a tela "Preparando…" para sempre, porque
      // a exceção matava o `setTimeout` que navegava. Agora ela aparece.
      setFatal(error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- aguardando confirmação de e-mail ----------
  if (pending) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-warn/60 text-warn">
            <MailCheck size={34} />
          </span>
          <div>
            <h1 className="font-display text-[19px] font-bold tracking-[0.22em] text-warn">
              CONFIRME SEU E-MAIL
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
              Sua conta foi criada, mas este projeto exige confirmação. Abra o link enviado para{' '}
              <strong className="text-ink">{pending}</strong> e depois entre normalmente.
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
              A clínica ainda não foi criada — ela nasce no primeiro acesso confirmado.
            </p>
          </div>
          <Link to="/login">
            <TechButton variant="primary">Ir para o login</TechButton>
          </Link>
        </div>
      </div>
    );
  }

  // ---------- ambiente criado ----------
  if (done) {
    return (
      <EnvironmentReady
        companyName={done}
        demo={demo}
        onDone={async () => {
          const restored = await refresh();
          navigate(restored ? '/onboarding' : '/login', { replace: true });
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-7 text-center">
        <h1 className="font-display text-[21px] font-bold tracking-[0.24em] text-ink">
          CRIAR SUA CONTA
        </h1>
        <p className="tech-label mt-1.5">ETAPA {step + 1} DE {STEPS.length}</p>
      </div>

      {/* trilha de etapas */}
      <div className="mb-6 flex items-center">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <div key={s.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <motion.span
                  animate={{ scale: state === 'active' ? 1.08 : 1 }}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[3px] border transition-colors duration-300',
                    state === 'done' && 'border-success/50 bg-success/10 text-success',
                    state === 'active' && 'border-hud/60 bg-hud/12 text-hud shadow-[0_0_20px_-6px_var(--color-hud)]',
                    state === 'todo' && 'border-stroke/60 text-ink-faint',
                  )}
                >
                  {state === 'done' ? <Check size={14} /> : <Icon size={14} />}
                </motion.span>
                <span
                  className={cn(
                    'hidden text-[10px] sm:block',
                    state === 'active' ? 'text-hud' : 'text-ink-faint',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className="mx-2 h-px flex-1 bg-stroke/60">
                  <motion.span
                    className="block h-px bg-hud shadow-[0_0_8px_var(--color-hud)]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: i < step ? 1 : 0 }}
                    style={{ transformOrigin: 'left' }}
                    transition={{ duration: 0.35 }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="holo-panel relative p-5 sm:p-6">
        <CornerBrackets />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo" className="sm:col-span-2" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} error={errors.ownerName} placeholder="Como você se chama" />
                <Field label="E-mail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="voce@email.com" />
                <Field label="Telefone" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="(11) 90000-0000" />
                <Field label="Senha" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint="Mínimo de 6 caracteres" />
                <Field label="Confirmar senha" type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} error={errors.confirm} />
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome da clínica" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} error={errors.companyName} placeholder="Clínica Sorriso" />
                <Field label="Nome fantasia" value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} placeholder="Sorriso" />
                <Field label="CNPJ" value={form.document} onChange={(e) => set('document', e.target.value)} error={errors.document} placeholder="00.000.000/0001-00" />
                <Field label="Telefone comercial" value={form.companyPhone} onChange={(e) => set('companyPhone', e.target.value)} placeholder="(11) 3000-0000" />
                <Field label="Endereço" className="sm:col-span-2" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número, bairro" />
                <Field label="Cidade" value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} placeholder="São Paulo" />
                <SelectField label="Estado" value={form.state} onChange={(e) => set('state', e.target.value)}>
                  {UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </SelectField>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <Field label="Nome exibido no sistema" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder={form.companyName || 'CLÍNICA ELITE'} hint="É o que aparece no topo do painel" />

                <div className="flex flex-col gap-2">
                  <span className="tech-label">Tema visual</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          set('themeId', t.id);
                          // Aplica na hora: escolher tema às cegas é escolher no escuro.
                          setBaseTheme(t.id);
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-[3px] border px-3 py-2.5 text-left transition-all duration-200',
                          form.themeId === t.id
                            ? 'border-hud/60 bg-hud/[0.08]'
                            : 'border-stroke/60 hover:border-hud/35',
                        )}
                      >
                        <span className="flex shrink-0 gap-1">
                          {[t.tokens.hud, t.tokens.electric, t.tokens.void].map((c) => (
                            <span key={c} className="h-6 w-2.5 rounded-full" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-display text-[11px] font-semibold tracking-[0.14em] text-ink">
                            {t.name}
                          </span>
                          <span className="block truncate text-[10px] text-ink-faint">{t.tagline}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {plans.map((plan) => {
                  const selected = form.planId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => set('planId', plan.id)}
                      className={cn(
                        'flex flex-col gap-3 rounded-[3px] border p-4 text-left transition-all duration-200',
                        selected
                          ? 'border-hud/60 bg-hud/[0.08] shadow-[0_0_28px_-14px_var(--color-hud)]'
                          : 'border-stroke/60 hover:border-hud/35',
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-display text-[12px] font-bold tracking-[0.18em] text-ink">
                          {plan.name}
                        </span>
                        {selected && <Check size={13} className="text-hud" />}
                      </span>
                      <span className="font-display text-[19px] font-semibold text-hud tnum">
                        {formatBRL(plan.priceCents)}
                      </span>
                      <span className="flex flex-col gap-1 text-[11px] text-ink-dim">
                        <span>{limitLabel(plan.limits.professionals)} profissionais</span>
                        <span>{limitLabel(plan.limits.users)} usuários</span>
                        {plan.limits.reports && <span>Relatórios avançados</span>}
                        {plan.limits.themeBuilder && <span>Personalização de tema</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {fatal && (
          <div className="mt-5">
            <Callout tone="critical" icon={<AlertTriangle size={13} />}>
              {fatal}
            </Callout>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-hud/10 pt-5">
          <button
            type="button"
            disabled={submitting}
            onClick={() => (step === 0 ? navigate('/login') : setStep((s) => s - 1))}
            className="flex items-center gap-2 rounded-[3px] border border-stroke/70 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim transition-all duration-200 hover:border-hud/40 hover:text-ink disabled:opacity-40"
          >
            <ArrowLeft size={12} />
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>

          <button
            type="button"
            onClick={next}
            // Sem isto, um duplo clique dispara dois `signUp` e o segundo falha
            // com "e-mail já registrado" — parecendo erro de quem se cadastrou.
            disabled={submitting}
            className="group flex items-center gap-2 rounded-[3px] border border-hud/50 bg-hud/12 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-hud transition-all duration-200 hover:bg-hud/20 hover:shadow-[0_0_24px_-8px_var(--color-hud)] disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting
              ? 'Criando…'
              : step === STEPS.length - 1
                ? 'Criar minha clínica'
                : 'Continuar'}
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <p className="mt-5 text-center">
        <Link to="/login" className="tech-label transition-colors hover:text-hud">
          JÁ TENHO CONTA · ENTRAR
        </Link>
      </p>
    </div>
  );
}

/* ==========================================================================
   AMBIENTE PRONTO
   ========================================================================= */

/** Segundos de espera antes de entrar. */
const COUNTDOWN_SECONDS = 5;

/**
 * Confirmação com contagem regressiva.
 *
 * A tela anterior dizia "Preparando a configuração inicial…" e ficava parada:
 * como não havia nada a preparar, a frase era uma espera sem fim aparente — e
 * quando o cadastro falhava, era literalmente sem fim.
 *
 * Agora o número diz quanto falta, e o anel esvazia junto. Uma espera contada é
 * uma espera curta; uma espera muda é sempre longa demais. O botão de entrar
 * agora está ali para quem não quer esperar os cinco segundos.
 */
function EnvironmentReady({
  companyName,
  demo,
  onDone,
}: {
  companyName: string;
  demo?: boolean;
  onDone: () => void | Promise<void>;
}) {
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (left > 0) {
      const timer = window.setTimeout(() => setLeft((n) => n - 1), 1000);
      return () => window.clearTimeout(timer);
    }
    // O `entering` protege contra entrar duas vezes: o botão "Entrar agora" e
    // o fim da contagem podem coincidir.
    if (entering) return;
    setEntering(true);
    void onDone();
  }, [left, entering, onDone]);

  const enterNow = () => {
    if (entering) return;
    setEntering(true);
    void onDone();
  };

  const progress = left / COUNTDOWN_SECONDS;

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="flex max-w-md flex-col items-center gap-6 text-center"
      >
        {/* anel que esvazia + número */}
        <div className="relative grid h-28 w-28 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-stroke)" strokeWidth="2" />
            <motion.circle
              cx="50" cy="50" r="46" fill="none"
              stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round"
              pathLength={1}
              style={{ filter: 'drop-shadow(0 0 6px var(--color-success))' }}
              initial={false}
              animate={{ pathLength: progress }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </svg>
          <span className="font-display text-[38px] font-bold leading-none text-success text-glow tnum">
            {left}
          </span>
        </div>

        <div>
          <span className="inline-flex items-center gap-2 rounded-[3px] border border-success/40 bg-success/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-success">
            <Check size={12} />
            Ambiente criado
          </span>

          {/* O nome da clínica é o herói da tela: é a prova de que o que ela
              digitou virou um sistema com o nome dela em cima. */}
          <h1 className="mt-4 font-display text-[26px] font-bold leading-tight tracking-[0.1em] text-ink text-glow">
            {companyName.toUpperCase()}
          </h1>

          <p className="mt-3 text-[13px] text-ink-dim">
            Entrando na sua clínica em <span className="font-mono text-hud tnum">{left}</span>
            {left === 1 ? ' segundo' : ' segundos'}…
          </p>
        </div>

        {demo && (
          <Callout tone="warn" icon={<AlertTriangle size={13} />}>
            Modo demonstração: sem backend configurado, a conta não foi gravada e você entra na
            clínica de exemplo. Preencha o <code>.env.local</code> para criar de verdade.
          </Callout>
        )}

        <TechButton variant="primary" onClick={enterNow} disabled={entering} className="px-6 py-3">
          {entering ? 'Entrando…' : 'Entrar agora'}
        </TechButton>
      </motion.div>
    </div>
  );
}
