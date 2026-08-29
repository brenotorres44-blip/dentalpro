import { Outlet } from 'react-router-dom';
import { BackgroundGrid } from '@/components/effects/BackgroundGrid';
import { ParticleField } from '@/components/effects/ParticleField';
import { BootProvider } from '@/hooks/useBoot';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { useSession } from '@/auth/SessionProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Casca mínima com o tema da empresa, sem navegação.
 *
 * Usada pelo onboarding: o usuário já pertence a um tenant e deve ver as cores
 * dele, mas ainda não faz sentido oferecer o menu de um sistema que ele não
 * terminou de configurar.
 */
export function TenantShell() {
  const { companyTheme, updateCompanyTheme } = useSession();

  return (
    <ThemeProvider value={companyTheme} onChange={updateCompanyTheme}>
      <BootProvider>
        <div className="relative min-h-dvh">
          <BackgroundGrid />
          <ParticleField />
          <ErrorBoundary area="onboarding">
            <Outlet />
          </ErrorBoundary>
        </div>
      </BootProvider>
    </ThemeProvider>
  );
}
