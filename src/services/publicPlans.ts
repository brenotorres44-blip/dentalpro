import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { planFromRow } from './platformData';
import { PLANS, setPlanRegistry, type Plan } from '@/data/saas';

/**
 * OS PLANOS QUE A VITRINE MOSTRA
 *
 * A landing e o cadastro são públicos: quem os abre não está autenticado, e o
 * store do centro de comando — que exige administrador de plataforma — não
 * serve aqui. Mas o preço tem que ser o mesmo nos dois lugares, senão a pessoa
 * escolhe um valor na landing e encontra outro na fatura.
 *
 * A policy `plans_read` do `0002` já prevê isso: `to authenticated, anon using
 * (is_public or is_platform_admin())`. Plano marcado como não público — um
 * legado, um contrato negociado — some da vitrine sem sumir do banco.
 *
 * Sem `.env.local`, devolve as constantes e nunca toca a rede.
 */

const PUBLIC_COLUMNS =
  'id, name, price_cents, tagline, sort_order, is_public, ' +
  'max_users, max_professionals, max_appointments_month, max_clients, storage_gb, ' +
  'has_financial, has_inventory, has_reports, has_automations, has_theme_builder, has_priority_support';

/** Cache de módulo: a landing e o cadastro não pedem a mesma lista duas vezes. */
let cache: Plan[] | null = null;

export function usePublicPlans(): Plan[] {
  const [plans, setPlans] = useState<Plan[]>(cache ?? PLANS);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || cache) return;

    let vivo = true;

    void supabase
      .from('plans')
      .select(PUBLIC_COLUMNS)
      .eq('is_public', true)
      .order('sort_order')
      .then(({ data, error }) => {
        // Falhar aqui não pode derrubar a landing: ela continua com as
        // constantes, que são os mesmos três planos do seed. É a única tela do
        // produto que precisa funcionar mesmo com o banco fora do ar.
        if (error || !data?.length || !vivo) return;

        const list = data.map((row) => planFromRow(row as never));
        cache = list;
        setPlanRegistry(list);
        setPlans(list);
      });

    return () => {
      vivo = false;
    };
  }, []);

  return plans;
}
