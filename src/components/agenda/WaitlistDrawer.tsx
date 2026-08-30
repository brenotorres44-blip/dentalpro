import { useState } from 'react';
import { ListPlus } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { TechButton } from '@/components/ui/TechButton';
import { Callout, SelectField } from '@/components/ui/Field';
import type { WaitlistEntry } from '@/data/types';
import { insert, nextId, useOperations } from '@/services/store';
import { dateKey } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Entrada na fila de espera.
 *
 * Registra quem quer um horário que hoje não existe, com a janela que aceita.
 * A oferta da vaga é um clique na agenda quando alguém desmarca — e o aviso ao
 * cliente continua manual, porque disparo automático exige backend.
 */
export function WaitlistDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clients, services, professionals } = useOperations();
  const today = dateKey(new Date());

  const [draft, setDraft] = useState<Omit<WaitlistEntry, 'id' | 'createdAt'>>({
    clientId: '',
    serviceIds: [],
    professionalId: 'any',
    fromDate: today,
    toDate: today,
    window: 'qualquer',
    note: '',
  });

  const invalid = !draft.clientId || draft.serviceIds.length === 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Entrar na fila"
      subtitle="Recebe a vaga quando alguém desmarca"
      icon={<ListPlus size={15} />}
      width={400}
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="CLIENTE"
          value={draft.clientId}
          onChange={(e) => setDraft((d) => ({ ...d, clientId: e.target.value }))}
        >
          <option value="">Selecione</option>
          {clients
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </SelectField>

        <section className="flex flex-col gap-2">
          <span className="tech-label">PROCEDIMENTOS</span>
          <div className="flex flex-wrap gap-1.5">
            {services
              .filter((s) => s.active)
              .map((s) => {
                const selected = draft.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        serviceIds: selected
                          ? d.serviceIds.filter((id) => id !== s.id)
                          : [...d.serviceIds, s.id],
                      }))
                    }
                    className={cn(
                      'rounded-[8px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-200',
                      selected
                        ? 'border-hud/50 bg-hud/12 text-hud'
                        : 'border-stroke/60 text-ink-faint hover:border-hud/30',
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
          </div>
        </section>

        <SelectField
          label="PROFISSIONAL"
          value={draft.professionalId}
          onChange={(e) => setDraft((d) => ({ ...d, professionalId: e.target.value }))}
        >
          <option value="any">Qualquer um</option>
          {professionals
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['fromDate', 'ACEITA A PARTIR DE'],
              ['toDate', 'ATÉ'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="tech-label">{label}</span>
              <input
                type="date"
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-[8px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[12px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
              />
            </label>
          ))}
        </div>

        <SelectField
          label="FAIXA DO DIA"
          value={draft.window}
          onChange={(e) =>
            setDraft((d) => ({ ...d, window: e.target.value as WaitlistEntry['window'] }))
          }
        >
          <option value="qualquer">Qualquer horário</option>
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="noite">Noite</option>
        </SelectField>

        <Callout tone="info">
          Sem backend não há disparo automático de mensagem. A fila registra quem espera e a agenda
          oferece a vaga com um clique — avisar o cliente ainda é manual.
        </Callout>

        <TechButton
          variant="primary"
          disabled={invalid}
          className="justify-center py-3"
          onClick={() => {
            insert('waitlist', { ...draft, id: nextId('w'), createdAt: new Date().toISOString() });
            onClose();
          }}
        >
          Adicionar à fila
        </TechButton>
      </div>
    </Drawer>
  );
}
