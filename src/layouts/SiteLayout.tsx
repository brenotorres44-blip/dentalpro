import { Outlet } from 'react-router-dom';
import { BackgroundGrid } from '@/components/effects/BackgroundGrid';
import { ParticleField } from '@/components/effects/ParticleField';
import { BootProvider } from '@/hooks/useBoot';
import { ThemeProvider } from '@/themes/ThemeProvider';
import { FALLBACK_OVERRIDE } from '@/themes/tokens';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Ambiente público: landing, login, cadastro e recuperação de senha.
 *
 * Usa o tema padrão da plataforma — ainda não existe empresa resolvida aqui,
 * então não há personalização a aplicar.
 */
export function SiteLayout() {
  return (
    <ThemeProvider value={FALLBACK_OVERRIDE}>
      <BootProvider>
        <div className="relative min-h-dvh">
          <BackgroundGrid />
          <ParticleField />
          <ErrorBoundary area="site">
            <Outlet />
          </ErrorBoundary>
        </div>
      </BootProvider>
    </ThemeProvider>
  );
}
