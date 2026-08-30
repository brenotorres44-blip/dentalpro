import { motion } from 'motion/react';
import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ModuleSpec } from '@/config/modules';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { TechButton } from '@/components/ui/TechButton';

/**
 * Módulo ainda não implementado.
 *
 * Declara honestamente o estado ("em calibração") e o escopo previsto, em vez
 * de fingir uma tela vazia. O usuário sabe que a navegação funciona e que o
 * módulo existe no plano — só ainda não foi construído.
 */
export function ModulePage({
  spec,
  backTo = '/app/dashboard',
  backLabel = 'Dashboard',
}: {
  spec: ModuleSpec;
  /** `/admin/*` usa o próprio dashboard do centro de comando, não o da clínica. */
  backTo?: string;
  backLabel?: string;
}) {
  const Icon = spec.icon;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <HolographicPanel
        title={spec.title}
        meta={`MÓDULO ${spec.code}`}
        icon={<Icon size={14} />}
        scan
        actions={<StatusIndicator tone="idle" label="NÃO IMPLEMENTADO" compact />}
        bodyClassName="p-6 sm:p-8"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative grid h-16 w-16 shrink-0 place-items-center rounded-[9px] border border-hud/30 bg-hud/[0.06] text-hud"
            >
              <span
                className="absolute inset-0 rounded-[9px] border border-hud/20 anim-breathe"
                aria-hidden
              />
              <Icon size={26} strokeWidth={1.4} />
            </motion.div>

            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-wide text-ink">
                {spec.title}
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-dim">
                {spec.description}
              </p>
            </div>
          </div>

          {/* Sem barra de progresso: ela marcava 12% fixo e não media nada —
              sugeria trabalho em curso onde não há nenhum. */}
          <div className="flex items-center justify-between border-t border-hud/10 pt-4">
            <span className="tech-label">ESCOPO PREVISTO</span>
            <span className="font-mono text-[10px] text-hud tnum">
              {spec.capabilities.length} REQUISITOS
            </span>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {spec.capabilities.map((c, i) => (
              <motion.li
                key={c}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                className="flex items-start gap-2.5 rounded-[8px] border border-hud/10 bg-white/[0.015] px-3 py-2.5 transition-colors duration-200 hover:border-hud/30"
              >
                <Check size={13} className="mt-0.5 shrink-0 text-hud/70" />
                <span className="text-[12px] leading-snug text-ink-dim">{c}</span>
              </motion.li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-hud/10 pt-4">
            <span className="tech-label">
              ESTA TELA É UM ESBOÇO · NENHUMA FUNCIONALIDADE ATIVA
            </span>
            <Link to={backTo}>
              <TechButton icon={<ArrowLeft size={12} />}>{backLabel}</TechButton>
            </Link>
          </div>
        </div>
      </HolographicPanel>
    </div>
  );
}
