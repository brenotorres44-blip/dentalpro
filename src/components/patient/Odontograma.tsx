import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import type { ToothConditionId, ToothState } from '@/data/types';
import { TechButton } from '@/components/ui/TechButton';
import { TextareaField } from '@/components/ui/Field';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/utils/cn';

/**
 * ODONTOGRAMA
 *
 * Numeração FDI (ISO 3950): dois dígitos, o primeiro é o quadrante (1–4 na
 * dentição permanente, 5–8 na decídua), o segundo é a posição a partir da
 * linha média. É o padrão que qualquer dentista já lê de cabeça — inventar
 * uma numeração própria obrigaria a traduzir mentalmente toda consulta.
 */
const ADULTO_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ADULTO_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const LEITE_SUP = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const LEITE_INF = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export const CONDICOES: Array<{ id: ToothConditionId; label: string; cor: string; stroke: string }> = [
  { id: 'normal', label: 'Normal / sadio', cor: '#ffffff', stroke: '#cbd4dc' },
  { id: 'carie', label: 'Cárie', cor: '#d94040', stroke: '#b83232' },
  { id: 'restaurado', label: 'Restaurado', cor: '#2d7dd2', stroke: '#1a5fa8' },
  { id: 'canal', label: 'Tratado (canal)', cor: '#d98b1a', stroke: '#b06a0d' },
  { id: 'protese', label: 'Prótese', cor: '#7c3aed', stroke: '#5b21b6' },
  { id: 'implante', label: 'Implante', cor: '#1a9e75', stroke: '#0d7d5c' },
  { id: 'extraido', label: 'Extraído', cor: '#5a6a7a', stroke: '#3d4d5c' },
  { id: 'ausente', label: 'Ausente / não erupcionado', cor: '#f0f2f5', stroke: '#cbd4dc' },
];

const condicaoOf = (id: ToothConditionId) => CONDICOES.find((c) => c.id === id) ?? CONDICOES[0];

/** O dente em si: um contorno único reaproveitado para as 52 posições. */
function ToothIcon({ cond, small }: { cond: ToothConditionId; small?: boolean }) {
  const cfg = condicaoOf(cond);
  const w = small ? 22 : 28;
  const h = small ? 26 : 32;
  return (
    <svg width={w} height={h} viewBox="0 0 28 32" aria-hidden>
      <path
        d="M4 6 C4 2 10 1 14 1 C18 1 24 2 24 6 L26 22 C26 28 22 31 14 31 C6 31 2 28 2 22 Z"
        fill={cfg.cor}
        stroke={cfg.stroke}
        strokeWidth={1.5}
        strokeDasharray={cond === 'ausente' ? '3 2' : undefined}
      />
      {cond === 'extraido' && (
        <>
          <line x1={8} y1={8} x2={20} y2={24} stroke="#fff" strokeWidth={2} />
          <line x1={20} y1={8} x2={8} y2={24} stroke="#fff" strokeWidth={2} />
        </>
      )}
      {cond === 'canal' && <circle cx={14} cy={16} r={4} fill="none" stroke="#fff" strokeWidth={1.5} />}
      {cond === 'implante' && (
        <>
          <line x1={14} y1={6} x2={14} y2={26} stroke="#fff" strokeWidth={2} />
          <line x1={9} y1={14} x2={19} y2={14} stroke="#fff" strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}

function ToothRow({
  nums,
  odonto,
  small,
  onPick,
}: {
  nums: number[];
  odonto: Record<string, ToothState>;
  small?: boolean;
  onPick: (num: number) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {nums.map((num) => {
        const estado = odonto[String(num)] ?? { cond: 'normal' as ToothConditionId, obs: '' };
        return (
          <button
            key={num}
            type="button"
            onClick={() => onPick(num)}
            className="flex min-w-9 flex-col items-center gap-0.5 rounded-[6px] p-1 transition-colors hover:bg-hud/[0.06]"
          >
            <span className="font-mono text-[10px] text-ink-faint tnum">{num}</span>
            <ToothIcon cond={estado.cond} small={small} />
            <span className="min-h-[14px] text-center text-[9px] leading-tight text-ink-faint">
              {estado.cond !== 'normal' ? condicaoOf(estado.cond).label : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Controlado: quem chama guarda `value` (o mapa dente→condição) e recebe
 * `onChange` a cada alteração salva. Sem estado de rede aqui — a decisão de
 * quando gravar (otimista, local, remoto) é de quem está por fora, como em
 * todo o resto do sistema.
 */
export function Odontograma({
  value,
  onChange,
  readOnly = false,
}: {
  value: Record<string, ToothState>;
  onChange: (next: Record<string, ToothState>) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draftCond, setDraftCond] = useState<ToothConditionId>('normal');
  const [draftObs, setDraftObs] = useState('');

  function openTooth(num: number) {
    if (readOnly) return;
    const estado = value[String(num)] ?? { cond: 'normal' as ToothConditionId, obs: '' };
    setDraftCond(estado.cond);
    setDraftObs(estado.obs);
    setEditing(num);
  }

  function save() {
    if (editing === null) return;
    onChange({ ...value, [String(editing)]: { cond: draftCond, obs: draftObs.trim() } });
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto pb-1">
        <div className="flex flex-col gap-6" style={{ minWidth: 620 }}>
          <div>
            <div className="tech-label mb-2 text-center">Adulto — superior</div>
            <ToothRow nums={ADULTO_SUP} odonto={value} onPick={openTooth} />
          </div>
          <div>
            <div className="tech-label mb-2 text-center">Adulto — inferior</div>
            <ToothRow nums={ADULTO_INF} odonto={value} onPick={openTooth} />
          </div>

          <div className="relative my-1 border-t border-dashed border-stroke">
            <span className="absolute left-1/2 top-[-9px] -translate-x-1/2 bg-panel px-3 text-[10px] font-semibold text-ink-faint">
              Dentição infantil (decídua)
            </span>
          </div>

          <div>
            <div className="tech-label mb-2 text-center">Infantil — superior</div>
            <ToothRow nums={LEITE_SUP} odonto={value} small onPick={openTooth} />
          </div>
          <div>
            <div className="tech-label mb-2 text-center">Infantil — inferior</div>
            <ToothRow nums={LEITE_INF} odonto={value} small onPick={openTooth} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 border-t border-stroke pt-4">
        {CONDICOES.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1.5 rounded-full border border-stroke px-2.5 py-1 text-[11px] text-ink-dim"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: c.cor, border: `1.5px solid ${c.stroke}` }}
            />
            {c.label}
          </span>
        ))}
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Dente ${editing}` : 'Dente'}
        subtitle="Selecione a condição e adicione observações"
        width={380}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {CONDICOES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDraftCond(c.id)}
                className={cn(
                  'flex items-center gap-2 rounded-[6px] border px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors',
                  draftCond === c.id
                    ? 'border-hud/60 bg-hud/[0.08] text-hud'
                    : 'border-stroke text-ink-dim hover:border-hud/30',
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: c.cor, border: `1.5px solid ${c.stroke}` }}
                />
                {c.label}
                {draftCond === c.id && <Check size={13} className="ml-auto shrink-0" />}
              </button>
            ))}
          </div>

          <TextareaField
            label="Observações"
            value={draftObs}
            onChange={(e) => setDraftObs(e.target.value)}
            rows={3}
            placeholder="Ex: cárie na face vestibular..."
          />

          <TechButton variant="primary" icon={<Save size={13} />} onClick={save}>
            Salvar
          </TechButton>
        </div>
      </Drawer>
    </div>
  );
}
