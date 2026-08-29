import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import type { Capability } from '@/config/permissions';

/** Rota onde a conta autenticada sem clínica cria a sua. */
export const CREATE_COMPANY_ROUTE = '/criar-clinica';

/** Destino inicial de cada papel após autenticar. */
export function homeFor(role: string | undefined, needsCompany?: boolean) {
  // Sem clínica não há painel para mostrar: qualquer tela do `/app` abriria
  // vazia, e o usuário não teria como saber por quê.
  if (needsCompany) return CREATE_COMPANY_ROUTE;
  return role === 'super_admin' ? '/admin/dashboard' : '/app/dashboard';
}

function Booting() {
  return (
    <div className="grid min-h-dvh place-items-center bg-void">
      <span className="tech-label anim-breathe">CARREGANDO SESSÃO</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  const location = useLocation();

  if (!ready) return <Booting />;
  if (!session) {
    // Guarda a rota pretendida para devolver o usuário ao lugar certo depois.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (session.needsCompany && location.pathname !== CREATE_COMPANY_ROUTE) {
    return <Navigate to={CREATE_COMPANY_ROUTE} replace />;
  }
  return <>{children}</>;
}

export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const { session, ready, can } = useSession();

  if (!ready) return <Booting />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.needsCompany) return <Navigate to={CREATE_COMPANY_ROUTE} replace />;
  // Sem a capacidade, o usuário vai para a própria casa — não para uma tela de
  // erro. Anunciar a existência de uma área proibida é informação desnecessária.
  if (!can(capability)) return <Navigate to={homeFor(session.user.role)} replace />;

  return <>{children}</>;
}

/** Redireciona quem já está autenticado para fora das telas públicas de login. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  if (!ready) return <Booting />;
  if (session) return <Navigate to={homeFor(session.user.role, session.needsCompany)} replace />;
  return <>{children}</>;
}
