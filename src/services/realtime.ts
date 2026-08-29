import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { appointmentFromRow } from './mappers';
import { dropAppointment, getState, upsertAppointment } from './store';

/**
 * A GRADE QUE SE ATUALIZA SOZINHA
 *
 * Uma assinatura por empresa ativa. Quando alguém marca de outro dispositivo, o
 * bloco aparece na tela de quem já estava com a agenda aberta.
 *
 * **Isto não previne double-booking.** Realtime é notificação *pós-commit* — a
 * linha já está gravada quando o aviso chega. Dois clientes clicando no mesmo
 * horário com 200 ms de diferença passam ambos por qualquer checagem baseada
 * nele. Quem impede a segunda linha é a constraint `EXCLUDE USING gist`, e ela
 * continua sendo a única garantia. Aqui é conforto: a recepcionista para de
 * trabalhar com uma tela velha.
 *
 * ## Por que a mensagem não basta
 *
 * O payload traz a linha de `appointments` e nada mais — nome do cliente e
 * procedimentos estão em outras tabelas. A tela mostra "Bruno · Avaliação + Limpeza", não
 * dois uuids, então cada evento dispara uma leitura da linha completa. É uma
 * consulta por atendimento alterado, não por evento de tela: barato o
 * suficiente, e mantém uma fonte só para o formato do registro
 * (`appointmentFromRow`).
 */

const APPOINTMENT_SELECT = `
  id, starts_at, ends_at, status, price_cents, payment_method, notes,
  professional_id,
  clients ( id, name ),
  appointment_services ( service_id, price_cents, duration_min, services ( name ) )
`;

let channel: RealtimeChannel | null = null;
let subscribedTo: string | null = null;

export function subscribeToAgenda(companyId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  // Trocar de ambiente (o administrador entrando noutra clínica) precisa
  // derrubar a assinatura anterior: sem isso, a agenda de duas empresas
  // chegaria na mesma tela.
  if (subscribedTo === companyId) return;

  unsubscribeFromAgenda();
  subscribedTo = companyId;

  channel = supabase
    .channel(`agenda:${companyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        // O filtro é do servidor. Sem ele, o navegador de cada clínica
        // receberia o tráfego de todas — e a RLS, que já esvazia o payload,
        // não evitaria o custo da mensagem.
        filter: `company_id=eq.${companyId}`,
      },
      (payload) => {
        void handle(payload.eventType, payload.new as { id?: string }, payload.old as { id?: string });
      },
    )
    .subscribe();
}

async function handle(
  event: string,
  novo: { id?: string } | null,
  velho: { id?: string } | null,
) {
  if (event === 'DELETE') {
    // No `DELETE` chega só a chave primária: `replica identity` é a padrão,
    // porque `slot` é coluna gerada e bloqueia a identidade "full" (ver
    // `0011_realtime.sql`). O id é o que a grade precisa para tirar o bloco.
    if (velho?.id) dropAppointment(velho.id);
    return;
  }

  const id = novo?.id;
  if (!id || !supabase) return;

  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  // Sem linha: ou a RLS negou (não é desta empresa) ou o atendimento sumiu
  // entre o aviso e a leitura. Nos dois casos, tirar da tela é o certo.
  if (error || !data) {
    dropAppointment(id);
    return;
  }

  upsertAppointment(appointmentFromRow(data as never, getState().timezone));
}

export function unsubscribeFromAgenda() {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
  subscribedTo = null;
}
