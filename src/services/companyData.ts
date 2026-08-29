import { requireSupabase } from '@/lib/supabase/client';
import { DEFAULT_SETTINGS } from '@/data/mock';
import type { Appointment, ShopSettings } from '@/data/types';
import {
  blockFromRow,
  cashClosingFromRow,
  cashEntryFromRow,
  clientFromRow,
  movementFromRow,
  productFromRow,
  professionalFromRow,
  serviceFromRow,
  waitlistFromRow,
  appointmentFromRow,
} from './mappers';

/**
 * CARGA DOS DADOS DA EMPRESA
 *
 * Uma leitura só, no login, de tudo que cabe em memória: catálogo, equipe,
 * clientes, estoque, caixa e configurações. Não entram os atendimentos — eles
 * são consultados por data, porque a agenda de um ano não cabe nem faz sentido
 * carregar para exibir uma terça-feira.
 *
 * As consultas correm em paralelo. Em série, dez idas ao servidor somariam
 * segundos antes da primeira tela.
 *
 * A RLS já filtra por empresa, mas o `.eq('company_id', …)` fica explícito
 * assim mesmo: quem lê o código não deveria precisar confiar numa policy
 * invisível para entender o recorte — e um administrador de plataforma, que
 * enxerga todas as empresas, sem ele traria a base inteira.
 */

export interface CompanyData {
  appointments: Appointment[];
  services: ReturnType<typeof serviceFromRow>[];
  professionals: ReturnType<typeof professionalFromRow>[];
  clients: ReturnType<typeof clientFromRow>[];
  products: ReturnType<typeof productFromRow>[];
  movements: ReturnType<typeof movementFromRow>[];
  entries: ReturnType<typeof cashEntryFromRow>[];
  closings: ReturnType<typeof cashClosingFromRow>[];
  blocks: ReturnType<typeof blockFromRow>[];
  waitlist: ReturnType<typeof waitlistFromRow>[];
  settings: ShopSettings;
  timezone: string;
}

const SERVICE_SELECT =
  '*, service_prices(professional_id, price_cents), service_components(component_id)';
const PROFESSIONAL_SELECT =
  '*, professional_schedules(weekday, starts_at, ends_at, break_start, break_end), professional_services(service_id)';

/** Bloqueios e caixa antigos não interessam à operação do dia a dia. */
const RECENT_DAYS = 120;

/**
 * Janela de atendimentos mantida em memória.
 *
 * 180 dias para trás cobrem o histórico do cliente e os relatórios; 90 para
 * frente cobrem a agenda aberta. Numa clínica movimentada isso dá ~2 mil
 * linhas — nada para o navegador, e é o que permite `listByDate` continuar
 * síncrona e as oito telas não mudarem.
 *
 * Se um dia não couber, o caminho é paginar por mês em `agendaService`, não
 * espalhar `await` pela árvore de componentes.
 */
const HISTORY_BACK_DAYS = 180;
const HISTORY_AHEAD_DAYS = 90;

const APPOINTMENT_SELECT = `
  id, starts_at, ends_at, status, price_cents, payment_method, notes,
  professional_id,
  clients ( id, name ),
  appointment_services ( service_id, price_cents, duration_min, services ( name ) )
`;

export async function loadCompanyData(companyId: string): Promise<CompanyData> {
  const sb = requireSupabase();

  const since = new Date();
  since.setDate(since.getDate() - RECENT_DAYS);
  const sinceDate = since.toISOString().slice(0, 10);

  const [
    company,
    settings,
    hours,
    holidays,
    services,
    professionals,
    clients,
    products,
    movements,
    entries,
    closings,
    blocks,
    waitlist,
  ] = await Promise.all([
    sb.from('companies').select('name, document, phone, email, street, number, district, city, state, zip, timezone, logo_path').eq('id', companyId).maybeSingle(),
    sb.from('company_settings').select('*').eq('company_id', companyId).maybeSingle(),
    sb.from('business_hours').select('*').eq('company_id', companyId).order('weekday'),
    sb.from('holidays').select('date').eq('company_id', companyId),
    sb.from('services').select(SERVICE_SELECT).eq('company_id', companyId).order('name'),
    sb.from('professionals').select(PROFESSIONAL_SELECT).eq('company_id', companyId).order('name'),
    sb.from('clients').select('*').eq('company_id', companyId).order('name'),
    sb.from('products').select('*').eq('company_id', companyId).order('name'),
    sb.from('stock_movements').select('*').eq('company_id', companyId).gte('occurred_on', sinceDate),
    sb.from('cash_entries').select('*').eq('company_id', companyId).gte('occurred_on', sinceDate),
    sb.from('cash_closings').select('*').eq('company_id', companyId).gte('occurred_on', sinceDate),
    sb.from('schedule_blocks').select('*').eq('company_id', companyId).gte('starts_at', since.toISOString()),
    sb.from('waitlist').select('*').eq('company_id', companyId),
  ]);

  const timezone = company.data?.timezone ?? 'America/Sao_Paulo';

  const from = new Date();
  from.setDate(from.getDate() - HISTORY_BACK_DAYS);
  const to = new Date();
  to.setDate(to.getDate() + HISTORY_AHEAD_DAYS);

  const appointments = await sb
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('company_id', companyId)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at');

  return {
    appointments: (appointments.data ?? []).map((r) => appointmentFromRow(r as never, timezone)),
    services: (services.data ?? []).map((r) => serviceFromRow(r as never)),
    professionals: (professionals.data ?? []).map((r) => professionalFromRow(r as never)),
    clients: (clients.data ?? []).map((r) => clientFromRow(r as never)),
    products: (products.data ?? []).map((r) => productFromRow(r as never)),
    movements: (movements.data ?? []).map((r) => movementFromRow(r as never)),
    entries: (entries.data ?? []).map((r) => cashEntryFromRow(r as never)),
    closings: (closings.data ?? []).map((r) => cashClosingFromRow(r as never)),
    blocks: (blocks.data ?? []).map((r) => blockFromRow(r as never, timezone)),
    waitlist: (waitlist.data ?? []).map((r) => waitlistFromRow(r as never)),
    settings: buildSettings(company.data, settings.data, hours.data, holidays.data),
    timezone,
  };
}

/**
 * Junta quatro tabelas no objeto único que a tela de configurações edita.
 *
 * Cada `??` cobre uma empresa recém-criada: a função de cadastro cria
 * `company_settings` e `business_hours`, mas uma empresa inserida à mão pelo
 * painel pode não ter. Cair no padrão é melhor que a tela abrir quebrada.
 */
function buildSettings(
  company: Record<string, unknown> | null,
  settings: Record<string, unknown> | null,
  hours: Array<Record<string, unknown>> | null,
  holidays: Array<{ date: string }> | null,
): ShopSettings {
  const week = DEFAULT_SETTINGS.hours.map((fallback, weekday) => {
    const row = hours?.find((h) => h.weekday === weekday);
    if (!row) return { ...fallback };
    return {
      closed: Boolean(row.is_closed),
      open: String(row.opens_at).slice(0, 5),
      close: String(row.closes_at).slice(0, 5),
    };
  });

  return {
    name: (company?.name as string) ?? '',
    document: (company?.document as string) ?? '',
    phone: (company?.phone as string) ?? '',
    email: (company?.email as string) ?? '',
    logoPath: (company?.logo_path as string | null) ?? null,
    address: {
      street: (company?.street as string) ?? '',
      number: (company?.number as string) ?? '',
      district: (company?.district as string) ?? '',
      city: (company?.city as string) ?? '',
      state: (company?.state as string) ?? '',
      zip: (company?.zip as string) ?? '',
    },
    hours: week,
    holidays: (holidays ?? []).map((h) => h.date).sort(),
    booking: {
      slotMinutes: Number(settings?.slot_minutes ?? DEFAULT_SETTINGS.booking.slotMinutes),
      minAdvanceHours: Number(settings?.min_advance_hours ?? DEFAULT_SETTINGS.booking.minAdvanceHours),
      maxAdvanceDays: Number(settings?.max_advance_days ?? DEFAULT_SETTINGS.booking.maxAdvanceDays),
      cancelWindowHours: Number(settings?.cancel_window_hours ?? DEFAULT_SETTINGS.booking.cancelWindowHours),
      allowOverbooking: Boolean(settings?.allow_overbooking ?? false),
      noShowFeePct: Number(settings?.no_show_fee_pct ?? 0),
    },
    notifications: {
      emailConfirmation: Boolean(settings?.email_confirmation ?? true),
      emailReminder: Boolean(settings?.email_reminder ?? true),
      whatsappConfirmation: Boolean(settings?.whatsapp_confirmation ?? false),
      whatsappReminder: Boolean(settings?.whatsapp_reminder ?? false),
      reminderHoursBefore: Number(settings?.reminder_hours_before ?? 24),
      marketingOptIn: Boolean(settings?.marketing_opt_in ?? false),
    },
  };
}

/**
 * Grava as configurações de volta nas quatro tabelas.
 *
 * Horários e feriados são substituídos por inteiro em vez de comparados linha a
 * linha: são sete e poucas dezenas de registros, e a diferença de custo não
 * paga a complexidade de calcular o que mudou.
 */
export async function saveCompanySettings(companyId: string, settings: ShopSettings) {
  const sb = requireSupabase();

  const [company, config, hours] = await Promise.all([
    sb
      .from('companies')
      .update({
        name: settings.name,
        document: settings.document || null,
        phone: settings.phone || null,
        email: settings.email || null,
        street: settings.address.street || null,
        number: settings.address.number || null,
        district: settings.address.district || null,
        city: settings.address.city || null,
        state: settings.address.state || null,
        zip: settings.address.zip || null,
        logo_path: settings.logoPath,
      })
      .eq('id', companyId),
    sb.from('company_settings').upsert({
      company_id: companyId,
      slot_minutes: settings.booking.slotMinutes,
      min_advance_hours: settings.booking.minAdvanceHours,
      max_advance_days: settings.booking.maxAdvanceDays,
      cancel_window_hours: settings.booking.cancelWindowHours,
      allow_overbooking: settings.booking.allowOverbooking,
      no_show_fee_pct: settings.booking.noShowFeePct,
      email_confirmation: settings.notifications.emailConfirmation,
      email_reminder: settings.notifications.emailReminder,
      whatsapp_confirmation: settings.notifications.whatsappConfirmation,
      whatsapp_reminder: settings.notifications.whatsappReminder,
      reminder_hours_before: settings.notifications.reminderHoursBefore,
      marketing_opt_in: settings.notifications.marketingOptIn,
    }),
    sb.from('business_hours').upsert(
      settings.hours.map((h, weekday) => ({
        company_id: companyId,
        weekday,
        is_closed: h.closed,
        opens_at: h.open,
        closes_at: h.close,
      })),
    ),
  ]);

  const error = company.error ?? config.error ?? hours.error;
  if (error) return { ok: false as const, error: error.message };

  // Feriados: apaga os que saíram, insere os que entraram.
  const current = await sb.from('holidays').select('date').eq('company_id', companyId);
  const before = new Set((current.data ?? []).map((h) => h.date));
  const after = new Set(settings.holidays);

  const removed = [...before].filter((d) => !after.has(d));
  const added = [...after].filter((d) => !before.has(d));

  if (removed.length) {
    await sb.from('holidays').delete().eq('company_id', companyId).in('date', removed);
  }
  if (added.length) {
    await sb.from('holidays').insert(added.map((date) => ({ company_id: companyId, date })));
  }

  return { ok: true as const };
}
