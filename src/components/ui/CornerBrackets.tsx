import { cn } from '@/utils/cn';
import { useTheme } from '@/themes/ThemeProvider';

/**
 * Cantoneiras técnicas do painel. Puro CSS (bordas), sem SVG e sem custo de
 * pintura — é o que dá a leitura de "moldura de instrumento" a um retângulo.
 *
 * Responde a `chrome`: em temas sóbrios elas somem por completo, e o painel
 * passa a se apoiar só em sombra e borda. O componente continua no lugar —
 * basta trocar de tema para trazê-las de volta.
 */
export function CornerBrackets({
  className,
  size = 10,
  tone = 'hud',
}: {
  className?: string;
  size?: number;
  tone?: 'hud' | 'critical' | 'faint';
}) {
  const { theme } = useTheme();
  const chrome = theme.effects.chrome;

  // Abaixo deste ponto a cantoneira já não é percebida como moldura, só como
  // sujeira na borda. Melhor não desenhá-la.
  if (chrome < 0.3) return null;

  const color =
    tone === 'critical'
      ? 'border-critical/70'
      : tone === 'faint'
        ? 'border-hud/25'
        : 'border-hud/55';

  const base = 'pointer-events-none absolute transition-colors duration-200';
  const style = { width: size, height: size };

  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{ opacity: Math.min(chrome, 1) }}
      aria-hidden
    >
      <span className={cn(base, color, 'left-0 top-0 border-l border-t')} style={style} />
      <span className={cn(base, color, 'right-0 top-0 border-r border-t')} style={style} />
      <span className={cn(base, color, 'bottom-0 left-0 border-b border-l')} style={style} />
      <span className={cn(base, color, 'bottom-0 right-0 border-b border-r')} style={style} />
    </div>
  );
}
