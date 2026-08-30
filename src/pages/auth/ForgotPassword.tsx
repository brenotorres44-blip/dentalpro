import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, MailCheck, Send } from 'lucide-react';
import { Field, Callout } from '@/components/ui/Field';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { requestPasswordReset } from '@/services/authService';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * O sucesso é declarado depois da resposta do servidor, não no clique.
   *
   * Antes esta tela só fazia `setSent(true)` — dizia "link enviado" sem ter
   * mandado nada, e quem esquecia a senha ficava esperando um e-mail que não
   * existia. A mensagem continua sem confirmar se a conta existe (isso
   * entregaria uma lista de endereços válidos), mas agora ela só aparece
   * quando o envio de fato foi aceito.
   */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <div className="mb-6 text-center">
          <h1 className="font-display text-[17px] font-bold tracking-[0.24em] text-ink">
            RECUPERAR ACESSO
          </h1>
          <p className="tech-label mt-1.5">ENVIAREMOS UM LINK DE REDEFINIÇÃO</p>
        </div>

        <div className="holo-panel relative p-6">
          <CornerBrackets />

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-success/50 text-success">
                <MailCheck size={24} />
              </span>
              <div>
                <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-success">
                  Link enviado
                </p>
                {/* Não confirmamos se o e-mail existe: revelar isso entrega uma
                    lista de contas válidas a quem estiver testando endereços. */}
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
                  Se houver uma conta associada a <strong className="text-ink">{email}</strong>,
                  você receberá as instruções em alguns minutos.
                </p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field
                label="E-mail da conta"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@suaclinica.com"
              />

              {error && (
                <Callout tone="critical" icon={<AlertTriangle size={13} />}>
                  {error}
                </Callout>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-[8px] border border-hud/50 bg-hud/12 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-hud transition-all duration-200 hover:bg-hud/20 hover: disabled:opacity-45"
              >
                <Send size={13} />
                {busy ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center">
          <Link
            to="/login"
            className="tech-label inline-flex items-center gap-1.5 transition-colors hover:text-hud"
          >
            <ArrowLeft size={11} />
            VOLTAR AO LOGIN
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
