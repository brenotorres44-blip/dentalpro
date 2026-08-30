import { useState } from 'react';
import { AlertTriangle, Building2, LogOut, Store } from 'lucide-react';
import { motion } from 'motion/react';
import { Callout, Field, SelectField } from '@/components/ui/Field';
import { TechButton } from '@/components/ui/TechButton';
import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { useSession } from '@/auth/SessionProvider';
import { createCompanyFor } from '@/services/signupService';
import { THEMES } from '@/themes/tokens';
import { useTheme } from '@/themes/ThemeProvider';
import { cn } from '@/utils/cn';

const UF = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

/**
 * CRIAR A CLÍNICA
 *
 * Para quem está autenticado mas não tem empresa. Acontece em dois casos reais:
 * quem confirmou o e-mail antes de a criação diferida existir, e quem se
 * cadastrou quando o fluxo ainda deixava a conta órfã.
 *
 * Antes, esse estado derrubava o login com uma instrução de SQL na tela —
 * inútil para quem não administra o banco. Uma conta autenticada sem empresa é
 * um estado previsível, e todo estado previsível merece uma saída dentro do
 * produto.
 */
export function CreateCompany() {
  const { session, refresh, logout } = useSession();
  const { setBaseTheme } = useTheme();

  const [form, setForm] = useState({
    name: '',
    document: '',
    phone: '',
    city: '',
    state: 'SP',
    themeId: 'clinic-clean',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const invalid = form.name.trim().length < 2;

  async function submit() {
    if (invalid) {
      setError('Informe o nome da clínica.');
      return;
    }
    setSaving(true);
    setError(null);

    const created = await createCompanyFor(form);

    if (!created.ok) {
      setError(created.error);
      setSaving(false);
      return;
    }

    // `refresh` relê a sessão, agora com o vínculo de dono. O guard que trouxe
    // a pessoa até aqui deixa de disparar e ela segue para o painel.
    await refresh();
    setSaving(false);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="holo-panel relative p-6 sm:p-8"
      >
        <CornerBrackets tone="hud" />

        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[9px] border border-hud/30 bg-hud/[0.06] text-hud">
            <Store size={20} strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold text-ink">
              CRIE SUA CLÍNICA
            </h1>
            <p className="mt-1 truncate text-[12px] text-ink-faint">{session?.user.email}</p>
          </div>
        </div>

        <p className="mt-5 text-[12.5px] leading-relaxed text-ink-dim">
          Sua conta está ativa, mas ainda não existe uma clínica ligada a ela. Isso acontece
          quando o cadastro é concluído em duas etapas — a conta primeiro, a confirmação depois.
          Preencha o nome e o ambiente é montado na hora.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field
            label="NOME DA CLÍNICA"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Clínica Corte Fino"
            autoFocus
            hint="É o nome que aparece no topo do sistema e no seu endereço público."
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="CNPJ (OPCIONAL)"
              value={form.document}
              onChange={(e) => set('document', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
            <Field
              label="TELEFONE"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(11) 90000-0000"
            />
          </div>

          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field
              label="CIDADE"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="São Paulo"
            />
            <SelectField
              label="UF"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
            >
              {UF.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </SelectField>
          </div>

          {/* ---------- tema, aplicado ao vivo ---------- */}
          <section className="flex flex-col gap-2">
            <span className="tech-label">TEMA</span>
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Escolha e veja na hora — a tela inteira muda junto. Dá para trocar depois em
              Configurações.
            </p>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {THEMES.map((t) => {
                const selected = form.themeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      set('themeId', t.id);
                      // Aplica de verdade em vez de só guardar a escolha:
                      // ninguém escolhe cor por nome, escolhe olhando.
                      setBaseTheme(t.id);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-[8px] border px-2 py-2 text-left transition-all duration-200',
                      selected
                        ? 'border-hud/60 bg-hud/12'
                        : 'border-stroke/60 hover:border-hud/35',
                    )}
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-[8px] border border-white/10"
                      style={{
                        background: `linear-gradient(135deg, ${t.tokens.hud}, ${t.tokens.void})`,
                      }}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'min-w-0 truncate font-mono text-[9.5px]',
                        selected ? 'text-hud' : 'text-ink-faint',
                      )}
                    >
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {error && (
            <div className="flex flex-col gap-2">
              <Callout tone="critical" icon={<AlertTriangle size={13} />}>
                {error}
              </Callout>
              {/* O erro de sessão órfã só se resolve saindo — oferecer o botão
                  junto evita que a pessoa fique clicando em "Criar" de novo. */}
              {/não existe mais|expirou/i.test(error) && (
                <TechButton icon={<LogOut size={12} />} onClick={logout} className="justify-center">
                  Sair e entrar de novo
                </TechButton>
              )}
            </div>
          )}

          <TechButton
            variant="primary"
            onClick={submit}
            disabled={saving || invalid}
            icon={<Building2 size={13} />}
            className={cn('justify-center py-3', saving && 'opacity-70')}
          >
            {saving ? 'Montando o ambiente…' : 'Criar clínica'}
          </TechButton>

          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-2 text-[11px] text-ink-faint transition-colors hover:text-ink-dim"
          >
            <LogOut size={12} />
            Sair e entrar com outra conta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
