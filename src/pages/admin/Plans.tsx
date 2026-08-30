import { useEffect, useState } from 'react';
import { Blocks, Check, Infinity as InfinityIcon, Minus, Save } from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { TechButton } from '@/components/ui/TechButton';
import { type Plan, type PlanLimits } from '@/data/saas';
import { updatePlan, usePlatform } from '@/services/platformStore';
import { formatBRL } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Os limites numéricos aceitam vazio, e vazio é **ilimitado** — mesma convenção
 * do banco, onde a coluna é `null`. Zero seria um plano que não deixa cadastrar
 * ninguém, que é outra coisa e não é o que ninguém quer dizer ao apagar o campo.
 */
const NUMERIC: Array<{ key: keyof PlanLimits; label: string; suffix?: string }> = [
  { key: 'users', label: 'Usuários' },
  { key: 'professionals', label: 'Profissionais' },
  { key: 'appointmentsMonth', label: 'Atendimentos/mês' },
  { key: 'clients', label: 'Clientes' },
  { key: 'storageGb', label: 'Armazenamento', suffix: 'GB' },
];

/**
 * Estas seis não são texto de vitrine: cada uma decide acesso.
 * `themeBuilder`, por exemplo, é o que o Theme Center consulta antes de deixar
 * o dono personalizar. Por isso são colunas em `plans`, não frases numa lista.
 */
const TOGGLES: Array<{ key: keyof PlanLimits; label: string }> = [
  { key: 'financial', label: 'Financeiro' },
  { key: 'inventory', label: 'Estoque' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'automations', label: 'Automações' },
  { key: 'themeBuilder', label: 'Personalização de tema' },
  { key: 'prioritySupport', label: 'Suporte prioritário' },
];

/** Centavos → o texto que aparece no campo. Vazio nunca vira zero por acidente. */
const paraTexto = (cents: number) => String(cents / 100);

/**
 * UM PLANO, COM RASCUNHO.
 *
 * Antes cada tecla gravava: o `input` era controlado pelo estado da loja e o
 * `onChange` chamava `updatePlan` direto. Digitar "149" mandava três escritas ao
 * banco — 1, 14, 149 — e **apagar o campo para digitar de novo gravava R$ 0,00
 * no plano**, porque `Number('')` é zero.
 *
 * Agora o cartão tem rascunho, como a tela de Configurações da clínica: o que
 * você digita fica aqui, e só o botão manda. É o mesmo motivo lá e aqui — campo
 * numérico passa por estados inválidos enquanto está sendo digitado, e nenhum
 * deles deveria chegar ao banco.
 */
function PlanCard({ plan, inUse, featured }: { plan: Plan; inUse: number; featured: boolean }) {
  const [preco, setPreco] = useState(() => paraTexto(plan.priceCents));
  const [limites, setLimites] = useState<PlanLimits>(plan.limits);

  /*
   * O rascunho segue o servidor quando o servidor muda por fora — outra aba, ou
   * o rollback de uma gravação recusada. Sem isto, o cartão continuaria
   * exibindo um valor que o banco já rejeitou.
   */
  useEffect(() => {
    setPreco(paraTexto(plan.priceCents));
    setLimites(plan.limits);
  }, [plan.priceCents, plan.limits]);

  const precoCents = Math.round(Number(preco.replace(',', '.')) * 100);
  const precoValido = preco.trim() !== '' && Number.isFinite(precoCents) && precoCents >= 0;

  const mudou =
    (precoValido && precoCents !== plan.priceCents) ||
    NUMERIC.some((f) => limites[f.key] !== plan.limits[f.key]) ||
    TOGGLES.some((f) => limites[f.key] !== plan.limits[f.key]);

  const salvar = () => {
    if (!precoValido || !mudou) return;
    updatePlan(plan.id, { priceCents: precoCents, limits: limites });
  };

  const setLimite = (key: keyof PlanLimits, value: number | boolean | null) =>
    setLimites((atual) => ({ ...atual, [key]: value }));

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[8px] border p-4',
        featured ? 'border-hud/40 bg-hud/[0.04]' : 'border-hud/12 bg-white/[0.02]',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[13px] font-bold tracking-[0.18em] text-ink">
            {plan.name}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">{plan.tagline}</p>
        </div>
        <span className="shrink-0 rounded-[8px] border border-hud/25 bg-hud/[0.08] px-2 py-1 font-mono text-[9.5px] text-hud tnum">
          {inUse} empresas
        </span>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="tech-label">PREÇO MENSAL</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-faint">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className={cn(
              'w-full rounded-[8px] border bg-void/50 px-2.5 py-2 font-mono text-[13px] outline-none transition-colors tnum',
              precoValido
                ? 'border-stroke/70 text-hud focus:border-hud/60'
                : 'border-critical/60 text-critical',
            )}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-faint tnum">
          {precoValido
            ? `${formatBRL(precoCents)} · MRR contratado ${formatBRL(precoCents * inUse)}`
            : 'informe um valor'}
        </span>
      </label>

      {/*
        Este preço é o que a landing anuncia; quem cobra é o gateway, com o preço
        cadastrado lá. Um plano público sem preço do outro lado é um botão
        "assinar" que leva a um erro — e o único lugar onde isso aparece antes de
        o cliente descobrir é aqui.
      */}
      <p
        className={cn(
          'rounded-[8px] border px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em]',
          plan.chargeable
            ? 'border-success/30 bg-success/[0.07] text-success'
            : 'border-warn/30 bg-warn/[0.07] text-warn',
        )}
      >
        {plan.chargeable ? 'cobrável no gateway' : 'sem preço no gateway'}
      </p>

      <div className="flex flex-col gap-2.5">
        {NUMERIC.map((f) => {
          const value = limites[f.key] as number | null;
          return (
            <label key={f.key} className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-ink-dim">{f.label}</span>
              <span className="flex items-center gap-1.5">
                {value === null && (
                  <InfinityIcon size={12} className="shrink-0 text-hud" aria-hidden />
                )}
                <input
                  type="number"
                  min={0}
                  value={value ?? ''}
                  placeholder="ilimitado"
                  title="Vazio = ilimitado"
                  onChange={(e) =>
                    setLimite(f.key, e.target.value === '' ? null : Number(e.target.value))
                  }
                  className="w-24 rounded-[8px] border border-stroke/70 bg-void/50 px-2 py-1.5 text-right font-mono text-[11.5px] text-ink outline-none transition-colors placeholder:text-[10px] placeholder:text-ink-faint/60 focus:border-hud/60 tnum"
                />
                {f.suffix && <span className="font-mono text-[10px] text-ink-faint">{f.suffix}</span>}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-hud/10 pt-3">
        {TOGGLES.map((f) => {
          const on = Boolean(limites[f.key]);
          return (
            <button
              key={f.key}
              onClick={() => setLimite(f.key, !on)}
              className="flex items-center justify-between gap-3 rounded-[8px] px-1 py-1.5 transition-colors duration-150 hover:bg-hud/[0.05]"
              aria-pressed={on}
            >
              <span className={cn('text-[11.5px]', on ? 'text-ink-dim' : 'text-ink-faint/70')}>
                {f.label}
              </span>
              <span
                className={cn(
                  'grid shrink-0 place-items-center rounded-full border transition-all duration-200',
                  on ? 'border-hud/60 bg-hud/15 text-hud' : 'border-stroke/60 text-ink-faint/50',
                )}
                style={{ height: 18, width: 18 }}
              >
                {on ? <Check size={10} /> : <Minus size={10} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hud/10 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {mudou ? 'alterações não salvas' : 'tudo salvo'}
        </span>
        <TechButton
          variant={mudou ? 'primary' : 'ghost'}
          icon={<Save size={12} />}
          disabled={!mudou || !precoValido}
          onClick={salvar}
        >
          Salvar
        </TechButton>
      </div>
    </div>
  );
}

export function Plans() {
  const { plans, companies, loaded } = usePlatform();

  return (
    <HolographicPanel title="Planos" meta={`${plans.length} ATIVOS`} icon={<Blocks size={14} />}>
      <p className="mb-5 text-[12px] leading-relaxed text-ink-dim">
        Cada limite aqui é uma coluna da tabela <code className="font-mono text-hud">plans</code> e
        vale para os dois lados: a landing monta a comparação a partir dele, e o sistema consulta o
        mesmo campo antes de liberar a funcionalidade. O que você digita fica no rascunho até
        clicar em <strong className="text-ink">Salvar</strong>.
      </p>

      {plans.length === 0 && (
        <p className="rounded-[8px] border border-dashed border-hud/15 px-4 py-8 text-center text-[12px] text-ink-faint">
          {loaded ? 'Nenhum plano cadastrado.' : 'Carregando os planos…'}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            inUse={companies.filter((c) => c.planId === plan.id).length}
            // O plano do meio é o recomendado — destaque por posição, não por id
            // fixo: o centro de comando pode criar um quarto plano amanhã.
            featured={plan.sortOrder === 2}
          />
        ))}
      </div>
    </HolographicPanel>
  );
}
