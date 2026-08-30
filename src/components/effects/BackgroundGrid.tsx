/**
 * Fundo da aplicação — só a cor do tema, sem malha nem linha de circuito.
 */
export function BackgroundGrid() {
  return <div className="pointer-events-none fixed inset-0 -z-10 bg-void" aria-hidden />;
}
