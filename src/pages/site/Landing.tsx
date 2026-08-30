import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  Package,
  Palette,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { limitLabel } from '@/data/saas';
import { usePublicPlans } from '@/services/publicPlans';
import { formatBRL } from '@/utils/format';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { useTheme } from '@/themes/ThemeProvider';
import { cn } from '@/utils/cn';

const FEATURES = [
  { icon: CalendarClock, title: 'Agenda por dentista', text: 'Cada profissional com horários próprios, bloqueios e intervalos. Sem conflito de horário — a trava é no banco, não na tela.' },
  { icon: Users, title: 'Pacientes que voltam', text: 'Histórico de procedimentos, preferências e alerta de quem sumiu há mais de 45 dias.' },
  { icon: BarChart3, title: 'Números que você entende', text: 'Faturamento, ocupação da agenda e ticket médio por dentista, sem planilha.' },
  { icon: Package, title: 'Itens com alerta', text: 'Insumo acabando avisa antes de faltar no atendimento. Consumo interno separado do que é cobrado.' },
  { icon: Palette, title: 'Seu visual, sua marca', text: 'Temas prontos e um construtor de cores. O sistema fica com a cara da sua clínica.' },
  { icon: Smartphone, title: 'Funciona no celular', text: 'Instalável como app, sem loja. Seu paciente agenda pelo link, sem baixar nada.' },
];

const BENEFITS = [
  'Reduza faltas com lembrete automático',
  'Agenda cheia sem telefone tocando',
  'Fechamento de caixa em um clique',
  'Comissão calculada sozinha',
];

const FAQ = [
  { q: 'Preciso instalar alguma coisa?', a: 'Não. O PRODENT roda no navegador e pode ser instalado como aplicativo no celular sem passar por loja. Seus clientes agendam por um link, sem baixar nada.' },
  { q: 'Meus dados ficam separados dos de outras clínicas?', a: 'Sim. Cada empresa é um ambiente isolado: todo registro carrega o identificador da sua clínica e o isolamento é aplicado no próprio banco de dados, não apenas na interface.' },
  { q: 'Posso testar antes de pagar?', a: 'Sim, 14 dias sem cartão de crédito. Ao final do teste você escolhe um plano ou o ambiente é pausado — seus dados continuam guardados.' },
  { q: 'Consigo mudar de plano depois?', a: 'A qualquer momento, pelo próprio painel. A diferença é calculada proporcionalmente ao tempo restante do ciclo.' },
  { q: 'E se eu quiser cancelar?', a: 'Cancelamento pelo painel, sem ligação e sem multa. Você mantém acesso até o fim do período pago e pode exportar todos os seus dados.' },
];

/**
 * Ornamentos da vitrine, isolados para responderem ao tema em um só lugar.
 * Em temas sóbrios a landing perde o brilho de ficção científica sem que
 * nenhuma seção precise ser reescrita.
 */
function Sweep() {
  const { theme } = useTheme();
  if (theme.effects.chrome < 0.5) return null;
  return (
    <span
      className="anim-sweep pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-hud/15 to-transparent"
      aria-hidden
    />
  );
}

function Scan() {
  const { theme } = useTheme();
  if (theme.effects.chrome < 0.5) return null;
  return (
    <div
      className="anim-scanline pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-hud/[0.06] to-transparent"
      aria-hidden
    />
  );
}

export function Landing() {
  return (
    <div className="relative">
      <Nav />
      <Hero />
      <Features />
      <Benefits />
      <Pricing />
      <Faq />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-hud/10 bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center">
            <span className="absolute inset-0 rotate-45 rounded-[3px] border border-hud/60 shadow-[0_0_16px_-4px_var(--color-hud)]" />
            <span className="relative font-display text-[11px] font-bold text-hud">P</span>
          </span>
          <span className="font-display text-[13px] font-bold tracking-[0.28em] text-ink">
            PRODENT
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-[3px] border border-stroke/70 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim transition-all duration-200 hover:border-hud/50 hover:text-hud"
          >
            Entrar
          </Link>
          <Link
            to="/register"
            className="rounded-[3px] border border-hud/50 bg-hud/12 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-hud transition-all duration-200 hover:bg-hud/20 hover:shadow-[0_0_22px_-8px_var(--color-hud)]"
          >
            Testar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-hud/25 bg-hud/[0.06] px-3 py-1.5">
          <StatusIndicator tone="live" pulse />
          <span className="tech-label text-hud">PLATAFORMA PARA CLÍNICAS</span>
        </span>

        <h1 className="mt-6 font-display text-[38px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[58px]">
          Seu negócio.
          <br />
          Seu sistema.
          <br />
          <span className="text-hud text-glow">Sua tecnologia.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-ink-dim">
          Agenda, pacientes, financeiro e itens de consultório em um único painel — com a
          cara da sua clínica. Cada empresa tem seu ambiente isolado e seu próprio visual.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[3px] border border-hud/50 bg-hud/12 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-hud transition-all duration-200 hover:bg-hud/20 hover:shadow-[0_0_34px_-10px_var(--color-hud)] sm:w-auto"
          >
            <Sweep />
            <span className="relative">Testar 14 dias grátis</span>
            <ArrowRight size={13} className="relative transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/login"
            className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-stroke/70 px-6 py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim transition-all duration-200 hover:border-hud/40 hover:text-ink sm:w-auto"
          >
            Já tenho conta
          </Link>
        </div>

        <p className="mt-4 text-[11px] text-ink-faint">Sem cartão de crédito · Cancele quando quiser</p>
      </motion.div>

      {/* demonstração visual */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="holo-panel relative mx-auto mt-16 max-w-4xl overflow-hidden p-4 sm:p-6"
      >
        <CornerBrackets />
        <Scan />

        <div className="mb-4 flex items-center justify-between">
          <span className="tech-label">Demonstração do painel</span>
          <StatusIndicator tone="live" pulse label="Ao vivo" compact />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'FATURAMENTO', value: 'R$ 48.750', tone: 'text-hud' },
            { label: 'PACIENTES', value: '1.246', tone: 'text-electric' },
            { label: 'OCUPAÇÃO', value: '78%', tone: 'text-hud' },
            { label: 'PROCEDIMENTOS', value: '1.044', tone: 'text-success' },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
              className="rounded-[3px] border border-hud/12 bg-white/[0.02] p-3"
            >
              <div className="tech-label">{c.label}</div>
              <div className={cn('mt-1.5 font-display text-[19px] font-semibold tnum', c.tone)}>
                {c.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* silhueta de gráfico */}
        <div className="mt-3 h-28 rounded-[3px] border border-hud/12 bg-white/[0.015] p-3">
          <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="landing-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-hud)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-hud)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,62 L25,48 L50,54 L75,30 L100,40 L125,18 L150,28 L175,12 L200,26 L225,16 L250,32 L275,20 L300,26 L300,80 L0,80 Z"
              fill="url(#landing-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.6 }}
            />
            <motion.path
              d="M0,62 L25,48 L50,54 L75,30 L100,40 L125,18 L150,28 L175,12 L200,26 L225,16 L250,32 L275,20 L300,26"
              fill="none"
              stroke="var(--color-hud)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 5px var(--color-hud))' }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.9, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
        </div>
      </motion.div>
    </section>
  );
}

function Section({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-20">
      <div className="mb-11 text-center">
        <span className="tech-label text-hud">{eyebrow}</span>
        <h2 className="mt-2 font-display text-[27px] font-bold tracking-tight text-ink sm:text-[34px]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Features() {
  return (
    <Section eyebrow="FUNCIONALIDADES" title="Tudo o que a clínica precisa">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="holo-panel group relative p-5 transition-all duration-300 hover:border-hud/40 hover:shadow-[0_0_36px_-16px_var(--color-hud)]"
            >
              <CornerBrackets tone="faint" />
              <span className="grid h-10 w-10 place-items-center rounded-[3px] border border-hud/25 bg-hud/[0.06] text-hud transition-transform duration-200 group-hover:scale-105">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <h3 className="mt-4 font-display text-[14px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">{f.text}</p>
            </motion.article>
          );
        })}
      </div>
    </Section>
  );
}

function Benefits() {
  return (
    <Section eyebrow="BENEFÍCIOS" title="O que muda na sua rotina">
      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {BENEFITS.map((b, i) => (
          <motion.div
            key={b}
            initial={{ opacity: 0, x: -14 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-[3px] border border-hud/12 bg-white/[0.02] px-4 py-3.5"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-success/40 text-success">
              <Check size={12} />
            </span>
            <span className="text-[13px] text-ink-dim">{b}</span>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function Pricing() {
  const plans = usePublicPlans();

  return (
    <Section eyebrow="PLANOS" title="Preço por clínica, não por dor de cabeça" id="planos">
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan, i) => {
          // Destaque por posição, não por id: o plano do meio é o recomendado,
          // e a plataforma pode criar um quarto plano sem tocar nesta tela.
          const featured = plan.sortOrder === 2;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={cn(
                'holo-panel relative flex flex-col p-6',
                featured && 'border-hud/45 shadow-[0_0_44px_-18px_var(--color-hud)]',
              )}
            >
              <CornerBrackets tone={featured ? 'hud' : 'faint'} />

              {featured && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-hud/50 bg-void px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-hud">
                  Mais escolhido
                </span>
              )}

              <h3 className="font-display text-[15px] font-bold tracking-[0.2em] text-ink">
                {plan.name}
              </h3>
              <p className="mt-1.5 min-h-[34px] text-[12px] leading-snug text-ink-faint">
                {plan.tagline}
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-[31px] font-bold text-hud text-glow tnum">
                  {formatBRL(plan.priceCents)}
                </span>
                <span className="text-[12px] text-ink-faint">/mês</span>
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {/* `null` é ilimitado, e a linha muda de forma: "profissionais
                    ilimitados" lê melhor que "∞ profissionais". */}
                <PlanLine ok>{limitLabel(plan.limits.professionals)} profissionais</PlanLine>
                <PlanLine ok>{limitLabel(plan.limits.users)} usuários</PlanLine>
                <PlanLine ok>
                  {plan.limits.clients === null
                    ? 'Pacientes ilimitados'
                    : `${plan.limits.clients.toLocaleString('pt-BR')} pacientes`}
                </PlanLine>
                <PlanLine ok={plan.limits.financial}>Financeiro e caixa</PlanLine>
                <PlanLine ok={plan.limits.inventory}>Itens de consultório</PlanLine>
                <PlanLine ok={plan.limits.reports}>Relatórios avançados</PlanLine>
                <PlanLine ok={plan.limits.themeBuilder}>Personalização de tema</PlanLine>
                <PlanLine ok={plan.limits.prioritySupport}>Suporte prioritário</PlanLine>
              </ul>

              <Link
                to="/register"
                state={{ planId: plan.id }}
                className={cn(
                  'mt-6 rounded-[3px] border py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] transition-all duration-200',
                  featured
                    ? 'border-hud/50 bg-hud/12 text-hud hover:bg-hud/20'
                    : 'border-stroke/70 text-ink-dim hover:border-hud/40 hover:text-hud',
                )}
              >
                Começar com {plan.name}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function PlanLine({ children, ok = true }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <li className={cn('flex items-center gap-2.5 text-[12.5px]', ok ? 'text-ink-dim' : 'text-ink-faint/60')}>
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          ok ? 'border-hud/40 text-hud' : 'border-stroke/60 text-ink-faint/50',
        )}
      >
        {ok ? <Check size={9} /> : <span className="h-px w-1.5 bg-current" />}
      </span>
      {children}
    </li>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section eyebrow="DÚVIDAS" title="Perguntas frequentes">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="holo-panel overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-hud/[0.04]"
                aria-expanded={isOpen}
              >
                <span className="text-[13px] font-medium text-ink">{item.q}</span>
                <ChevronDown
                  size={15}
                  className={cn(
                    'shrink-0 text-hud transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="border-t border-hud/10 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-dim">
                  {item.a}
                </p>
              </motion.div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hud/10 px-5 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2.5">
          <Sparkles size={15} className="text-hud" />
          <span className="font-display text-[13px] font-bold tracking-[0.28em] text-ink">
            PRODENT
          </span>
        </div>

        <Link
          to="/register"
          className="flex items-center gap-2 rounded-[3px] border border-hud/50 bg-hud/12 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-hud transition-all duration-200 hover:bg-hud/20"
        >
          Criar minha clínica
          <ArrowRight size={13} />
        </Link>

        <div className="flex items-center gap-2">
          <ShieldCheck size={12} className="text-success" />
          <span className="tech-label">DADOS ISOLADOS POR EMPRESA · LGPD</span>
        </div>

        <p className="tech-label">© 2026 PRODENT · TODOS OS DIREITOS RESERVADOS</p>
      </div>
    </footer>
  );
}
