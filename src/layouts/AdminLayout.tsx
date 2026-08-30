import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Building2, TrendingDown, Users } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BackgroundGrid } from '@/components/effects/BackgroundGrid';
import { ParticleField } from '@/components/effects/ParticleField';
import { BootOverlay } from '@/components/effects/BootOverlay';
import { SystemTicker } from '@/components/layout/SystemTicker';
import { pageTransition } from '@/animations/variants';
import { BootProvider, BootStage, useBoot } from '@/hooks/useBoot';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { resolveAdminBase, useAdminTheme } from '@/themes/adminTheme';
import { useSession } from '@/auth/SessionProvider';
import { ADMIN_NAV } from '@/config/navigation';
import { loadPlatform, usePlatform } from '@/services/platformStore';
import { PlatformSyncStatus } from '@/components/layout/SyncStatus';
import { formatBRLCompact, formatInt } from '@/utils/format';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Faixa de comando — exclusiva do ambiente administrativo.
 *
 * É o principal marcador estrutural entre os dois painéis: o PRODENT abre com
 * respiro e cards grandes; o CONTROL CENTER abre com uma régua de números da
 * plataforma, sempre visível, em qualquer página.
 */
function CommandStrip() {
  const { stage } = useBoot();
  const { metrics, loaded } = usePlatform();

  // Antes de a carga voltar, a régua mostra traço em vez de zero: zero empresas
  // é uma afirmação, e nesse instante ela seria falsa.
  const num = (value: number, format: (n: number) => string) => (loaded ? format(value) : '—');

  const cells = [
    { icon: Building2, label: 'EMPRESAS', value: num(metrics.activeCompanies, formatInt) },
    { icon: Users, label: 'USUÁRIOS', value: num(metrics.users, formatInt) },
    { icon: Activity, label: 'MRR', value: num(metrics.mrrCents, formatBRLCompact) },
    {
      icon: TrendingDown,
      label: 'CHURN',
      value: num(metrics.churnPct, (n) => `${n.toFixed(1).replace('.', ',')}%`),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: stage >= BootStage.INDICATORS ? 1 : 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-16 z-20 flex items-stretch divide-x divide-hud/10 border-b border-hud/12 bg-deep/70 backdrop-blur-xl"
    >
      {cells.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={[
              'flex flex-1 items-center gap-2.5 px-4',
              i > 1 ? 'hidden sm:flex' : '',
              i > 2 ? 'hidden lg:flex' : '',
            ].join(' ')}
            style={{ paddingBlock: 'calc(0.5rem * var(--density))' }}
          >
            <Icon size={13} className="shrink-0 text-hud/60" />
            <span className="tech-label shrink-0">{c.label}</span>
            <span className="ml-auto font-mono text-[12px] font-medium text-ink tnum">{c.value}</span>
          </div>
        );
      })}
    </motion.div>
  );
}

/**
 * SAAS CONTROL CENTER — ambiente do administrador da plataforma.
 *
 * `locked` no ThemeProvider: nenhuma personalização de **cliente** alcança este
 * painel. A base é `CONTROL_CENTER_THEME` e continua fora de `THEMES`, então o
 * centro de comando não tem como virar o tema de uma clínica.
 *
 * O que passa é o ajuste do próprio administrador, feito em `/admin/themes` e
 * guardado por navegador. Ele repinta cores e efeitos sobre a mesma base — o
 * sinal de "em que ambiente estou" continua de pé, e durante a impersonação
 * quem sinaliza é o `ImpersonationBanner`, que usa hex inline exatamente para
 * não se camuflar em tema nenhum.
 */
export function AdminLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const adminTheme = useAdminTheme();
  const { isImpersonating, exitCompany } = useSession();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  /*
   * Estar no centro de comando encerra a visita ao cliente.
   *
   * É a regra simétrica da que o `AppLayout` já tinha: lá, um super admin sem
   * impersonação é devolvido para cá; aqui, chegar significa que a visita
   * acabou. Os dois lugares são mutuamente exclusivos — não dá para estar
   * dentro da clínica de alguém e no painel da plataforma ao mesmo tempo.
   *
   * Sem isto, o menu chegava aleijado. `capabilitiesFor()` reduz o super admin
   * a `owner` + `platform.view` enquanto ele visita um cliente — de propósito,
   * para não carregar poder de plataforma lá dentro. Só que capacidade é da
   * sessão, não da rota: voltando para `/admin` pelo botão do navegador, por
   * URL ou por favorito, ele continuava reduzido, e o menu perdia os seis itens
   * que pedem `platform.*`. Sobravam Visão geral, Temas e Plataforma — os três
   * únicos sem exigência declarada.
   *
   * O `platform.view` que sobrevive à impersonação existe justamente para
   * permitir esta volta; ele abre a porta, e esta regra desfaz o resto.
   *
   * Antes de a impersonação persistir no `localStorage`, um F5 limpava o estado
   * por acidente e escondia o defeito. Persistir a visita foi o certo — ela
   * deixou de morrer no meio do trabalho — e trouxe este caso à tona.
   */
  useEffect(() => {
    if (isImpersonating) exitCompany();
  }, [isImpersonating, exitCompany]);

  // Uma carga para as nove telas. `loadPlatform` é idempotente: navegar entre
  // elas não redispara nada.
  useEffect(() => {
    void loadPlatform();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    // `baseTheme` resolvido aqui porque a base do painel pode ser a identidade
    // da plataforma, que não está em `THEMES` e não sai de `getTheme()`.
    <ThemeProvider locked value={adminTheme} baseTheme={resolveAdminBase(adminTheme)}>
      <BootProvider>
        <div className="relative min-h-dvh">
          <BackgroundGrid />
          <ParticleField />
          <BootOverlay label="Central da Plataforma" sub="Carregando..." />

          <Sidebar
            items={ADMIN_NAV}
            brandMark="◆"
            brandName="CONTROL"
            brandSub="CENTRO DE COMANDO"
            version="core 1.0"
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
          />

          <div className="flex min-h-dvh flex-col md:pl-16 lg:pl-60">
            <TopBar
              title="SAAS CONTROL CENTER"
              subtitle="ADMINISTRAÇÃO DA PLATAFORMA"
              onOpenMenu={() => setMenuOpen(true)}
            />
            <PlatformSyncStatus />
            <CommandStrip />

            <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  variants={pageTransition}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <ErrorBoundary area={`admin${location.pathname}`}>
                    <Outlet />
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </main>

            <SystemTicker />
          </div>
        </div>
      </BootProvider>
    </ThemeProvider>
  );
}
