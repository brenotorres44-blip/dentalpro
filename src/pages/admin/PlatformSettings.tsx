import { useEffect, useState } from 'react';
import { Database, GitBranch, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { HolographicPanel } from '@/components/ui/HolographicPanel';
import { StatusIndicator, type Tone } from '@/components/ui/StatusIndicator';
import { Badge } from '@/components/ui/DataTable';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { usePlatform } from '@/services/platformStore';
import { formatInt } from '@/utils/format';

/**
 * SONDAGEM DA INFRAESTRUTURA.
 *
 * Storage e fila de notificações não dão para saber por configuração: o `0010`
 * e o `0009` podem estar no repositório sem terem sido aplicados, e as Edge
 * Functions são publicadas à parte. A única resposta honesta vem de perguntar
 * ao servidor.
 *
 * Duas chamadas, uma vez por abertura da tela. Nenhuma delas escreve.
 */
type Sonda = 'checando' | 'ok' | 'ausente';

interface Infra {
  bucket: Sonda;
  /** A tabela existe? */
  fila: Sonda;
  enfileiradas: number;
  entregues: number;
}

function useInfra(): Infra {
  const [infra, setInfra] = useState<Infra>({
    bucket: 'checando',
    fila: 'checando',
    enfileiradas: 0,
    entregues: 0,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setInfra({ bucket: 'ausente', fila: 'ausente', enfileiradas: 0, entregues: 0 });
      return;
    }

    let vivo = true;

    void Promise.all([
      // Listar é a sondagem mais barata que distingue "bucket existe e está
      // vazio" de "bucket não existe" — o primeiro devolve lista vazia, o
      // segundo devolve erro. Ler os metadados do bucket exigiria service_role.
      supabase.storage.from('company-media').list('', { limit: 1 }),
      supabase.from('notifications').select('status', { count: 'exact', head: false }).limit(500),
    ]).then(([storage, fila]) => {
      if (!vivo) return;

      const linhas = (fila.data ?? []) as Array<{ status: string }>;

      setInfra({
        bucket: storage.error ? 'ausente' : 'ok',
        fila: fila.error ? 'ausente' : 'ok',
        enfileiradas: fila.count ?? linhas.length,
        // "Saiu da fila" é o que prova que o remetente rodou. Pendente sozinho
        // não distingue "ninguém agendou nada ainda" de "o cron não existe".
        entregues: linhas.filter((n) => n.status !== 'pendente').length,
      });
    });

    return () => {
      vivo = false;
    };
  }, []);

  return infra;
}

/**
 * O estado real dos serviços, não uma lista escrita à mão.
 *
 * Esta era a intenção desde o começo, mas só metade cumpria: banco e
 * autenticação mudavam com o `.env.local`, enquanto pagamento, notificações e
 * armazenamento ficavam fixos em "planejado". O armazenamento entrou em
 * operação e a tela continuou dizendo "planejado" — um painel de status escrito
 * à mão envelhece por definição, e o único que não envelhece é o que pergunta.
 *
 * Agora os seis são medidos: três por configuração, um pelos dados já
 * carregados e dois por sondagem.
 */
function useServices() {
  const ligado = isSupabaseConfigured;
  const { plans, metrics } = usePlatform();
  const infra = useInfra();

  // Plano com preço no gateway é o que separa "modelado" de "cobrável". Sem
  // nenhum, o botão de assinar leva a um erro — e é o que a tela precisa dizer.
  const cobraveis = plans.filter((p) => p.chargeable).length;

  return [
    {
      label: 'Aplicação web',
      detail: 'React + Vite · build estático',
      status: 'ok' as Tone,
      badge: 'operacional',
    },
    {
      label: 'Banco de dados',
      detail: ligado ? 'Postgres com RLS por company_id' : 'sementes locais + localStorage',
      status: ligado ? ('ok' as Tone) : ('warn' as Tone),
      badge: ligado ? 'operacional' : 'modo demonstração',
    },
    {
      label: 'Autenticação',
      detail: ligado ? 'Supabase Auth · papel vindo de memberships' : 'sessão mock, qualquer senha',
      status: ligado ? ('ok' as Tone) : ('warn' as Tone),
      badge: ligado ? 'operacional' : 'mock',
    },
    {
      label: 'Armazenamento',
      detail:
        infra.bucket === 'checando' ? 'verificando o bucket…'
        : infra.bucket === 'ok' ? 'bucket company-media · logo e fotos por empresa'
        : 'bucket company-media não responde — falta aplicar o 0010',
      status:
        infra.bucket === 'checando' ? ('idle' as Tone)
        : infra.bucket === 'ok' ? ('ok' as Tone)
        : ('critical' as Tone),
      badge:
        infra.bucket === 'checando' ? 'checando'
        : infra.bucket === 'ok' ? 'operacional'
        : 'não aplicado',
    },
    {
      label: 'Notificações',
      detail:
        infra.fila === 'checando' ? 'verificando a fila…'
        : infra.fila === 'ausente' ? 'tabela de fila ausente — falta aplicar o 0009'
        : infra.entregues > 0 ? `${formatInt(infra.entregues)} entregue(s) · a fila anda`
        : infra.enfileiradas > 0
          ? `${formatInt(infra.enfileiradas)} na fila, nenhuma saiu — falta publicar send-notifications`
          : 'fila vazia — nada enfileirado ainda',
      status:
        infra.fila === 'checando' ? ('idle' as Tone)
        : infra.fila === 'ausente' ? ('critical' as Tone)
        : infra.entregues > 0 ? ('ok' as Tone)
        : infra.enfileiradas > 0 ? ('warn' as Tone)
        : ('idle' as Tone),
      badge:
        infra.fila === 'checando' ? 'checando'
        : infra.fila === 'ausente' ? 'não aplicado'
        : infra.entregues > 0 ? 'operacional'
        : infra.enfileiradas > 0 ? 'fila parada'
        : 'sem tráfego',
    },
    {
      label: 'Gateway de pagamento',
      detail:
        !ligado ? 'Stripe — indisponível no modo demonstração'
        : cobraveis > 0
          ? `Stripe · ${cobraveis} de ${plans.length} plano(s) com preço no gateway`
          : 'Stripe · nenhum plano com external_price_id — assinar recusa',
      status:
        !ligado ? ('idle' as Tone)
        : cobraveis === 0 ? ('idle' as Tone)
        : cobraveis < plans.length ? ('warn' as Tone)
        : metrics.billingIntegrated ? ('ok' as Tone)
        : ('warn' as Tone),
      badge:
        !ligado ? 'indisponível'
        : cobraveis === 0 ? 'não integrado'
        : cobraveis < plans.length ? 'parcial'
        : metrics.billingIntegrated ? 'operacional'
        : 'sem cobrança ainda',
    },
  ];
}

const TENANCY_RULES = [
  'Toda tabela de negócio carrega company_id não nulo.',
  'Row Level Security nega por padrão; política liberada por vínculo do usuário.',
  'Chaves de serviço nunca chegam ao navegador — apenas em funções de borda.',
  'Funções de plataforma são security definer e abrem checando is_platform_admin().',
  'Double-booking é barrado por constraint de exclusão, não por checagem na aplicação.',
  'A checagem de permissão no cliente é conveniência; a barreira real é o banco.',
];

/**
 * O que falta, e é **configuração, não código**.
 *
 * A lista anterior estava vencida: pedia a vitrine `/<slug>`, o Turnstile e o
 * realtime, os três entregues nas rodadas `0008` a `0011`. Uma lista de
 * próximos passos que cita trabalho concluído treina quem lê a ignorá-la.
 *
 * O que sobrou tem uma coisa em comum — nenhum item é código. Tudo já está
 * escrito e testado; falta publicar e configurar, e cada passo exige login
 * interativo que a aplicação não tem como fazer por conta própria.
 */
const NEXT_STEPS = [
  'supabase db push — aplicar as migrations 0017, 0018, 0019 e 0020.',
  'Publicar as Edge Functions book-public e send-notifications.',
  'Segredos das funções: Resend (e-mail), Turnstile (anti-robô) e as URLs do site.',
  'pg_cron para o rollup diário e o disparo da fila de notificações.',
  'SMTP próprio em Authentication → Emails, e a Redirect URL de /redefinir-senha.',
  'Stripe: preços nos planos, stripe-billing e stripe-webhook publicadas, endpoint registrado.',
];

export function PlatformSettings() {
  const { metrics, loaded } = usePlatform();
  const services = useServices();

  const num = (value: number) => (loaded ? formatInt(value) : '—');

  return (
    <div className="flex flex-col gap-4">
      <HolographicPanel title="Estado da plataforma" icon={<Server size={14} />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.label}
              className="flex items-start gap-3 rounded-[8px] border border-hud/12 bg-white/[0.02] p-3"
            >
              <span className="mt-1">
                <StatusIndicator tone={s.status} pulse={s.status === 'ok'} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">{s.label}</span>
                  <Badge tone={s.status === 'ok' ? 'ok' : s.status === 'warn' ? 'warn' : 'idle'}>
                    {s.badge}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </HolographicPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <HolographicPanel title="Regras de isolamento" icon={<ShieldCheck size={14} />} delay={70}>
          <ul className="flex flex-col gap-2.5">
            {TENANCY_RULES.map((rule) => (
              <li key={rule} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-hud" />
                <span className="text-[12.5px] leading-relaxed text-ink-dim">{rule}</span>
              </li>
            ))}
          </ul>
        </HolographicPanel>

        <HolographicPanel title="Escala atual" icon={<Database size={14} />} delay={130}>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['EMPRESAS ATIVAS', num(metrics.activeCompanies)],
              ['EMPRESAS NO TOTAL', num(metrics.totalCompanies)],
              ['USUÁRIOS', num(metrics.users)],
              ['TICKETS ABERTOS', num(metrics.openTickets)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[8px] border border-hud/12 bg-white/[0.02] px-3 py-2.5">
                <dt className="tech-label">{label}</dt>
                <dd className="mt-1 font-display text-[17px] font-semibold text-hud tnum">{value}</dd>
              </div>
            ))}
          </dl>

          {!isSupabaseConfigured && (
            <div className="mt-4 flex items-start gap-3 rounded-[8px] border border-warn/25 bg-warn/[0.06] p-3">
              <KeyRound size={14} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-[11.5px] leading-relaxed text-ink-dim">
                Sem <code className="font-mono text-warn">.env.local</code>, estes números vêm de
                sementes determinísticas e a autenticação aceita qualquer senha. Não insira dado
                real: aqui não existe barreira de isolamento nenhuma.
              </p>
            </div>
          )}
        </HolographicPanel>
      </div>

      <HolographicPanel title="Próximas etapas" icon={<GitBranch size={14} />} delay={190}>
        <ol className="flex flex-col gap-2">
          {NEXT_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[8px] border border-hud/30 bg-hud/[0.08] font-mono text-[10px] text-hud tnum">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-ink-dim">{step}</span>
            </li>
          ))}
        </ol>
      </HolographicPanel>
    </div>
  );
}
