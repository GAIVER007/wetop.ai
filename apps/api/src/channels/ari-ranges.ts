/**
 * Какие ночи уходят в канал после изменения брони — только те, где поменялся остаток категории.
 *
 * Сертификация Channex, §13 «Update Logic»: «We require partners to only send changes to availability and prices».
 * До 02.10.2026 бронь отправляла весь охват «старые даты + новые даты»: перенос на неделю 15.12 → 22.12 уносил
 * в канал и 16–21.12, остаток которых не менялся (live-тест, задача 5577ce76). Команды стойки шлют разницу
 * «было → стало» по числу мест, которые бронь держит в категории на каждую ночь (`changedNightRanges`). Ревизии
 * канала — все ночи брони до и после ревизии (`stayNightRanges`): их Channex меняет у себя сам. Ночи между
 * старыми и новыми датами не уходят ни там, ни там.
 */

/** Ночи категории [from, toExclusive), на которых изменился остаток */
export interface AriRange {
  categoryCode: string;
  from: string;
  toExclusive: string;
}

/** Проживание как его считает остаток канала: категория, ночи [arrivalDate, departureDate), статус */
export interface StaySpan {
  categoryCode: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
}

/** Проживания в этих статусах место не держат — как в `soldItems` (channels.repository) */
const NOT_SOLD: ReadonlySet<string> = new Set(['CANCELLED', 'NO_SHOW']);

const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Ночи [from, toExclusive) по порядку; пусто, если отрезок пуст или даты неверны */
export function nightsOf(from: string, toExclusive: string): string[] {
  const n = (Date.parse(`${toExclusive}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(n) || n <= 0) return [];
  return Array.from({ length: n }, (_, i) => plusDays(from, i));
}

/** Сколько мест держат проживания: категория → ночь → число */
function heldPlaces(stays: StaySpan[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of stays) {
    if (NOT_SOLD.has(s.status)) continue;
    let perNight = out.get(s.categoryCode);
    if (!perNight) out.set(s.categoryCode, (perNight = new Map()));
    for (const d of nightsOf(s.arrivalDate, s.departureDate))
      perNight.set(d, (perNight.get(d) ?? 0) + 1);
  }
  return out;
}

/** Ночи категории по порядку → отрезки: соседние ночи склеиваются, через разрыв — нет */
function appendRanges(out: AriRange[], categoryCode: string, sortedNights: string[]): void {
  for (const d of sortedNights) {
    const last = out[out.length - 1];
    if (last && last.categoryCode === categoryCode && last.toExclusive === d)
      last.toExclusive = plusDays(d, 1);
    else out.push({ categoryCode, from: d, toExclusive: plusDays(d, 1) });
  }
}

/**
 * Ночи, на которых у брони поменялось число занятых мест категории: было → стало. Соседние ночи склеены
 * в отрезок; порядок — по коду категории, внутри — по датам. Пусто — остаток не менялся, слать нечего.
 */
export function changedNightRanges(before: StaySpan[], after: StaySpan[]): AriRange[] {
  const was = heldPlaces(before);
  const now = heldPlaces(after);
  const out: AriRange[] = [];
  for (const code of [...new Set([...was.keys(), ...now.keys()])].sort()) {
    const a = was.get(code) ?? new Map<string, number>();
    const b = now.get(code) ?? new Map<string, number>();
    const changed = [...new Set([...a.keys(), ...b.keys()])]
      .filter((d) => (a.get(d) ?? 0) !== (b.get(d) ?? 0))
      .sort();
    appendRanges(out, code, changed);
  }
  return out;
}

/**
 * Все ночи проживаний в любом статусе — по категориям, отрезками; ночи между проживаниями не входят.
 * Для ревизий канала: по новой брони Channex сам закрывает место (`allow_availability_autoupdate_on_confirmation`,
 * setup-plan.ts), а по изменению и отмене остаток считает только PMS, и стойка могла отразить то же изменение
 * раньше. Тогда разница PMS пуста, а число в канале уже другое: ему возвращаются числа PMS на все ночи брони,
 * прежние, новые и отменённые. Так верно при любых настройках объекта в Channex.
 */
export function stayNightRanges(stays: StaySpan[]): AriRange[] {
  const byCategory = new Map<string, Set<string>>();
  for (const s of stays) {
    let nights = byCategory.get(s.categoryCode);
    if (!nights) byCategory.set(s.categoryCode, (nights = new Set()));
    for (const d of nightsOf(s.arrivalDate, s.departureDate)) nights.add(d);
  }
  const out: AriRange[] = [];
  for (const code of [...byCategory.keys()].sort())
    appendRanges(out, code, [...byCategory.get(code)!].sort());
  return out;
}

/** Охват отрезков: категории и окно — для журнала, следа потерянной дельты и получателей без отрезков */
export function envelopeOf(
  ranges: AriRange[],
): { categoryCodes: string[]; from: string; toExclusive: string } | null {
  if (ranges.length === 0) return null;
  return {
    categoryCodes: [...new Set(ranges.map((r) => r.categoryCode))].sort(),
    from: ranges.reduce((m, r) => (r.from < m ? r.from : m), ranges[0]!.from),
    toExclusive: ranges.reduce(
      (m, r) => (r.toExclusive > m ? r.toExclusive : m),
      ranges[0]!.toExclusive,
    ),
  };
}

/** Проживания карточки брони (стойка, канал) как отрезки ночей; нет карточки — нет проживаний */
export function cardStays(
  card: {
    items: Array<{
      accommodationTypeCode: string;
      arrivalDate: string;
      departureDate: string;
      status: string;
    }>;
  } | null,
): StaySpan[] {
  return (card?.items ?? []).map((i) => ({
    categoryCode: i.accommodationTypeCode,
    arrivalDate: i.arrivalDate,
    departureDate: i.departureDate,
    status: i.status,
  }));
}

/** Дельта доступности по разнице «было → стало»: охват и отрезки; null — остаток не менялся */
export function stayDelta(
  before: StaySpan[],
  after: StaySpan[],
): { categoryCodes: string[]; from: string; toExclusive: string; ranges: AriRange[] } | null {
  const ranges = changedNightRanges(before, after);
  const envelope = envelopeOf(ranges);
  return envelope && { ...envelope, ranges };
}
