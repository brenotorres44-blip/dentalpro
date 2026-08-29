import type { ProfessionalStatus } from '@/data/types';
import { initials } from '@/utils/format';
import { cn } from '@/utils/cn';

const RING: Record<ProfessionalStatus, string> = {
  atendendo: 'var(--color-hud)',
  disponivel: 'var(--color-success)',
  descanso: 'var(--color-warn)',
  offline: 'var(--color-idle)',
};

/**
 * Avatar do profissional.
 *
 * Sem foto no mock: iniciais sobre um disco tingido pelo `hue` do profissional,
 * o que mantém cada pessoa reconhecível na lista. O anel externo carrega o
 * status e só gira para quem está de fato atendendo — movimento como sinal.
 */
export function HolographicAvatar({
  name,
  status,
  hue,
  size = 40,
  photoUrl,
}: {
  name: string;
  status: ProfessionalStatus;
  hue: number;
  size?: number;
  /**
   * Foto da pessoa, quando existe. O disco de iniciais continua sendo o retrato
   * de quem não enviou uma — o anel de status é o mesmo nos dois casos, porque
   * ele diz outra coisa.
   */
  photoUrl?: string | null;
}) {
  const ring = RING[status];
  const live = status === 'atendendo';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* anel de status */}
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full overflow-visible">
        <circle cx="22" cy="22" r="20" fill="none" stroke={ring} strokeOpacity="0.25" strokeWidth="1.5" />
        <circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke={ring}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={live ? '18 8' : '30 200'}
          className={cn(live && 'anim-spin-fast')}
          style={{
            transformOrigin: '22px 22px',
            filter: status === 'offline' ? 'none' : `drop-shadow(0 0 5px ${ring})`,
          }}
        />
      </svg>

      {/* foto, ou o disco de iniciais quando não há */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="absolute inset-[5px] h-[calc(100%-10px)] w-[calc(100%-10px)] rounded-full object-cover"
          style={{ opacity: status === 'offline' ? 0.45 : 1 }}
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-[5px] grid place-items-center rounded-full font-display text-[12px] font-semibold"
          style={{
            background: `linear-gradient(140deg, hsl(${hue} 70% 22%), hsl(${hue} 60% 10%))`,
            color: `hsl(${hue} 90% 78%)`,
            opacity: status === 'offline' ? 0.45 : 1,
          }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
