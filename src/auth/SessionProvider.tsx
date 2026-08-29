import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getCompany,
  getCompanyTheme,
  loadSession,
  login as loginService,
  logout as logoutService,
  impersonate as impersonateService,
  saveCompanyTheme,
  stopImpersonating as stopImpersonatingService,
  type Session,
} from '@/services/authService';
import { capabilitiesFor, type Capability } from '@/config/permissions';
import { clearCompany, hydrateCompany } from '@/services/store';
import type { Company } from '@/data/saas';
import { FALLBACK_OVERRIDE, type ThemeOverride } from '@/themes/tokens';

interface SessionContextValue {
  session: Session | null;
  company: Company | null;
  companyTheme: ThemeOverride;
  capabilities: Capability[];
  isImpersonating: boolean;
  isSuperAdmin: boolean;
  ready: boolean;
  can: (capability: Capability) => boolean;
  login: (email: string, password: string) => Promise<Session>;
  /** Relê a sessão de onde ela estiver gravada. Usado depois do cadastro. */
  refresh: () => Promise<Session | null>;
  logout: () => void;
  enterCompany: (companyId: string) => void;
  exitCompany: () => void;
  updateCompanyTheme: (theme: ThemeOverride) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // `ready` evita o piscar de "não autenticado" antes de ler o storage — sem
  // ele, um F5 dentro do painel joga o usuário para o login por um frame.
  const [ready, setReady] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    // Restaurar a sessão virou uma ida ao servidor. O `alive` evita escrever
    // estado num provider já desmontado — acontece no StrictMode, que monta,
    // desmonta e remonta antes da primeira resposta chegar.
    loadSession()
      .then((restored) => {
        if (alive) setSession(restored);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const company = useMemo(() => getCompany(session?.companyId ?? null), [session]);

  // Carrega os dados da empresa ativa. Vale também para a troca de ambiente do
  // administrador: sair de uma clínica e entrar em outra tem que trocar o
  // conteúdo, não misturar.
  useEffect(() => {
    const id = session?.companyId;
    if (id) void hydrateCompany(id);
    else clearCompany();
  }, [session?.companyId]);

  const companyTheme = useMemo<ThemeOverride>(
    () => (company ? getCompanyTheme(company.id) : FALLBACK_OVERRIDE),
    // themeVersion força a releitura depois de salvar no Theme Builder.
    [company, themeVersion],
  );

  const isImpersonating = Boolean(session?.impersonatingCompanyId);
  const isSuperAdmin = session?.user.role === 'super_admin';

  const capabilities = useMemo(
    () => (session ? capabilitiesFor(session.user.role, isImpersonating) : []),
    [session, isImpersonating],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      company,
      companyTheme,
      capabilities,
      isImpersonating,
      isSuperAdmin: Boolean(isSuperAdmin),
      ready,
      can: (capability) => capabilities.includes(capability),
      login: async (email, password) => {
        const next = await loginService(email, password);
        setSession(next);
        return next;
      },
      // O cadastro já deixou a sessão gravada — no Supabase pelo `signUp`, no
      // mock pela sessão de demonstração. Reler é mais simples e mais correto
      // que reautenticar com a senha que acabou de ser usada.
      refresh: async () => {
        const restored = await loadSession();
        setSession(restored);
        return restored;
      },
      logout: () => {
        logoutService();
        setSession(null);
      },
      enterCompany: (companyId) => {
        setSession((current) => (current ? impersonateService(current, companyId) : current));
      },
      exitCompany: () => {
        setSession((current) => (current ? stopImpersonatingService(current) : current));
      },
      updateCompanyTheme: (theme) => {
        if (!company) return;
        saveCompanyTheme(company.id, theme);
        setThemeVersion((v) => v + 1);
      },
    }),
    [session, company, companyTheme, capabilities, isImpersonating, isSuperAdmin, ready],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  return ctx;
}
