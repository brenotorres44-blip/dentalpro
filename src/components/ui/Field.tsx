import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { formatBRL } from '@/utils/format';

/** Campo de formulário do sistema — usado em login, cadastro e configurações. */
export function Field({
  label,
  icon,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className={cn('group flex flex-col gap-1.5', className)}>
      <span className="tech-label">{label}</span>
      <span className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 text-ink-faint transition-colors duration-200 group-focus-within:text-hud">
            {icon}
          </span>
        )}
        <input
          {...props}
          aria-invalid={Boolean(error)}
          className={cn(
            'w-full rounded-[8px] border bg-void/50 py-2.5 pr-3 text-[13px] text-ink',
            'placeholder:text-ink-faint/60 outline-none transition-all duration-200',
            'focus:bg-hud/[0.04]',
            icon ? 'pl-9' : 'pl-3',
            error ? 'border-critical/60 focus:border-critical' : 'border-stroke/70 focus:border-hud/60',
          )}
        />
      </span>
      {/* Erro tem prioridade sobre a dica: nunca mostramos os dois juntos. */}
      {error ? (
        <span className="text-[11px] text-critical">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className={cn('group flex flex-col gap-1.5', className)}>
      <span className="tech-label">{label}</span>
      <select
        {...props}
        className={cn(
          'w-full rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2.5 text-[13px] text-ink',
          'outline-none transition-all duration-200 focus:border-hud/60 focus:bg-hud/[0.04]',
        )}
      >
        {children}
      </select>
    </label>
  );
}

export function TextareaField({
  label,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('group flex flex-col gap-1.5', className)}>
      <span className="tech-label">{label}</span>
      <textarea
        {...props}
        className={cn(
          'w-full resize-y rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2.5 text-[13px] leading-relaxed text-ink',
          'placeholder:text-ink-faint/60 outline-none transition-all duration-200',
          'focus:border-hud/60 focus:bg-hud/[0.04]',
        )}
      />
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

/**
 * Campo de dinheiro.
 *
 * O estado é sempre centavos inteiros — o campo nunca conhece float. O usuário
 * digita só dígitos e a vírgula anda sozinha, que é como todo caixa brasileiro
 * espera: teclar 5500 resulta em R$ 55,00.
 */
export function MoneyField({
  label,
  value,
  onValueChange,
  hint,
  error,
  className,
  disabled,
}: {
  label: string;
  value: number;
  onValueChange: (cents: number) => void;
  hint?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('group flex flex-col gap-1.5', className)}>
      <span className="tech-label">{label}</span>
      <input
        inputMode="numeric"
        disabled={disabled}
        value={formatBRL(value)}
        aria-invalid={Boolean(error)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          // 9 dígitos = R$ 9.999.999,99. Acima disso é erro de digitação, não
          // um preço de clínica — travar aqui evita um zero acidental virar
          // um lançamento absurdo no caixa.
          onValueChange(Number(digits.slice(0, 9) || '0'));
        }}
        className={cn(
          'w-full rounded-[8px] border bg-void/50 px-3 py-2.5 text-right font-mono text-[13px] text-ink tnum',
          'outline-none transition-all duration-200 focus:bg-hud/[0.04]',
          'disabled:opacity-50',
          error ? 'border-critical/60 focus:border-critical' : 'border-stroke/70 focus:border-hud/60',
        )}
      />
      {error ? (
        <span className="text-[11px] text-critical">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * Interruptor.
 *
 * O estado é dito em texto ao lado do trilho, não só pela posição do botão:
 * quem não distingue a cor nem a posição continua sabendo se está ligado.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-center justify-between gap-4 rounded-[8px] border px-3 py-2.5 text-left',
        'transition-all duration-200 disabled:opacity-40',
        checked ? 'border-hud/35 bg-hud/[0.06]' : 'border-stroke/60 bg-white/[0.015] hover:border-hud/25',
      )}
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{description}</span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className={cn('text-[11px] font-medium', checked ? 'text-hud' : 'text-ink-faint')}>
          {checked ? 'Ativado' : 'Desativado'}
        </span>
        <span
          className={cn(
            'relative h-4 w-8 rounded-full border transition-colors duration-200',
            checked ? 'border-hud/60 bg-hud/25' : 'border-stroke/70 bg-void/60',
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full transition-transform duration-200',
              checked
                ? 'translate-x-[18px] bg-hud'
                : 'translate-x-[3px] bg-ink-faint',
            )}
          />
        </span>
      </span>
    </button>
  );
}

const CALLOUT_TONE = {
  info: 'border-hud/30 bg-hud/[0.06] text-hud',
  warn: 'border-warn/35 bg-warn/[0.07] text-warn',
  critical: 'border-critical/40 bg-critical/[0.08] text-critical',
  success: 'border-success/35 bg-success/[0.07] text-success',
} as const;

/** Mensagem curta dentro de um formulário — erro de validação, aviso, confirmação. */
export function Callout({
  tone = 'info',
  icon,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'critical' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-[11.5px] leading-relaxed',
        CALLOUT_TONE[tone],
      )}
    >
      {icon && <span className="mt-px shrink-0">{icon}</span>}
      <span>{children}</span>
    </p>
  );
}
