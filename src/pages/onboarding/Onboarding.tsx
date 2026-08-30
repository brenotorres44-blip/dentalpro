import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  CreditCard,
  ImageIcon,
  Package,
  Rocket,
  Smile,
  UserRound,
} from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useSession } from '@/auth/SessionProvider';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/utils/cn';

interface Task {
  id: string;
  label: string;
  hint: string;
  icon: typeof Building2;
  /** Itens obrigatórios travam a entrada no sistema. */
  required: boolean;
}

const TASKS: Task[] = [
  { id: 'company', label: 'Dados da empresa', hint: 'Nome, documento, endereço e contato', icon: Building2, required: true },
  { id: 'logo', label: 'Logo', hint: 'Aparece no painel e na página pública', icon: ImageIcon, required: false },
  { id: 'professionals', label: 'Equipe', hint: 'Quem atende e em quais horários', icon: UserRound, required: true },
  { id: 'services', label: 'Procedimentos', hint: 'Catálogo, duração e preços', icon: Smile, required: true },
  { id: 'hours', label: 'Horários', hint: 'Funcionamento, folgas e feriados', icon: Clock3, required: true },
  { id: 'payments', label: 'Formas de pagamento', hint: 'Dinheiro, cartão, PIX', icon: CreditCard, required: false },
  { id: 'inventory', label: 'Itens de consultório', hint: 'Itens e quantidade mínima', icon: Package, required: false },
];

/** Estado inicial: o cadastro já resolveu empresa, logo e equipe. */
const INITIAL_DONE = ['company', 'logo', 'professionals'];

export function Onboarding() {
  const navigate = useNavigate();
  const { company } = useSession();
  const [done, setDone] = useState<string[]>(INITIAL_DONE);
  const [launching, setLaunching] = useState(false);

  const progress = Math.round((done.length / TASKS.length) * 100);
  const animatedProgress = useCountUp(progress, { duration: 700 });

  const pendingRequired = useMemo(
    () => TASKS.filter((t) => t.required && !done.includes(t.id)),
    [done],
  );
  const complete = pendingRequired.length === 0;

  const toggle = (id: string) =>
    setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  function enter() {
    setLaunching(true);
    setTimeout(() => navigate('/app/dashboard', { replace: true }), 1400);
  }

  if (launching) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 250, damping: 22 }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-hud/60 text-hud">
            <Rocket size={32} className="anim-float" />
          </span>
          <h1 className="font-display text-[20px] font-semibold text-ink">Tudo pronto</h1>
          <p className="text-[13px] text-ink-faint">Abrindo o painel...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 text-center">
          <span className="tech-label text-hud">Configuração inicial</span>
          <h1 className="mt-2 font-display text-[22px] font-semibold text-ink">
            Vamos configurar sua clínica
          </h1>
          <p className="mt-2 text-[13px] text-ink-dim">
            {company?.name ?? 'Sua clínica'} · marque o que já está pronto
          </p>
        </div>

        <div className="holo-panel relative p-5 sm:p-6">
          {/* progresso */}
          <div className="mb-6 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="tech-label">Progresso</span>
              <span className="font-display text-[21px] font-semibold text-hud tnum">
                {Math.round(animatedProgress)}%
                <span className="ml-1.5 text-[11px] font-normal text-ink-faint">concluído</span>
              </span>
            </div>
            <ProgressBar value={progress} label="Progresso da configuração" />
          </div>

          <ul className="flex flex-col gap-1.5">
            {TASKS.map((task, i) => {
              const isDone = done.includes(task.id);
              const Icon = task.icon;
              return (
                <motion.li
                  key={task.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.06 * i }}
                >
                  <button
                    onClick={() => toggle(task.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-[8px] border px-3 py-3 text-left',
                      'transition-all duration-200',
                      isDone
                        ? 'border-success/25 bg-success/[0.05]'
                        : 'border-hud/10 bg-white/[0.015] hover:border-hud/35 hover:bg-hud/[0.04]',
                    )}
                    aria-pressed={isDone}
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-200',
                        isDone
                          ? 'border-success/60 bg-success/15 text-success'
                          : 'border-stroke/70 text-ink-faint group-hover:border-hud/50 group-hover:text-hud',
                      )}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {isDone ? (
                          <motion.span
                            key="check"
                            initial={{ scale: 0, rotate: -30 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Check size={13} />
                          </motion.span>
                        ) : (
                          <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                            <Icon size={13} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'flex items-center gap-2 text-[13px] font-medium',
                          isDone ? 'text-ink-dim line-through decoration-success/40' : 'text-ink',
                        )}
                      >
                        {task.label}
                        {task.required && !isDone && (
                          <span className="rounded-[8px] border border-warn/30 bg-warn/10 px-1.5 py-px font-mono text-[8px] text-warn">
                            obrigatório
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-ink-faint">{task.hint}</span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-col gap-3 border-t border-hud/10 pt-5">
            {!complete && (
              <div className="flex items-center gap-2">
                <StatusIndicator tone="warn" pulse />
                <span className="text-[11.5px] text-ink-dim">
                  Faltam {pendingRequired.length}{' '}
                  {pendingRequired.length === 1 ? 'item obrigatório' : 'itens obrigatórios'}:{' '}
                  <span className="text-warn">{pendingRequired.map((t) => t.label).join(', ')}</span>
                </span>
              </div>
            )}

            <button
              onClick={enter}
              disabled={!complete}
              className={cn(
                'group flex items-center justify-center gap-2 rounded-[8px] border py-3',
                'font-mono text-[11px] transition-all duration-200',
                complete
                  ? 'border-hud/50 bg-hud/12 text-hud hover:bg-hud/20'
                  : 'cursor-not-allowed border-stroke/50 text-ink-faint/60',
              )}
            >
              Entrar no sistema
              <ArrowRight
                size={13}
                className={cn('transition-transform', complete && 'group-hover:translate-x-1')}
              />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
