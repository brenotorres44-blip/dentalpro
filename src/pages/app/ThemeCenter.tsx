import { Frame, Layers, Move, Palette, RotateCcw, Sparkles, Sun, Zap } from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { TechButton } from '@/components/ui/TechButton';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ThemeSwatch } from '@/components/theme/ThemeSwatch';
import { useTheme } from '@/themes/ThemeProvider';
import { THEMES, type ThemeEffects } from '@/themes/tokens';
import { useSession } from '@/auth/SessionProvider';
import { getPlan } from '@/data/saas';
import { cn } from '@/utils/cn';

const COLOR_FIELDS = [
  { key: 'primary' as const, label: 'Cor principal', token: 'hud' as const },
  { key: 'secondary' as const, label: 'Cor secundária', token: 'electric' as const },
  { key: 'accent' as const, label: 'Cor de destaque', token: 'hud-bright' as const },
  { key: 'text' as const, label: 'Cor dos textos', token: 'ink' as const },
  { key: 'background' as const, label: 'Cor de fundo', token: 'void' as const },
];

const SLIDERS: Array<{
  key: keyof ThemeEffects;
  label: string;
  icon: typeof Zap;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}> = [
  { key: 'chrome', label: 'Ornamentos HUD', icon: Frame, min: 0, max: 1, step: 0.05, format: (v) => (v < 0.3 ? 'nenhum' : v < 0.5 ? 'discretos' : v < 0.8 ? 'moderados' : 'completos') },
  { key: 'glow', label: 'Brilho', icon: Sparkles, min: 0, max: 1.8, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'shadow', label: 'Profundidade', icon: Layers, min: 0, max: 1.4, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'particles', label: 'Partículas', icon: Zap, min: 0, max: 2, step: 0.1, format: (v) => (v === 0 ? 'desligado' : `${Math.round(v * 34)} pontos`) },
  { key: 'motion', label: 'Animações', icon: Sun, min: 0.3, max: 2, step: 0.1, format: (v) => `${v.toFixed(1).replace('.', ',')}×` },
  { key: 'density', label: 'Respiro dos painéis', icon: Move, min: 0.8, max: 1.4, step: 0.05, format: (v) => (v < 0.95 ? 'compacto' : v < 1.1 ? 'padrão' : 'amplo') },
  { key: 'radius', label: 'Cantos dos cards', icon: Palette, min: 0, max: 14, step: 1, format: (v) => `${v}px` },
];

export function ThemeCenter() {
  const { theme, override, setBaseTheme, setColor, setEffect, reset } = useTheme();
  const { company } = useSession();

  const plan = company ? getPlan(company.planId) : null;
  const canCustomize = plan?.limits.themeBuilder ?? true;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- seleção de tema ---------- */}
      <HolographicPanel
        title="Theme center"
        meta={`${THEMES.length} TEMAS`}
        icon={<Palette size={14} />}
        actions={<StatusIndicator tone="live" pulse label="PREVIEW AO VIVO" compact />}
      >
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-dim">
          A escolha vale para todo o ambiente da{' '}
          <strong className="text-ink">{company?.name ?? 'sua empresa'}</strong> e não afeta
          nenhuma outra empresa da plataforma. A mudança é aplicada imediatamente — sem recarregar
          a página.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <ThemeSwatch
              key={t.id}
              theme={t}
              selected={override.baseThemeId === t.id}
              onSelect={() => setBaseTheme(t.id)}
            />
          ))}
        </div>
      </HolographicPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ---------- construtor ---------- */}
        <HolographicPanel
          title="Theme builder"
          meta={canCustomize ? 'PERSONALIZAÇÃO' : 'INDISPONÍVEL NO PLANO'}
          icon={<Sparkles size={14} />}
          delay={70}
          actions={
            <TechButton icon={<RotateCcw size={12} />} onClick={reset} disabled={!canCustomize}>
              Restaurar
            </TechButton>
          }
        >
          {!canCustomize && (
            <div className="mb-4 rounded-[3px] border border-warn/25 bg-warn/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-dim">
              A personalização de cores está disponível a partir do plano{' '}
              <strong className="text-warn">PRO</strong>. Os sete temas prontos continuam
              disponíveis no seu plano atual.
            </div>
          )}

          <fieldset disabled={!canCustomize} className={cn(!canCustomize && 'pointer-events-none opacity-45')}>
            {/* cores */}
            <div className="flex flex-col gap-3">
              {COLOR_FIELDS.map((f) => {
                const current = override[f.key] ?? theme.tokens[f.token];
                return (
                  <label key={f.key} className="flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-[12.5px] text-ink-dim">{f.label}</span>
                      <span className="block font-mono text-[10px] uppercase text-ink-faint">
                        {current}
                      </span>
                    </span>

                    <span className="relative flex shrink-0 items-center gap-2">
                      <input
                        type="color"
                        value={current}
                        onChange={(e) => setColor(f.key, e.target.value)}
                        className="h-8 w-14 cursor-pointer rounded-[3px] border border-stroke/70 bg-transparent p-0.5"
                        aria-label={f.label}
                      />
                    </span>
                  </label>
                );
              })}
            </div>

            {/* intensidades */}
            <div className="mt-5 flex flex-col gap-4 border-t border-hud/10 pt-5">
              {SLIDERS.map((s) => {
                const Icon = s.icon;
                const value = theme.effects[s.key];
                return (
                  <label key={s.key} className="flex flex-col gap-2">
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Icon size={12} className="text-hud/70" />
                        <span className="text-[12.5px] text-ink-dim">{s.label}</span>
                      </span>
                      <span className="font-mono text-[11px] text-hud tnum">{s.format(value)}</span>
                    </span>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={value}
                      onChange={(e) => setEffect(s.key, Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.07] accent-hud"
                      aria-label={s.label}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        </HolographicPanel>

        {/* ---------- preview ---------- */}
        <HolographicPanel
          title="Theme preview"
          meta="COMPONENTES REAIS"
          icon={<Sun size={14} />}
          delay={130}
          scan
        >
          {/* Os componentes abaixo são os mesmos do sistema, não uma imitação:
              se o preview parece certo, o sistema está certo. */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'FATURAMENTO', value: 'R$ 48.750,00', cls: 'text-hud' },
                { label: 'OCUPAÇÃO', value: '78%', cls: 'text-electric' },
              ].map((c) => (
                <div key={c.label} className="holo-panel p-3">
                  <span className="tech-label">{c.label}</span>
                  <div className={cn('mt-1.5 font-display text-[19px] font-semibold text-glow tnum', c.cls)}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="holo-panel p-3">
              <span className="tech-label">ESTADOS</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <StatusIndicator tone="ok" label="CONCLUÍDO" />
                <StatusIndicator tone="live" pulse label="EM ANDAMENTO" />
                <StatusIndicator tone="warn" label="ATENÇÃO" />
                <StatusIndicator tone="critical" pulse label="CRÍTICO" />
              </div>
            </div>

            <div className="holo-panel p-3">
              <span className="tech-label">CONTROLES</span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <TechButton variant="primary">Confirmar</TechButton>
                <TechButton>Cancelar</TechButton>
                <TechButton variant="critical">Excluir</TechButton>
              </div>
            </div>

            <div className="holo-panel flex items-center gap-3 p-3">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center">
                <span className="absolute inset-0 rounded-full border border-hud/40" />
                <span
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-hud anim-spin-fast"
                  style={{ filter: 'drop-shadow(0 0 5px var(--color-hud))' }}
                />
                <span className="font-mono text-[10px] text-hud tnum">78</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-ink">Núcleo operacional</div>
                <div className="text-[11px] text-ink-faint">
                  Movimento, brilho e partículas seguem os controles ao lado
                </div>
              </div>
            </div>
          </div>
        </HolographicPanel>
      </div>
    </div>
  );
}
