import { cn } from '@/utils/cn';

/**
 * Placeholder de carregamento.
 *
 * O brilho que atravessa é um `transform` sobre um filho absoluto — animar
 * `background-position` repintaria o elemento inteiro a cada frame. Sob
 * `prefers-reduced-motion` sobra o retângulo estático, que continua
 * comunicando "isto ainda vai chegar".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[3px] bg-white/[0.04]',
        className,
      )}
      aria-hidden
    >
      <div className="anim-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-hud/[0.09] to-transparent" />
    </div>
  );
}

/** Esqueleto de um painel inteiro — usado nas rotas carregadas sob demanda. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="holo-panel flex flex-col gap-4 p-4" role="status" aria-label="Carregando">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <span className="sr-only">Carregando conteúdo</span>
    </div>
  );
}

/** Esqueleto de página: régua de indicadores + painel. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="holo-panel flex flex-col gap-3 p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
      <PanelSkeleton rows={5} />
    </div>
  );
}
