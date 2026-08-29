import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { Callout } from '@/components/ui/Field';
import { ACCEPTED, publicUrl, remove, upload } from '@/services/mediaService';
import { cn } from '@/utils/cn';

/**
 * Envio de imagem — logo da clínica, foto do profissional.
 *
 * O caminho vem pronto de quem chama (`mediaService` monta), porque é ele que
 * autoriza a gravação: a policy do `0010` compara a primeira pasta com as
 * empresas do usuário. Deixar o componente inventar o caminho espalharia essa
 * regra por cada tela que sobe arquivo.
 *
 * A prévia aparece **antes** do envio terminar, com `URL.createObjectURL`. É
 * otimismo justificado: a alternativa é o quadrado ficar vazio por um segundo
 * depois do clique, e o usuário clicar de novo achando que não pegou.
 */
export function ImageUpload({
  path,
  currentPath,
  onUploaded,
  label,
  hint,
  round = false,
}: {
  /** Onde gravar. Monte com `logoPath()` / `photoPath()`. */
  path: (file: File) => string;
  /** O que já está gravado, para mostrar. */
  currentPath: string | null;
  onUploaded: (path: string | null) => void;
  label: string;
  hint?: string;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = preview ?? publicUrl(currentPath);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);

    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);

    const result = await upload(file, path(file));
    setBusy(false);

    if (result.ok) {
      onUploaded(result.path);
    } else {
      // A prévia sai junto com a falha: manter a imagem na tela afirmaria que
      // o envio deu certo.
      setPreview(null);
      setError(result.error);
    }
    URL.revokeObjectURL(local);
  }

  async function clear() {
    if (currentPath) await remove(currentPath);
    setPreview(null);
    onUploaded(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="tech-label">{label}</span>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={cn(
            'group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden',
            'border border-dashed border-stroke/70 bg-void/40 transition-colors duration-200',
            'hover:border-hud/50 disabled:opacity-50',
            round ? 'rounded-full' : 'rounded-[3px]',
          )}
          aria-label={`Enviar ${label.toLowerCase()}`}
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageUp size={18} className="text-ink-faint transition-colors group-hover:text-hud" />
          )}

          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-void/70">
              <span className="h-1.5 w-1.5 rounded-full bg-hud motion-safe:animate-pulse" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-col gap-1.5">
          {hint && <p className="text-[11px] leading-relaxed text-ink-faint">{hint}</p>}
          {shown && (
            <button
              type="button"
              onClick={() => void clear()}
              className="flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-critical"
            >
              <Trash2 size={11} />
              Remover
            </button>
          )}
        </div>
      </div>

      {error && <Callout tone="critical">{error}</Callout>}

      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Zera para que escolher o mesmo arquivo de novo dispare o evento —
          // é o que permite reenviar depois de uma falha.
          e.target.value = '';
        }}
      />
    </div>
  );
}
