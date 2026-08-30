import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Identifica a região que falhou nos relatórios. */
  area: string;
}

interface State {
  error: Error | null;
}

/**
 * Contenção de falha de renderização.
 *
 * Precisa ser classe: `componentDidCatch` não tem equivalente em hooks.
 *
 * Envolve o conteúdo da rota, e não a aplicação inteira, de propósito — se o
 * painel financeiro quebrar, a barra lateral e o topo continuam de pé e o
 * usuário navega para outro módulo em vez de encarar uma tela branca.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Ponto de entrada para telemetria quando houver backend.
    console.error(`[${this.props.area}] falha de renderização`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="holo-panel holo-panel--critical mx-auto flex max-w-lg flex-col items-center gap-4 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-critical/50 text-critical">
          <AlertTriangle size={22} />
        </span>

        <div>
          <h2 className="font-display text-[14px] font-semibold text-ink">
            ESTE MÓDULO FALHOU
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
            O restante do sistema continua funcionando — use o menu para ir a outro módulo,
            ou tente carregar este novamente.
          </p>
        </div>

        {/* A mensagem técnica fica recolhida: útil para reportar, ruído para o resto. */}
        <details className="w-full text-left">
          <summary className="tech-label cursor-pointer transition-colors hover:text-hud">
            DETALHES TÉCNICOS
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-[8px] border border-critical/20 bg-void/60 p-3 font-mono text-[10.5px] leading-relaxed text-critical/90">
            {error.message}
          </pre>
        </details>

        <button
          onClick={() => this.setState({ error: null })}
          className="flex items-center gap-2 rounded-[8px] border border-hud/40 bg-hud/10 px-4 py-2.5 font-mono text-[10px] text-hud transition-all duration-200 hover:border-hud/70 hover:bg-hud/20"
        >
          <RotateCcw size={12} />
          Tentar novamente
        </button>
      </div>
    );
  }
}
