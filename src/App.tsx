import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { SessionProvider } from '@/auth/SessionProvider';
import { RedirectIfAuthenticated, RequireAuth, RequireCapability } from '@/auth/guards';

import { SiteLayout } from '@/layouts/SiteLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { TenantShell } from '@/layouts/TenantShell';

import { Landing } from '@/pages/site/Landing';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { Onboarding } from '@/pages/onboarding/Onboarding';
import { CreateCompany } from '@/pages/onboarding/CreateCompany';

import { Dashboard } from '@/pages/app/Dashboard';
import { ThemeCenter } from '@/pages/app/ThemeCenter';
import { ModulePage } from '@/pages/app/ModulePage';
import { MODULES, ADMIN_MODULES } from '@/config/modules';
import { PageSkeleton } from '@/components/ui/Skeleton';

// Os módulos operacionais entram sob demanda pelo mesmo motivo do centro de
// comando: quem abre o dashboard e fecha não deve pagar pelo peso da grade da
// agenda nem do financeiro.
const Appointments = lazy(() => import('@/pages/app/Appointments').then((m) => ({ default: m.Appointments })));
const Clients = lazy(() => import('@/pages/app/Clients').then((m) => ({ default: m.Clients })));
const PatientDetail = lazy(() => import('@/pages/app/PatientDetail').then((m) => ({ default: m.PatientDetail })));
const Services = lazy(() => import('@/pages/app/Services').then((m) => ({ default: m.Services })));
const Professionals = lazy(() => import('@/pages/app/Professionals').then((m) => ({ default: m.Professionals })));
const Financial = lazy(() => import('@/pages/app/Financial').then((m) => ({ default: m.Financial })));
const Products = lazy(() => import('@/pages/app/Products').then((m) => ({ default: m.Products })));
const Settings = lazy(() => import('@/pages/app/Settings').then((m) => ({ default: m.Settings })));

// O centro de comando é um ambiente inteiro que a maioria dos usuários nunca
// abre — carregá-lo sob demanda tira todo o seu peso do login do dono da clínica.
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const Companies = lazy(() => import('@/pages/admin/Companies').then((m) => ({ default: m.Companies })));
const Plans = lazy(() => import('@/pages/admin/Plans').then((m) => ({ default: m.Plans })));
const PlatformSettings = lazy(() => import('@/pages/admin/PlatformSettings').then((m) => ({ default: m.PlatformSettings })));

/** Fallback das rotas sob demanda — a forma da página antes do conteúdo chegar. */
const Loading = () => <PageSkeleton />;

/**
 * GitHub Pages não tem servidor para reescrever `/app/dashboard` de volta a
 * `index.html` — um F5 fora da raiz vira 404. `HashRouter` evita o problema
 * porque a rota inteira (`/#/app/dashboard`) nunca chega ao servidor. Em
 * qualquer outro host (Vercel, Netlify, o próprio Supabase por trás de um
 * proxy) o build normal usa `BrowserRouter`, com URL limpa de verdade.
 */
const Router = import.meta.env.VITE_GITHUB_PAGES ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          {/* ---------- AMBIENTE PÚBLICO ---------- */}
          <Route element={<SiteLayout />}>
            <Route index element={<Landing />} />
            <Route
              path="/login"
              element={
                <RedirectIfAuthenticated>
                  <Login />
                </RedirectIfAuthenticated>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthenticated>
                  <Register />
                </RedirectIfAuthenticated>
              }
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Sem `RedirectIfAuthenticated`: o link do e-mail cria uma sessão
                de recuperação antes de esta tela montar, e o guard mandaria
                para `/app` justamente quem veio trocar a senha. */}
            <Route path="/redefinir-senha" element={<ResetPassword />} />
          </Route>

          {/* ---------- ONBOARDING (autenticado, sem navegação) ---------- */}
          <Route
            element={
              <RequireAuth>
                <TenantShell />
              </RequireAuth>
            }
          >
            <Route path="/onboarding" element={<Onboarding />} />
            {/* Conta autenticada que ainda não tem clínica. `RequireAuth`
                traz para cá qualquer sessão nesse estado. */}
            <Route path="/criar-clinica" element={<CreateCompany />} />
          </Route>

          {/* ---------- PRODENT ---------- */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <RequireCapability capability="company.dashboard.view">
                  <Dashboard />
                </RequireCapability>
              }
            />
            <Route
              path="theme"
              element={
                <RequireCapability capability="company.theme.manage">
                  <ThemeCenter />
                </RequireCapability>
              }
            />

            {/* ---------- módulos operacionais ---------- */}
            {(
              [
                ['appointments', 'company.appointments.view', Appointments],
                ['clients', 'company.clients.view', Clients],
                ['services', 'company.services.manage', Services],
                ['professionals', 'company.professionals.manage', Professionals],
                ['financial', 'company.financial.view', Financial],
                ['products', 'company.products.manage', Products],
                ['settings', 'company.settings.manage', Settings],
              ] as const
            ).map(([path, capability, Component]) => (
              <Route
                key={path}
                path={path}
                element={
                  <RequireCapability capability={capability}>
                    <Suspense fallback={<Loading />}>
                      <Component />
                    </Suspense>
                  </RequireCapability>
                }
              />
            ))}

            <Route
              path="clients/:id"
              element={
                <RequireCapability capability="company.clients.view">
                  <Suspense fallback={<Loading />}>
                    <PatientDetail />
                  </Suspense>
                </RequireCapability>
              }
            />

            {/* Relatórios e assinatura: navegação pronta, tela ainda não —
                ver `config/modules.ts`. */}
            {MODULES.map((spec) => (
              <Route
                key={spec.path}
                path={spec.path.replace('/app/', '')}
                element={
                  spec.capability ? (
                    <RequireCapability capability={spec.capability}>
                      <ModulePage spec={spec} />
                    </RequireCapability>
                  ) : (
                    <ModulePage spec={spec} />
                  )
                }
              />
            ))}
          </Route>

          {/* ---------- SAAS CONTROL CENTER ---------- */}
          <Route
            path="/admin"
            element={
              <RequireCapability capability="platform.view">
                <AdminLayout />
              </RequireCapability>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<Loading />}><AdminDashboard /></Suspense>} />
            <Route path="companies" element={<Suspense fallback={<Loading />}><Companies /></Suspense>} />
            <Route path="plans" element={<Suspense fallback={<Loading />}><Plans /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<Loading />}><PlatformSettings /></Suspense>} />

            {/* Usuários, assinaturas, suporte, logs e temas: navegação pronta,
                tela ainda não — ver `config/modules.ts`. */}
            {ADMIN_MODULES.map((spec) => (
              <Route
                key={spec.path}
                path={spec.path.replace('/admin/', '')}
                element={<ModulePage spec={spec} backTo="/admin/dashboard" backLabel="Visão geral" />}
              />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}
