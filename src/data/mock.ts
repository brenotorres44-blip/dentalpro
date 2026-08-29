import { deburr, intBetween, pick, seeded, shuffle } from '@/utils/random';
import type {
  ClientRecord,
  Product,
  Professional,
  ProfessionalRecord,
  ProductRecord,
  ServiceItem,
  ShopSettings,
} from './types';

/* ==========================================================================
   CATÁLOGO DE PROCEDIMENTOS
   Os `weight` dos procedimentos simples somam 1: é deles que sai a repartição
   do faturamento do mês no dashboard. Combos ficam fora da repartição para
   não contar a mesma receita duas vezes.
   ========================================================================= */

export const SERVICE_SEED: ServiceItem[] = [
  {
    id: 's1',
    name: 'Consulta de Avaliação',
    description: 'Exame clínico, anamnese e plano de tratamento.',
    category: 'avaliacao',
    priceCents: 12000,
    durationMin: 30,
    bufferMin: 5,
    active: true,
    priceOverrides: {},
    comboOf: [],
    weight: 0.22,
  },
  {
    id: 's2',
    name: 'Limpeza (Profilaxia)',
    description: 'Remoção de placa e tártaro, polimento e flúor.',
    category: 'preventivo',
    priceCents: 15000,
    durationMin: 40,
    bufferMin: 10,
    active: true,
    priceOverrides: {},
    comboOf: [],
    weight: 0.2,
  },
  {
    id: 's3',
    name: 'Restauração em Resina',
    description: 'Restauração estética direta, uma face.',
    category: 'restaurador',
    priceCents: 25000,
    durationMin: 50,
    bufferMin: 10,
    active: true,
    priceOverrides: { p1: 28000 },
    comboOf: [],
    weight: 0.18,
  },
  {
    id: 's4',
    name: 'Clareamento Dental',
    description: 'Clareamento em consultório, sessão única.',
    category: 'estetico',
    priceCents: 90000,
    durationMin: 60,
    bufferMin: 15,
    active: true,
    priceOverrides: {},
    comboOf: [],
    weight: 0.12,
  },
  {
    id: 's5',
    name: 'Extração Simples',
    description: 'Extração de dente sem indicação cirúrgica.',
    category: 'cirurgico',
    priceCents: 35000,
    durationMin: 40,
    bufferMin: 10,
    active: true,
    priceOverrides: {},
    comboOf: [],
    weight: 0.13,
  },
  {
    id: 's6',
    name: 'Tratamento de Canal',
    description: 'Endodontia completa. Exige avaliação prévia por imagem.',
    category: 'cirurgico',
    priceCents: 120000,
    durationMin: 90,
    bufferMin: 15,
    active: true,
    priceOverrides: { p1: 140000 },
    comboOf: [],
    weight: 0.15,
  },
  {
    id: 's7',
    name: 'Avaliação + Limpeza',
    description: 'O combo mais pedido para quem não vem há mais de um ano.',
    category: 'combo',
    priceCents: 24000,
    durationMin: 65,
    bufferMin: 10,
    active: true,
    priceOverrides: {},
    comboOf: ['s1', 's2'],
    weight: 0,
  },
  {
    id: 's8',
    name: 'Clareamento a Laser',
    description: 'Sessão com fonte de luz — aguardando equipamento novo.',
    category: 'estetico',
    priceCents: 150000,
    durationMin: 75,
    bufferMin: 15,
    active: false,
    priceOverrides: {},
    comboOf: [],
    weight: 0,
  },
];

/* ==========================================================================
   EQUIPE
   ========================================================================= */

const FULL_WEEK = (start: string, end: string, breakStart?: string, breakEnd?: string) =>
  [null, ...Array.from({ length: 5 }, () => ({ start, end, breakStart, breakEnd })), { start, end }] as ProfessionalRecord['schedule'];

export const PROFESSIONAL_SEED: ProfessionalRecord[] = [
  {
    id: 'p1',
    name: 'Camila Vasconcelos',
    role: 'Cirurgiã-dentista · Endodontia',
    email: 'camila@prodent.clinic',
    phone: '(11) 98812-4471',
    hiredAt: '2021-03-15',
    active: true,
    rating: 4.9,
    hue: 190,
    photoPath: null,
    serviceCommissionPct: 45,
    productCommissionPct: 10,
    schedule: FULL_WEEK('08:00', '17:00', '12:00', '13:00'),
    serviceIds: [],
  },
  {
    id: 'p2',
    name: 'Felipe Andrade',
    role: 'Cirurgião-dentista',
    email: 'felipe@prodent.clinic',
    phone: '(11) 99145-3320',
    hiredAt: '2022-07-04',
    active: true,
    rating: 4.8,
    hue: 205,
    photoPath: null,
    serviceCommissionPct: 40,
    productCommissionPct: 8,
    schedule: FULL_WEEK('09:00', '18:00', '13:00', '14:00'),
    serviceIds: [],
  },
  {
    id: 'p3',
    name: 'Juliana Mattos',
    role: 'Ortodontista',
    email: 'juliana@prodent.clinic',
    phone: '(11) 99730-1188',
    hiredAt: '2023-01-20',
    active: true,
    rating: 4.7,
    hue: 172,
    photoPath: null,
    serviceCommissionPct: 50,
    productCommissionPct: 12,
    schedule: FULL_WEEK('10:00', '19:00', '14:00', '15:00'),
    serviceIds: ['s1', 's3', 's4', 's6'],
  },
  {
    id: 'p4',
    name: 'Renato Souza',
    role: 'Cirurgião-dentista',
    email: 'renato@prodent.clinic',
    phone: '(11) 98004-7752',
    hiredAt: '2024-05-02',
    active: true,
    rating: 4.6,
    hue: 220,
    photoPath: null,
    serviceCommissionPct: 38,
    productCommissionPct: 8,
    schedule: [null, null, ...Array.from({ length: 4 }, () => ({ start: '12:00', end: '20:00' })), { start: '09:00', end: '18:00' }],
    serviceIds: [],
  },
  {
    id: 'p5',
    name: 'Beatriz Nunes',
    role: 'Higienista bucal',
    email: 'beatriz@prodent.clinic',
    phone: '(11) 97441-9063',
    hiredAt: '2025-11-10',
    active: false,
    rating: 4.4,
    hue: 236,
    photoPath: null,
    serviceCommissionPct: 32,
    productCommissionPct: 6,
    schedule: [null, null, null, null, null, null, null],
    serviceIds: ['s1', 's2'],
  },
];

/** Status ao vivo da vitrine — o dia corrente é o único com estado real. */
export const LIVE_STATUS: Record<string, Professional['status']> = {
  p1: 'atendendo',
  p2: 'disponivel',
  p3: 'descanso',
  p4: 'offline',
  p5: 'offline',
};

/* ==========================================================================
   PACIENTES
   Gerados a partir de uma semente fixa: 84 fichas estáveis entre recargas,
   entre sessões e entre módulos.
   ========================================================================= */

const FIRST_NAMES = [
  'João', 'Carlos', 'Pedro', 'Lucas', 'Rafael', 'Bruno', 'Felipe', 'Gustavo',
  'Matheus', 'Vinícius', 'Eduardo', 'Ricardo', 'André', 'Fábio', 'Leandro',
  'Otávio', 'Sérgio', 'Danilo', 'Márcio', 'Renan', 'Caio', 'Igor', 'Murilo',
  'Rodrigo', 'Tiago', 'Wesley', 'Alan', 'Douglas', 'Henrique', 'Ismael',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Ferreira', 'Almeida', 'Carvalho', 'Andrade',
  'Lima', 'Cardoso', 'Barros', 'Freitas', 'Menezes', 'Tavares', 'Moreira',
  'Pinto', 'Ramos', 'Batista', 'Correia', 'Peixoto', 'Duarte', 'Nogueira',
  'Rezende', 'Sampaio', 'Fontes',
];

export const CLIENT_TAGS = [
  'fiel',
  'convênio',
  'particular',
  'indicação',
  'primeira vez',
  'ansioso',
  'ortodontia',
  'sempre atrasa',
] as const;

function buildClients(): ClientRecord[] {
  const rnd = seeded('patients-v1');

  // Pares nome+sobrenome únicos, embaralhados uma vez só.
  const pairs: Array<[string, string]> = [];
  for (const first of FIRST_NAMES) for (const last of LAST_NAMES) pairs.push([first, last]);

  const today = new Date();

  return shuffle(rnd, pairs)
    .slice(0, 84)
    .map(([first, last], i) => {
      const id = `c${`${i + 1}`.padStart(3, '0')}`;
      const r = seeded(`patient-${id}`);

      const createdDaysAgo = intBetween(r, 20, 1080);
      const created = new Date(today);
      created.setDate(created.getDate() - createdDaysAgo);

      const tagCount = r() > 0.55 ? intBetween(r, 1, 3) : 0;
      const tags = shuffle(r, CLIENT_TAGS).slice(0, tagCount);

      const hasBirth = r() > 0.3;
      const birthYear = intBetween(r, 1972, 2006);
      const birthMonth = intBetween(r, 1, 12);
      const birthDay = intBetween(r, 1, 28);

      return {
        id,
        name: `${first} ${last}`,
        phone: `(11) 9${intBetween(r, 4000, 9999)}-${`${intBetween(r, 0, 9999)}`.padStart(4, '0')}`,
        email: `${deburr(`${first}.${last}`).toLowerCase()}@email.com`,
        birthDate: hasBirth
          ? `${birthYear}-${`${birthMonth}`.padStart(2, '0')}-${`${birthDay}`.padStart(2, '0')}`
          : null,
        tags,
        notes: '',
        createdAt: created.toISOString(),
        preferredProfessionalId:
          r() > 0.45 ? pick(r, PROFESSIONAL_SEED.filter((p) => p.active)).id : null,
        active: true,
      } satisfies ClientRecord;
    });
}

export const CLIENT_SEED: ClientRecord[] = buildClients();

/** Nomes na ordem das fichas — o gerador de agenda sorteia daqui. */
export const CLIENT_POOL = CLIENT_SEED.map((c) => c.name);

/* ==========================================================================
   ITENS DE CONSULTÓRIO
   ========================================================================= */

export const PRODUCT_SEED: ProductRecord[] = [
  { id: 'i1', name: 'Luva de Procedimento (P)', brand: 'Descarpack', sku: 'DP-LUV-P100', category: 'descartavel', qty: 18, min: 10, capacity: 30, unit: 'cx.', costCents: 2200, priceCents: 0, active: true },
  { id: 'i2', name: 'Resina Composta Fotopolimerizável', brand: 'FGM', sku: 'FGM-RES-A2', category: 'material', qty: 7, min: 8, capacity: 20, unit: 'un.', costCents: 8900, priceCents: 0, active: true },
  { id: 'i3', name: 'Anestésico Odontológico (Lidocaína)', brand: 'DFL', sku: 'DFL-ANE-050', category: 'medicamento', qty: 22, min: 15, capacity: 50, unit: 'cx.', costCents: 6500, priceCents: 0, active: true },
  { id: 'i4', name: 'Sugador Descartável', brand: 'Maquira', sku: 'MQ-SUG-040', category: 'descartavel', qty: 5, min: 10, capacity: 30, unit: 'pct.', costCents: 1400, priceCents: 0, active: true },
  { id: 'i5', name: 'Kit Broca Diamantada', brand: 'KG Sorensen', sku: 'KG-BRO-K12', category: 'instrumental', qty: 14, min: 6, capacity: 20, unit: 'un.', costCents: 12000, priceCents: 0, active: true },
  { id: 'i6', name: 'Fio de Sutura', brand: 'Ethicon', sku: 'ET-FIO-030', category: 'material', qty: 20, min: 10, capacity: 40, unit: 'cx.', costCents: 4200, priceCents: 0, active: true },
  { id: 'i7', name: 'Máscara Cirúrgica', brand: 'Descarpack', sku: 'DP-MSC-050', category: 'protecao', qty: 240, min: 100, capacity: 500, unit: 'un.', costCents: 45, priceCents: 0, active: true },
  { id: 'i8', name: 'Avental Descartável (TNT)', brand: 'Vestcirúrgica', sku: 'VC-AVE-100', category: 'protecao', qty: 55, min: 80, capacity: 300, unit: 'un.', costCents: 90, priceCents: 0, active: true },
  { id: 'i9', name: 'Gel Clareador', brand: 'Whiteness', sku: 'WH-GEL-035', category: 'material', qty: 9, min: 6, capacity: 20, unit: 'un.', costCents: 5800, priceCents: 0, active: true },
  { id: 'i10', name: 'Óculos de Proteção', brand: 'Kalipso', sku: 'KL-OCU-001', category: 'protecao', qty: 12, min: 5, capacity: 25, unit: 'un.', costCents: 1600, priceCents: 0, active: true },
];

/* ==========================================================================
   PROJEÇÕES PARA O DASHBOARD
   O painel continua recebendo `Professional` e `Product`; a ficha completa fica
   nos módulos. Uma fonte só, duas leituras.
   ========================================================================= */

export function shiftLabel(schedule: ProfessionalRecord['schedule']) {
  const working = schedule.find(Boolean);
  return working ? `${working.start} — ${working.end}` : 'Sem escala';
}

export function toProfessional(record: ProfessionalRecord): Professional {
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    status: record.active ? (LIVE_STATUS[record.id] ?? 'disponivel') : 'offline',
    shift: shiftLabel(record.schedule),
    appointmentsToday: 0,
    rating: record.rating,
    hue: record.hue,
  };
}

export function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    name: record.name,
    qty: record.qty,
    min: record.min,
    capacity: record.capacity,
    unit: record.unit,
  };
}

/* ==========================================================================
   CONFIGURAÇÕES PADRÃO
   ========================================================================= */

const WEEKDAY_HOURS = { closed: false, open: '08:00', close: '19:00' };

export const DEFAULT_SETTINGS: ShopSettings = {
  name: 'Clínica OdontoVida',
  document: '21.774.309/0001-52',
  phone: '(11) 3255-8890',
  email: 'contato@odontovida.com.br',
  // O modo demonstração não tem storage: o envio de imagem exige Supabase.
  logoPath: null,
  address: {
    street: 'Rua Augusta',
    number: '1421',
    district: 'Consolação',
    city: 'São Paulo',
    state: 'SP',
    zip: '01305-100',
  },
  hours: [
    { closed: true, open: '08:00', close: '19:00' },
    { ...WEEKDAY_HOURS },
    { ...WEEKDAY_HOURS },
    { ...WEEKDAY_HOURS },
    { ...WEEKDAY_HOURS },
    { closed: false, open: '08:00', close: '17:00' },
    { closed: true, open: '08:00', close: '12:00' },
  ],
  holidays: [],
  booking: {
    slotMinutes: 30,
    minAdvanceHours: 4,
    maxAdvanceDays: 60,
    cancelWindowHours: 12,
    allowOverbooking: false,
    noShowFeePct: 0,
  },
  notifications: {
    emailConfirmation: true,
    emailReminder: true,
    whatsappConfirmation: true,
    whatsappReminder: true,
    reminderHoursBefore: 24,
    marketingOptIn: false,
  },
};

/* ==========================================================================
   AGENDA DE VITRINE
   ========================================================================= */

/** Agenda canônica do dia corrente — os dados de vitrine do sistema. */
export const TODAY_APPOINTMENTS = [
  { time: '09:00', clientId: 'c001', services: ['Consulta de Avaliação', 'Limpeza (Profilaxia)'], serviceIds: ['s1', 's2'], professionalId: 'p1', status: 'concluido' as const, priceCents: 27000, durationMin: 70 },
  { time: '10:30', clientId: 'c002', services: ['Restauração em Resina'], serviceIds: ['s3'], professionalId: 'p2', status: 'em_andamento' as const, priceCents: 25000, durationMin: 50 },
  { time: '11:30', clientId: 'c003', services: ['Consulta de Avaliação', 'Tratamento de Canal'], serviceIds: ['s1', 's6'], professionalId: 'p1', status: 'agendado' as const, priceCents: 132000, durationMin: 120 },
  { time: '14:00', clientId: 'c004', services: ['Extração Simples'], serviceIds: ['s5'], professionalId: 'p3', status: 'agendado' as const, priceCents: 35000, durationMin: 40 },
  { time: '15:30', clientId: 'c005', services: ['Consulta de Avaliação', 'Limpeza (Profilaxia)'], serviceIds: ['s1', 's2'], professionalId: 'p2', status: 'agendado' as const, priceCents: 27000, durationMin: 70 },
];

export const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30',
];

/** Telemetria decorativa do rodapé — some sozinha nos temas com `chrome` baixo. */
export const SYSTEM_CHANNELS = [
  { label: 'SISTEMA ONLINE', tone: 'ok' as const },
  { label: 'BANCO CONECTADO', tone: 'ok' as const },
  { label: 'SEGURANÇA ATIVA', tone: 'ok' as const },
  { label: 'SINCRONIZAÇÃO 100%', tone: 'ok' as const },
  { label: 'REDE ATIVA', tone: 'ok' as const },
];
