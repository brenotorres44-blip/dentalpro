import { motion } from 'motion/react';
import { ShieldAlert, X } from 'lucide-react';
import { useSession } from '@/auth/SessionProvider';

/**
 * Faixa de modo administrador.
 *
 * Mantém as cores do CONTROL CENTER cravadas em estilo inline, fora do sistema
 * de temas. Se ela herdasse o tema da empresa, o único aviso de que você está
 * operando o ambiente de outra pessoa se camuflaria justamente no ambiente que
 * deveria denunciar.
 */
export function ImpersonationBanner() {
  const { isImpersonating, company, exitCompany } = useSession();

  if (!isImpersonating || !company) return null;

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="sticky top-0 z-40 flex items-center gap-3 border-b px-4 py-2 sm:px-6"
      style={{
        background: 'linear-gradient(90deg, #1c1640 0%, #2a1f52 50%, #1c1640 100%)',
        borderColor: '#a78bfa59',
        boxShadow: '0 6px 24px -14px #a78bfa',
      }}
      role="status"
    >
      <ShieldAlert size={15} style={{ color: '#f59e0b' }} className="shrink-0 anim-pulse-dot" />

      <div className="min-w-0 flex-1">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: '#f59e0b' }}
        >
          Modo administrador
        </span>
        <span className="ml-2 truncate text-[12px]" style={{ color: '#ddd6fe' }}>
          Você está acessando o ambiente de <strong>{company.name}</strong>
        </span>
      </div>

      <button
        // Só encerra a impersonação; quem tira o admin de /app é a regra
        // declarativa no AppLayout. Navegar aqui competiria com a troca de
        // sessão no mesmo clique.
        onClick={exitCompany}
        className="flex shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-opacity duration-200 hover:opacity-80"
        style={{ borderColor: '#a78bfa66', color: '#ddd6fe', background: '#a78bfa1a' }}
      >
        <X size={11} />
        Sair do modo
      </button>
    </motion.div>
  );
}
