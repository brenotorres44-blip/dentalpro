import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarOff,
  Check,
  Clock3,
  MapPin,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Trash2,
  X,
} from 'lucide-react';

import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { ConfirmButton, TechButton } from '@/components/ui/TechButton';
import { Callout, Field, Toggle } from '@/components/ui/Field';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { extensionOf, logoPath } from '@/services/mediaService';
import { useSession } from '@/auth/SessionProvider';

import type { ShopSettings } from '@/data/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { saveCompanySettings } from '@/services/companyData';
import { getState, mutate, resetOperations, useOperations } from '@/services/store';
import { formatShortDate, WEEKDAYS_SHORT } from '@/utils/format';
import { cn } from '@/utils/cn';

const WEEKDAY_FULL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export function Settings() {
  const { settings } = useOperations();
  // O caminho da logo começa pelo id da empresa: é ele que a policy do storage
  // compara para autorizar a gravação.
  const { company } = useSession();

  const [draft, setDraft] = useState<ShopSettings>(settings);
  const [holiday, setHoliday] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );

  /**
   * A carga do banco termina depois da primeira renderização.
   *
   * Enquanto ninguém tocou no formulário, o rascunho acompanha o que o servidor
   * trouxe — sem isto a tela abriria com os padrões, marcaria "alterações não
   * salvas" sozinha e um clique em Salvar sobrescreveria a configuração real da
   * clínica com valores que o usuário nunca digitou. Depois do primeiro
   * toque, não: uma recarga não pode apagar o que está sendo editado.
   */
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setDraft(settings);
  }, [settings, touched]);

  const set = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
    setSaveError(null);
    setTouched(true);
  };

  const setAddress = (key: keyof ShopSettings['address'], value: string) =>
    set('address', { ...draft.address, [key]: value });

  const setBooking = <K extends keyof ShopSettings['booking']>(
    key: K,
    value: ShopSettings['booking'][K],
  ) => set('booking', { ...draft.booking, [key]: value });

  const setNotifications = <K extends keyof ShopSettings['notifications']>(
    key: K,
    value: ShopSettings['notifications'][K],
  ) => set('notifications', { ...draft.notifications, [key]: value });

  function setHours(index: number, patch: Partial<ShopSettings['hours'][number]>) {
    set(
      'hours',
      draft.hours.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  }

  /**
   * As configurações vivem em quatro tabelas, e a gravação não é otimista.
   *
   * Diferente dos outros módulos, aqui não há linha nova aparecendo numa lista:
   * o usuário fica olhando o mesmo formulário. Mostrar "Salvo" e reverter meio
   * segundo depois seria pior que esperar — e o que se grava aqui (horário de
   * funcionamento, janela de cancelamento) é o que `validate_slot` usa para
   * aceitar ou recusar todo agendamento seguinte.
   */
  async function save() {
    if (saving) return;

    const { companyId } = getState();
    if (!isSupabaseConfigured || !companyId) {
      mutate(() => ({ settings: draft }));
      setSaved(true);
      setTouched(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    const result = await saveCompanySettings(companyId, draft);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    mutate(() => ({ settings: draft }));
    setSaved(true);
    setTouched(false);
  }

  const openDays = draft.hours.filter((h) => !h.closed).length;

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- barra de salvamento ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-hud/25 bg-hud/[0.06] text-hud">
            <SettingsIcon size={16} />
          </span>
          <div>
            <div className="font-display text-[13px] font-semibold tracking-wide text-ink">
              {draft.name || 'Clínica sem nome'}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusIndicator
                tone={dirty ? 'warn' : 'ok'}
                pulse={dirty}
                label={dirty ? 'ALTERAÇÕES NÃO SALVAS' : 'TUDO SALVO'}
                compact
              />
              <span className="tech-label">
                {openDays} DIA{openDays === 1 ? '' : 'S'} ABERTOS · {draft.holidays.length} FERIADO
                {draft.holidays.length === 1 ? '' : 'S'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <TechButton
              icon={<X size={12} />}
              onClick={() => {
                setDraft(settings);
                setTouched(false);
                setSaveError(null);
              }}
            >
              Descartar
            </TechButton>
          )}
          <TechButton
            variant="primary"
            icon={saved && !dirty ? <Check size={12} /> : <Save size={12} />}
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? 'Salvando…' : saved && !dirty ? 'Salvo' : 'Salvar'}
          </TechButton>
        </div>
      </div>

      {saveError && <Callout tone="critical">{saveError}</Callout>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* ---------- cadastro ---------- */}
        <HolographicPanel
          title="Dados da clínica"
          icon={<Building2 size={14} />}
          className="xl:col-span-6"
        >
          <div className="flex flex-col gap-3">
            {/* A logo é gravada no bucket na hora do envio, mas o **caminho**
                entra no rascunho e só vai para a tabela ao salvar — como
                qualquer outro campo desta tela. */}
            {company && (
              <ImageUpload
                label="LOGO"
                hint="Aparece na página pública da clínica. PNG, JPG, WEBP ou SVG, até 2 MB."
                currentPath={draft.logoPath}
                path={(file) => logoPath(company.id, extensionOf(file))}
                onUploaded={(path) => set('logoPath', path)}
              />
            )}

            <Field label="NOME" value={draft.name} onChange={(e) => set('name', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="CNPJ"
                value={draft.document}
                onChange={(e) => set('document', e.target.value)}
              />
              <Field
                label="TELEFONE"
                value={draft.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <Field
              label="E-MAIL"
              type="email"
              value={draft.email}
              onChange={(e) => set('email', e.target.value)}
            />

            <div className="mt-1 flex items-center gap-2 border-t border-hud/10 pt-3">
              <MapPin size={13} className="text-hud/70" />
              <span className="tech-label">ENDEREÇO</span>
            </div>

            <div className="grid grid-cols-[1fr_90px] gap-3">
              <Field
                label="RUA"
                value={draft.address.street}
                onChange={(e) => setAddress('street', e.target.value)}
              />
              <Field
                label="NÚMERO"
                value={draft.address.number}
                onChange={(e) => setAddress('number', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="BAIRRO"
                value={draft.address.district}
                onChange={(e) => setAddress('district', e.target.value)}
              />
              <Field
                label="CEP"
                value={draft.address.zip}
                onChange={(e) => setAddress('zip', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[1fr_70px] gap-3">
              <Field
                label="CIDADE"
                value={draft.address.city}
                onChange={(e) => setAddress('city', e.target.value)}
              />
              <Field
                label="UF"
                maxLength={2}
                value={draft.address.state}
                onChange={(e) => setAddress('state', e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </HolographicPanel>

        {/* ---------- horário ---------- */}
        <HolographicPanel
          title="Horário de funcionamento"
          meta={`${openDays}/7 DIAS`}
          icon={<Clock3 size={14} />}
          className="xl:col-span-6"
        >
          <div className="flex flex-col gap-2">
            {draft.hours.map((day, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center gap-2 rounded-[8px] border px-2.5 py-2 transition-colors duration-200',
                  day.closed ? 'border-stroke/50 bg-white/[0.01]' : 'border-hud/15 bg-hud/[0.03]',
                )}
              >
                <button
                  type="button"
                  onClick={() => setHours(index, { closed: !day.closed })}
                  className={cn(
                    'w-16 shrink-0 rounded-[8px] border px-1.5 py-1 font-mono text-[10px] transition-colors duration-200',
                    day.closed
                      ? 'border-stroke/60 text-ink-faint hover:border-hud/30'
                      : 'border-hud/40 bg-hud/10 text-hud',
                  )}
                  aria-pressed={!day.closed}
                >
                  {WEEKDAYS_SHORT[index]}
                </button>

                <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-dim">
                  {WEEKDAY_FULL[index]}
                </span>

                {day.closed ? (
                  <span className="font-mono text-[10px] text-ink-faint">
                    Fechado
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1">
                    {(['open', 'close'] as const).map((key) => (
                      <input
                        key={key}
                        type="time"
                        value={day[key]}
                        onChange={(e) => setHours(index, { [key]: e.target.value })}
                        aria-label={`${key === 'open' ? 'Abre' : 'Fecha'} ${WEEKDAY_FULL[index]}`}
                        className="w-[74px] rounded-[8px] border border-stroke/70 bg-void/50 px-1.5 py-1 text-center font-mono text-[11px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
                      />
                    ))}
                  </span>
                )}
              </div>
            ))}

            {/* feriados */}
            <div className="mt-2 flex flex-col gap-2 border-t border-hud/10 pt-3">
              <div className="flex items-center gap-2">
                <CalendarOff size={13} className="text-hud/70" />
                <span className="tech-label">FERIADOS E FECHAMENTOS</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={holiday}
                  onChange={(e) => setHoliday(e.target.value)}
                  className="flex-1 rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2 font-mono text-[12px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
                  aria-label="Data do feriado"
                />
                <TechButton
                  disabled={!holiday || draft.holidays.includes(holiday)}
                  onClick={() => {
                    set('holidays', [...draft.holidays, holiday].sort());
                    setHoliday('');
                  }}
                >
                  Adicionar
                </TechButton>
              </div>

              {draft.holidays.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  Nenhum feriado cadastrado. A agenda bloqueia essas datas e o relatório de ocupação
                  deixa de contá-las como dias disponíveis.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {draft.holidays.map((date) => (
                    <span
                      key={date}
                      className="flex items-center gap-1.5 rounded-[8px] border border-warn/30 bg-warn/[0.07] px-2 py-1"
                    >
                      <span className="font-mono text-[10.5px] text-warn tnum">
                        {formatShortDate(new Date(`${date}T12:00:00`))}
                      </span>
                      <button
                        onClick={() => set('holidays', draft.holidays.filter((d) => d !== date))}
                        className="text-warn/70 transition-colors hover:text-warn"
                        aria-label={`Remover ${date}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </HolographicPanel>

        {/* ---------- regras de agendamento ---------- */}
        <HolographicPanel
          title="Regras de agendamento"
          icon={<Clock3 size={14} />}
          className="xl:col-span-6"
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="INTERVALO DA GRADE (MIN)"
                type="number"
                min={5}
                step={5}
                value={draft.booking.slotMinutes}
                onChange={(e) => setBooking('slotMinutes', Math.max(5, Number(e.target.value)))}
                hint="Passo das colunas na agenda"
              />
              <Field
                label="ANTECEDÊNCIA MÍNIMA (H)"
                type="number"
                min={0}
                value={draft.booking.minAdvanceHours}
                onChange={(e) => setBooking('minAdvanceHours', Math.max(0, Number(e.target.value)))}
                hint="Para o agendamento do cliente"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="ANTECEDÊNCIA MÁXIMA (DIAS)"
                type="number"
                min={1}
                value={draft.booking.maxAdvanceDays}
                onChange={(e) => setBooking('maxAdvanceDays', Math.max(1, Number(e.target.value)))}
              />
              <Field
                label="CANCELAMENTO ATÉ (H ANTES)"
                type="number"
                min={0}
                value={draft.booking.cancelWindowHours}
                onChange={(e) =>
                  setBooking('cancelWindowHours', Math.max(0, Number(e.target.value)))
                }
              />
            </div>

            <Field
              label="TAXA DE FALTA (%)"
              type="number"
              min={0}
              max={100}
              value={draft.booking.noShowFeePct}
              onChange={(e) =>
                setBooking('noShowFeePct', Math.min(100, Math.max(0, Number(e.target.value))))
              }
              hint="Percentual do valor cobrado de quem não aparece. Zero desliga a cobrança."
            />

            <Toggle
              label="Permitir encaixe no mesmo horário"
              description="Desligado, a agenda recusa dois atendimentos sobrepostos para o mesmo profissional."
              checked={draft.booking.allowOverbooking}
              onChange={(checked) => setBooking('allowOverbooking', checked)}
            />

            {draft.booking.allowOverbooking && (
              <Callout tone="warn" icon={<AlertTriangle size={13} />}>
                Com encaixe liberado a validação de conflito para de bloquear sobreposições. A taxa
                de ocupação pode passar de 100% e deixa de ser comparável entre profissionais.
              </Callout>
            )}
          </div>
        </HolographicPanel>

        {/* ---------- notificações ---------- */}
        <HolographicPanel
          title="Notificações"
          icon={<BellRing size={14} />}
          className="xl:col-span-6"
        >
          <div className="flex flex-col gap-2.5">
            <Toggle
              label="Confirmação por e-mail"
              description="Enviada assim que o horário é marcado."
              checked={draft.notifications.emailConfirmation}
              onChange={(v) => setNotifications('emailConfirmation', v)}
            />
            <Toggle
              label="Lembrete por e-mail"
              checked={draft.notifications.emailReminder}
              onChange={(v) => setNotifications('emailReminder', v)}
            />
            <Toggle
              label="Confirmação por WhatsApp"
              description="Exige a API oficial da Meta — paga e com template aprovado."
              checked={draft.notifications.whatsappConfirmation}
              onChange={(v) => setNotifications('whatsappConfirmation', v)}
            />
            <Toggle
              label="Lembrete por WhatsApp"
              checked={draft.notifications.whatsappReminder}
              onChange={(v) => setNotifications('whatsappReminder', v)}
            />
            <Toggle
              label="Comunicação de marketing"
              description="Promoções e campanhas para quem aceitou receber."
              checked={draft.notifications.marketingOptIn}
              onChange={(v) => setNotifications('marketingOptIn', v)}
            />

            <Field
              label="LEMBRETE QUANTAS HORAS ANTES"
              type="number"
              min={1}
              max={72}
              value={draft.notifications.reminderHoursBefore}
              onChange={(e) =>
                setNotifications(
                  'reminderHoursBefore',
                  Math.min(72, Math.max(1, Number(e.target.value))),
                )
              }
            />

            <Callout tone="info">
              O envio depende do worker de notificações e de um provedor
              configurado (Resend para e-mail, Meta Cloud API para WhatsApp) —
              ver <code>docs/06-notificacoes.md</code>. Sem isso, os toggles
              acima gravam a preferência, mas nada é enviado ainda.
            </Callout>
          </div>
        </HolographicPanel>

        {/* ---------- zona de risco ---------- */}
        {/*
          Só no modo mock. Com banco, "restaurar" limparia o espelho em memória
          sem tocar no servidor: o usuário veria a tela esvaziar, recarregaria e
          encontraria tudo de volta. Um botão que promete apagar e não apaga é
          pior que botão nenhum.
        */}
        {!isSupabaseConfigured && (
          <HolographicPanel
            title="Dados de demonstração"
            icon={<RotateCcw size={14} />}
            tone="critical"
            className="xl:col-span-12"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-[11.5px] leading-relaxed text-ink-dim">
                Procedimentos, equipe, pacientes, itens, lançamentos e alterações de agenda ficam
                gravados no navegador. Restaurar devolve tudo ao estado de fábrica e{' '}
                <strong className="text-critical">apaga o que você cadastrou</strong>. A agenda
                gerada não é afetada — ela é recalculada a partir da data.
              </p>
              <ConfirmButton
                icon={<Trash2 size={12} />}
                confirmLabel="Apagar e restaurar?"
                onConfirm={() => {
                  resetOperations();
                  // O rascunho local também volta, senão a barra continuaria
                  // acusando "alterações não salvas" contra um estado zerado.
                  setDraft(getState().settings);
                  setTouched(false);
                  setSaved(false);
                }}
                className="shrink-0 justify-center"
              >
                Restaurar dados
              </ConfirmButton>
            </div>
          </HolographicPanel>
        )}
      </div>
    </div>
  );
}
