import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { SyncStatus } from '@/components/layout/SyncStatus';
import { BackgroundGrid } from '@/components/effects/BackgroundGrid';
import { ParticleField } from '@/components/effects/ParticleField';
import { BootOverlay } from '@/components/effects/BootOverlay';
import { SystemTicker } from '@/components/layout/SystemTicker';
import { pageTransition } from '@/animations/variants';
import { BootProvider } from '@/hooks/useBoot';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { useSession } from '@/auth/SessionProvider';
import { APP_NAV } from '@/config/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * PRODENT — ambiente operacional da clínica.
 *
 * É aqui que o tema da empresa entra em cena: o ThemeProvider recebe a
 * personalização do tenant ativo, então dois clientes abrindo a mesma rota
 * veem sistemas visualmente diferentes.
 */
export function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { company, companyTheme, updateCompanyTheme, isSuperAdmin, isImpersonating } = useSession();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const close = () => mq.matches && setMenuOpen(false);
    mq.addEventListener('change', close);
    return () => mq.removeEventListener('change', close);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Um super admin fora do modo de impersonação não pertence a empresa nenhuma:
  // sair do modo administrador o devolve ao centro de comando por esta regra,
  // e não por uma navegação imperativa presa a um clique.
  if (isSuperAdmin && !isImpersonating) return <Navigate to="/admin/companies" replace />;

  return (
    <ThemeProvider value={companyTheme} onChange={updateCompanyTheme}>
      <BootProvider>
        <div className="relative min-h-dvh">
          <BackgroundGrid />
          <ParticleField />
          <BootOverlay label={company?.name ?? 'PRODENT'} sub="Carregando o painel..." />

          <Sidebar
            items={APP_NAV}
            brandMark={(company?.name ?? 'P')[0]}
            brandName={company?.name?.toUpperCase() ?? 'PRODENT'}
            brandSub="Gestão odontológica"
            version="v2.4.1"
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
          />

          <div className="flex min-h-dvh flex-col md:pl-16 lg:pl-60">
            <ImpersonationBanner />
            <SyncStatus />
            <TopBar
              title={company?.name ?? 'PRODENT'}
              subtitle="Painel da clínica"
              onOpenMenu={() => setMenuOpen(true)}
            />

            <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  variants={pageTransition}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* Chaveado pela rota: sair de um módulo quebrado e voltar
                      remonta a fronteira em estado limpo. */}
                  <ErrorBoundary area={`app${location.pathname}`}>
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
