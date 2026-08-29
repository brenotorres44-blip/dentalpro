import { AlertTriangle, X } from 'lucide-react';
import { dismissError, useOperations } from '@/services/store';
import { dismissPlatformError, usePlatform } from '@/services/platformStore';

/**
 * O que o servidor está fazendo, quando isso muda o que a tela mostra.
 *
 * Duas situações, e só duas:
 *
 * **Carregando** — entre o login e a chegada dos dados, as listas estão vazias
 * porque ainda não chegaram, não porque não há nada. Sem este aviso, um
 * catálogo vazio e um catálogo não carregado são a mesma imagem, e o usuário
 * cadastra de novo o que já existe.
 *
 * **Falha de gravação** — as coleções escrevem otimista e desfazem sozinhas
 * quando o banco recusa. O rollback sem aviso é o pior caso possível: o registro
 * aparece, some, e ninguém diz por quê. A agenda não passa por aqui — ela espera
 * a resposta e mostra o erro dentro do próprio formulário.
 *
 * O componente é o mesmo nos dois ambientes porque o problema é o mesmo; só a
 * fonte do estado muda. Duplicar a faixa faria a do centro de comando divergir
 * da do PRODENT no primeiro ajuste de cor.
 */
function SyncBanner({
  loading,
  lastError,
  onDismiss,
  loadingLabel,
}: {
  loading: boolean;
  lastError: string | null;
  onDismiss: () => void;
  loadingLabel: string;
}) {
  if (lastError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 border-b border-critical/35 bg-critical/[0.09] px-4 py-2.5 sm:px-6"
      >
        <AlertTriangle size={14} className="mt-px shrink-0 text-critical" />
        <p className="flex-1 text-[11.5px] leading-relaxed text-critical">{lastError}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
          className="shrink-0 text-critical/70 transition-opacity hover:opacity-70"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!loading) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-hud/25 bg-hud/[0.05] px-4 py-2 sm:px-6"
    >
      {/* `motion-safe` porque a regra do sistema é desligar o laço, não encurtá-lo. */}
      <span className="h-1.5 w-1.5 rounded-full bg-hud motion-safe:animate-pulse" />
      <span className="tech-label text-hud">{loadingLabel}</span>
    </div>
  );
}

export function SyncStatus() {
  const { loading, lastError } = useOperations();

  return (
    <SyncBanner
      loading={loading}
      lastError={lastError}
      onDismiss={dismissError}
      loadingLabel="CARREGANDO DADOS DA CLÍNICA"
    />
  );
}

export function PlatformSyncStatus() {
  const { loading, lastError } = usePlatform();

  return (
    <SyncBanner
      loading={loading}
      lastError={lastError}
      onDismiss={dismissPlatformError}
      loadingLabel="CARREGANDO DADOS DA PLATAFORMA"
    />
  );
}
