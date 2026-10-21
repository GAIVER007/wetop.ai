/**
 * Переезд каналов с Exely на Channex идёт по одному каналу (CUTOVER.md «Чеклист канала», Q-034, Q-086).
 * Здесь — чистая часть отчёта по каналу: справочник псевдонимов, сравнение множеств номеров броней
 * PMS ↔ Exely, итоги и разметка отчёта. Без БД и без сети; вся работа с источниками — в cli-cutover-channel.ts.
 * Без персональных данных: номера броней, даты, категории, суммы.
 */

export interface ChannelSpec {
  alias: string;
  /** Имя канала в Exely — так оно лежит в `reservations.channel` у перенесённых броней */
  exelyName: string;
  /** `ota_name` в Channex — так оно лежит в `reservations.channel` у броней, принятых от Channex */
  channexOtaName: string;
  /** Другие написания того же канала, встреченные живьём (staging Channex) */
  otherNames: readonly string[];
  /** Channex подтягивает старые брони этого канала при подключении (ответ Channex 11.09.2026) */
  pullsHistory: boolean;
}

/** Псевдоним → имена канала. Сравнение имён везде без учёта регистра. */
export const CHANNELS: readonly ChannelSpec[] = [
  {
    alias: 'booking',
    exelyName: 'booking.com',
    channexOtaName: 'Booking.com',
    otherNames: [],
    pullsHistory: true,
  },
  {
    alias: 'trip',
    exelyName: 'Trip.com Group',
    channexOtaName: 'Ctrip',
    otherNames: [],
    pullsHistory: true,
  },
  {
    alias: 'expedia',
    exelyName: 'Expedia/Hotels.com',
    channexOtaName: 'Expedia',
    otherNames: [],
    pullsHistory: true,
  },
  {
    alias: 'agoda',
    exelyName: 'Agoda',
    channexOtaName: 'Agoda',
    otherNames: [],
    pullsHistory: false,
  },
  {
    alias: 'hostelworld',
    exelyName: 'Hostelworld',
    channexOtaName: 'Hostelworld',
    // staging Channex 11.09.2026 прислал бронь с ota_name «Hostelworld Group»
    otherNames: ['Hostelworld Group'],
    pullsHistory: false,
  },
  {
    alias: 'ostrovok',
    exelyName: 'Ostrovok.ru (Emerging Travel Group)',
    channexOtaName: 'Ostrovok',
    otherNames: [],
    pullsHistory: false,
  },
];

export function channelByAlias(alias: string): ChannelSpec | undefined {
  const a = alias.trim().toLowerCase();
  return CHANNELS.find((c) => c.alias === a);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Все написания канала (Exely, Channex, встреченные варианты) */
export function channelNames(spec: ChannelSpec): string[] {
  return [spec.exelyName, spec.channexOtaName, ...spec.otherNames];
}

/** Имя канала из БД или карточки Exely относится к этому каналу? Без учёта регистра и краевых пробелов. */
export function isChannelName(name: string | null | undefined, spec: ChannelSpec): boolean {
  if (!name) return false;
  const n = norm(name);
  return channelNames(spec).some((x) => norm(x) === n);
}

/** Ночей между двумя датами YYYY-MM-DD (по календарю объекта, без часовых поясов) */
export function nightsBetween(arrival: string, departure: string): number {
  const ms = Date.UTC(+arrival.slice(0, 4), +arrival.slice(5, 7) - 1, +arrival.slice(8, 10));
  const me = Date.UTC(+departure.slice(0, 4), +departure.slice(5, 7) - 1, +departure.slice(8, 10));
  return Math.round((me - ms) / 86_400_000);
}

/** Одно живое будущее проживание канала в PMS */
export interface CutoverStay {
  /** Номер брони в PMS (для перенесённых из Exely — совпадает с номером брони Exely) */
  number: string;
  arrival: string;
  departure: string;
  /** Код категории */
  category: string;
  /** Коды ячеек по назначениям (через «/», если переселяли); null — назначений нет */
  unit: string | null;
  /** Назначения покрывают все ночи проживания (иначе на шахматке дыра — считается «без ячейки») */
  unitCovered: boolean;
  /** У брони есть номер брони на стороне канала (external_id) */
  hasExternalId: boolean;
  /** На счёте проживания есть платёж EXTERNAL (предоплата площадки или перенесённая оплата Exely) */
  hasPrepayment: boolean;
  /** Цена проживания, тиын */
  priceMinor: bigint;
  /** К оплате по счёту = активные начисления − распределённые платежи + возвраты, тиын */
  dueMinor: bigint;
}

export interface CutoverTotals {
  reservations: number;
  stays: number;
  nights: number;
  amountMinor: bigint;
  withUnit: number;
  withoutUnit: number;
  withExternalId: number;
  withoutExternalId: number;
  withPrepayment: number;
  withoutPrepayment: number;
}

/** Итоги по проживаниям PMS: ячейка и предоплата считаются по проживаниям, номер канала — по броням. */
export function summarizeStays(stays: readonly CutoverStay[]): CutoverTotals {
  const byNumber = new Map<string, boolean>();
  for (const s of stays)
    byNumber.set(s.number, (byNumber.get(s.number) ?? false) || s.hasExternalId);
  const withUnit = stays.filter((s) => s.unit !== null && s.unitCovered).length;
  const withPrepayment = stays.filter((s) => s.hasPrepayment).length;
  const withExternalId = [...byNumber.values()].filter(Boolean).length;
  return {
    reservations: byNumber.size,
    stays: stays.length,
    nights: stays.reduce((a, s) => a + nightsBetween(s.arrival, s.departure), 0),
    amountMinor: stays.reduce((a, s) => a + s.priceMinor, 0n),
    withUnit,
    withoutUnit: stays.length - withUnit,
    withExternalId,
    withoutExternalId: byNumber.size - withExternalId,
    withPrepayment,
    withoutPrepayment: stays.length - withPrepayment,
  };
}

/** Что известно о будущих бронях канала со стороны Exely (только номера и счётчики) */
export interface ExelySide {
  numbers: string[];
  stays: number;
  nights: number;
  amountMinor: bigint;
}

/** Минимум от нормализованной брони Exely (`ReservationImportRecord`), нужный для отбора */
export interface ExelyRecordLike {
  confirmationNumber: string;
  channel: string | null;
  items: ReadonlyArray<{
    arrivalDate: string;
    departureDate: string;
    status: string;
    priceMinor: bigint;
  }>;
}

const LIVE_STAY = (status: string) => status !== 'CANCELLED' && status !== 'NO_SHOW';

/**
 * Будущие брони канала из карточек Exely: имя канала без учёта регистра, живое проживание
 * (не отменено, не незаезд) с выездом позже сегодняшнего дня — то же определение, что и для PMS.
 */
export function selectExelyFuture(
  records: readonly ExelyRecordLike[],
  spec: ChannelSpec,
  today: string,
): ExelySide {
  const out: ExelySide = { numbers: [], stays: 0, nights: 0, amountMinor: 0n };
  for (const r of records) {
    if (!isChannelName(r.channel, spec)) continue;
    const live = r.items.filter((it) => LIVE_STAY(it.status) && it.departureDate > today);
    if (!live.length) continue;
    out.numbers.push(r.confirmationNumber);
    out.stays += live.length;
    for (const it of live) {
      out.nights += nightsBetween(it.arrivalDate, it.departureDate);
      out.amountMinor += it.priceMinor;
    }
  }
  out.numbers.sort();
  return out;
}

export interface NumbersComparison {
  common: string[];
  onlyExely: string[];
  onlyPms: string[];
  /** Брони PMS без номера Exely (от Channex или со стойки) — в Exely их нет, в сравнении не участвуют */
  bornOutsideExely: string[];
  /** Число уникальных номеров Exely-происхождения совпадает */
  countMatches: boolean;
  /** Множества номеров совпадают (строже, чем число) */
  setsMatch: boolean;
}

/**
 * Брони, рождённые не в Exely: принятые от Channex (номер = `unique_id` вида `BDC-…`, `HWL-PRB-…`)
 * или созданные на стойке PMS (`YYYYMMDD-XXXXXX`). Номер Exely — `YYYYMMDD-<объект>-<id>`.
 */
export const NON_EXELY_NUMBER = /^(?:[A-Z]{2,4}-|\d{8}-[A-Z0-9]{6}$)/;
export const isExelyNumber = (n: string): boolean => !NON_EXELY_NUMBER.test(n);

/**
 * Множества номеров броней PMS и Exely: общие, только в Exely, только в PMS. Дубли внутри стороны не считаются.
 * Брони PMS с не-Exely номером (приняты от Channex после переезда или созданы на стойке) в сравнение не входят:
 * в Exely их нет по определению — они считаются отдельно в `bornOutsideExely`.
 */
export function compareNumbers(pms: Iterable<string>, exely: Iterable<string>): NumbersComparison {
  const all = [...new Set(pms)];
  const bornOutsideExely = all.filter((n) => !isExelyNumber(n)).sort();
  const p = new Set(all.filter(isExelyNumber));
  const e = new Set(exely);
  const common = [...p].filter((n) => e.has(n)).sort();
  const onlyPms = [...p].filter((n) => !e.has(n)).sort();
  const onlyExely = [...e].filter((n) => !p.has(n)).sort();
  return {
    common,
    onlyExely,
    onlyPms,
    bornOutsideExely,
    countMatches: p.size === e.size,
    setsMatch: onlyPms.length === 0 && onlyExely.length === 0,
  };
}

/** Целые тенге из тиынов (minor/100), с разделителем тысяч; цены объекта — целые тенге, остатка нет */
export function tenge(minor: bigint): string {
  const neg = minor < 0n;
  const whole = ((neg ? -minor : minor) / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${neg ? '−' : ''}${whole}`;
}

export interface Readiness {
  countMatches: boolean;
  setsMatch: boolean;
  allWithUnit: boolean;
  prepaid: number;
  prepaidOf: number;
  /** Код выхода 0: число сходится (и состав совпадает) и все проживания с ячейкой */
  ok: boolean;
}

export function readiness(totals: CutoverTotals, cmp: NumbersComparison): Readiness {
  const allWithUnit = totals.withoutUnit === 0;
  return {
    countMatches: cmp.countMatches,
    setsMatch: cmp.setsMatch,
    allWithUnit,
    prepaid: totals.withPrepayment,
    prepaidOf: totals.stays,
    ok: cmp.countMatches && cmp.setsMatch && allWithUnit,
  };
}

export interface CutoverReportInput {
  channel: ChannelSpec;
  /** Сегодня по Алматы, YYYY-MM-DD */
  today: string;
  /** Момент снятия, для шапки */
  takenAt: string;
  stays: readonly CutoverStay[];
  exely: ExelySide;
  /** Номера карточек Exely, которые не удалось разобрать (в сверку не вошли) */
  unparsedExely: readonly string[];
}

const yesNo = (b: boolean) => (b ? 'да' : 'нет');
const LIST_CAP = 60;
const list = (items: readonly string[]): string[] => [
  ...items.slice(0, LIST_CAP).map((n) => `- ${n}`),
  ...(items.length > LIST_CAP ? [`…и ещё ${items.length - LIST_CAP}.`] : []),
];

/** Отчёт `reports/cutover-<псевдоним>-<дата>.md` */
export function renderCutoverReport(input: CutoverReportInput): string {
  const { channel, stays, exely } = input;
  const t = summarizeStays(stays);
  const cmp = compareNumbers(
    stays.map((s) => s.number),
    exely.numbers,
  );
  const r = readiness(t, cmp);
  const exelyReservations = new Set(exely.numbers).size;
  const row = (label: string, pms: number | bigint, ex: number | bigint) =>
    typeof pms === 'bigint' && typeof ex === 'bigint'
      ? `| ${label} | ${tenge(pms)} | ${tenge(ex)} | ${tenge(pms - ex)} |`
      : `| ${label} | ${pms} | ${ex} | ${Number(pms) - Number(ex)} |`;
  const sorted = [...stays].sort(
    (a, b) => a.arrival.localeCompare(b.arrival) || a.number.localeCompare(b.number),
  );
  const lines: string[] = [
    `# Переезд канала: ${channel.alias} — ${input.today}`,
    '',
    `Канал: Exely «${channel.exelyName}», Channex «${channel.channexOtaName}»` +
      (channel.otherNames.length ? ` (также «${channel.otherNames.join('», «')}»)` : '') +
      `. Подтяжка старых броней Channex: ${yesNo(channel.pullsHistory)}.`,
    `Снято: ${input.takenAt}. Сегодня по Алматы: ${input.today}. Exely — только чтение, без ПД: номера броней, даты, категории, суммы.`,
    'Будущая бронь — есть живое проживание (не отменено, не незаезд) с выездом позже сегодняшнего дня; брони автотестов исключены.',
    'Закрывает пункты чеклиста CUTOVER.md: «Number of future reservations in Exely», «Future reservations exported»,',
    '«Future bookings imported», «Duplicate check passed», «Reservation count matches».',
    '',
    '## Итоги',
    '',
    '| Показатель | PMS | Exely | Разница |',
    '|---|---:|---:|---:|',
    row('Броней', t.reservations, exelyReservations),
    row('Проживаний', t.stays, exely.stays),
    row('Ночей', t.nights, exely.nights),
    row('Сумма, ₸', t.amountMinor, exely.amountMinor),
    '',
    '| Показатель PMS | Есть | Нет |',
    '|---|---:|---:|',
    `| Ячейка на все ночи (проживания) | ${t.withUnit} | ${t.withoutUnit} |`,
    `| Номер брони канала, external_id (брони) | ${t.withExternalId} | ${t.withoutExternalId} |`,
    `| Предоплата площадки — платёж EXTERNAL на счёте (проживания) | ${t.withPrepayment} | ${t.withoutPrepayment} |`,
    '',
    `## Брони в PMS — ${t.reservations} (проживаний ${t.stays})`,
    '',
    '| Бронь | Заезд | Выезд | Категория | Ячейка | Номер канала | Предоплата | К оплате, ₸ |',
    '|---|---|---|---|---|---|---|---:|',
    ...sorted.map(
      (s) =>
        `| ${s.number} | ${s.arrival} | ${s.departure} | ${s.category} | ${
          s.unit === null ? '—' : s.unitCovered ? s.unit : `${s.unit} (не все ночи)`
        } | ${yesNo(s.hasExternalId)} | ${yesNo(s.hasPrepayment)} | ${tenge(s.dueMinor)} |`,
    ),
    '',
    '## Сверка с Exely',
    '',
    `Номеров броней: PMS ${t.reservations}, Exely ${exelyReservations}. Общих: **${cmp.common.length}**. ` +
      `Только в Exely: **${cmp.onlyExely.length}**. Только в PMS: **${cmp.onlyPms.length}**.` +
      (cmp.bornOutsideExely.length
        ? ` Рождены не в Exely (от Channex или со стойки), в сравнение не входят: **${cmp.bornOutsideExely.length}**.`
        : ''),
    '',
  ];
  if (cmp.bornOutsideExely.length)
    lines.push('Рождены не в Exely:', '', ...list(cmp.bornOutsideExely), '');
  if (cmp.onlyExely.length)
    lines.push(
      'Только в Exely — не перенесены (созданы или изменены после последнего переноса). Подтянуть:',
      '`npx tsx scripts/imports/src/cli-sync-day.ts <дата заезда> --since=<дата последнего переноса>`',
      '',
      ...list(cmp.onlyExely),
      '',
    );
  if (cmp.onlyPms.length)
    lines.push(
      'Только в PMS — в Exely на будущее не активны (отменены, сокращены или приняты уже от Channex, не от Exely):',
      '',
      ...list(cmp.onlyPms),
      '',
    );
  if (input.unparsedExely.length)
    lines.push(
      `Карточек Exely не разобрано: **${input.unparsedExely.length}** (в сверку не вошли, разобрать вручную):`,
      '',
      ...list(input.unparsedExely),
      '',
    );
  lines.push(
    '## Готовность',
    '',
    `- число сходится: **${yesNo(r.countMatches)}** (PMS ${t.reservations} / Exely ${exelyReservations})`,
    `- состав номеров совпадает: **${yesNo(r.setsMatch)}**`,
    `- все с ячейкой: **${yesNo(r.allWithUnit)}**` +
      (r.allWithUnit ? '' : ` (без ячейки проживаний: ${t.withoutUnit})`),
    `- предоплата проставлена у ${r.prepaid} из ${r.prepaidOf} проживаний`,
    `- номер брони канала есть у ${t.withExternalId} из ${t.reservations} броней` +
      (channel.pullsHistory
        ? ' (Channex подтянет старые брони; входящая обработка проставит unique_id)'
        : ' (Channex старые брони не подтягивает — вести вручную до выезда последней, CUTOVER.md Q-034)'),
    '',
    `RESULT: ${r.ok ? 'OK — число сходится, все проживания с ячейкой' : 'FAIL — см. «Готовность»'}`,
    '',
  );
  return lines.join('\n');
}
