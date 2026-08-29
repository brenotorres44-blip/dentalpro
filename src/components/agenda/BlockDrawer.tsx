import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { TechButton } from '@/components/ui/TechButton';
import { Callout, SelectField } from '@/components/ui/Field';
import type { ProfessionalRecord, ScheduleBlock } from '@/data/types';
import { insert, nextId } from '@/services/store';
import { dateKey, formatLongDate } from '@/utils/format';
import { toMinutes } from '@/utils/time';

/**
 * Bloqueio de agenda.
 *
 * O que ocupa a cadeira sem ser atendimento: manutenção, treinamento, almoço
 * estendido. Sem isso a taxa de ocupação mentiria para cima — o horário estaria
 * livre no sistema e indisponível na vida real.
 */
export function BlockDrawer({
  open,
  date,
  professionals,
  onClose,
}: {
  open: boolean;
  date: Date;
  professionals: ProfessionalRecord[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Omit<ScheduleBlock, 'id' | 'date'>>({
    professionalId: 'all',
    start: '12:00',
    end: '13:00',
    reason: '',
  });

  const invalid = toMinutes(draft.end) <= toMinutes(draft.start);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Bloquear horário"
      subtitle={<span className="capitalize">{formatLongDate(date)}</span>}
      icon={<Lock size={15} />}
      width={400}
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="QUEM FICA BLOQUEADO"
          value={draft.professionalId}
          onChange={(e) => setDraft((d) => ({ ...d, professionalId: e.target.value }))}
        >
          <option value="all">Toda a equipe</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['start', 'INÍCIO'],
              ['end', 'FIM'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="tech-label">{label}</span>
              <input
                type="time"
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-[3px] border border-stroke/70 bg-void/50 px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none transition-colors focus:border-hud/60 tnum"
              />
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="tech-label">MOTIVO</span>
          <input
            value={draft.reason}
            onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))}
            placeholder="Manutenção, treinamento, almoço estendido"
            className="w-full rounded-[3px] border border-stroke/70 bg-void/50 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint/60 focus:border-hud/60"
          />
        </label>

        {invalid && <Callout tone="critical">O fim precisa ser depois do início.</Callout>}

        <TechButton
          variant="primary"
          disabled={invalid}
          className="justify-center py-3"
          onClick={() => {
            insert('blocks', { ...draft, id: nextId('b'), date: dateKey(date) });
            onClose();
          }}
        >
          Bloquear
        </TechButton>
      </div>
    </Drawer>
  );
}
