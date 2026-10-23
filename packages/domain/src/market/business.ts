/**
 * Загрузка конкурентов салона и ресторана (DATA_MODEL §60, миграция 150; план
 * `plans/2026-10-23-competitors-business-manual.md`, проба `reports/2026-10-23-competitor-platform-probe.md`).
 * У гостиницы ключ — ночь и процент загрузки (§23); здесь день и уровень «нет мест / мало мест / есть места» по
 * свободным окнам записи или столам, процента площадки не показывают.
 */
import { MarketInputError } from './occupancy';
import type { AvailabilityLevel, ObservationSource } from './occupancy';

/** «Мало мест»: видимых окон или столов на день до этого числа включительно (план §60, предложение 3) */
export const FEW_SLOTS_MAX = 3;
/** Окно экрана, дней вперёд: запись и брони столов дальше двух недель почти пусты */
export const BUSINESS_MARKET_MAX_DAYS = 14;
export const BUSINESS_MARKET_MAX_COMPETITORS = 15;

export interface LocationCompetitorInput {
  name?: string;
  address?: string | null;
  distanceM?: number | null;
  url?: string | null;
  note?: string | null;
  active?: boolean;
}

const text = (raw: unknown, label: string, max: number): string | null | undefined => {
  if (raw === undefined) return undefined;
  const t = raw === null ? '' : String(raw).trim();
  if (t === '') return null;
  if (t.length > max) throw new MarketInputError(`${label}: не длиннее ${max} знаков`);
  return t;
};

/** Поля соседа из формы; при правке пустое необязательное поле снимается (null) */
export function parseLocationCompetitorInput(
  dto: Record<string, unknown>,
  mode: 'create' | 'update',
): LocationCompetitorInput {
  const out: LocationCompetitorInput = {};
  if (dto.name !== undefined || mode === 'create') {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new MarketInputError('Название конкурента обязательно');
    if (name.length > 200) throw new MarketInputError('Название: не длиннее 200 знаков');
    out.name = name;
  }
  const address = text(dto.address, 'Адрес', 300);
  if (address !== undefined) out.address = address;
  if (dto.distanceM !== undefined) {
    if (dto.distanceM === null || String(dto.distanceM).trim() === '') out.distanceM = null;
    else {
      const n = Number(String(dto.distanceM).replace(/\s/g, ''));
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000)
        throw new MarketInputError('Расстояние в метрах: целое число от нуля');
      out.distanceM = n;
    }
  }
  const url = text(dto.url, 'Ссылка', 500);
  if (url !== undefined) {
    if (url !== null && !/^https?:\/\/[^\s]+$/i.test(url))
      throw new MarketInputError('Ссылка: адрес страницы записи или брони, начинается с https://');
    out.url = url;
  }
  const note = text(dto.note, 'Заметка', 500);
  if (note !== undefined) out.note = note;
  if (dto.active !== undefined) out.active = dto.active === true;
  return out;
}

export interface SnapshotInput {
  day: string;
  level: AvailabilityLevel;
  freeSlots: number | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS: readonly AvailabilityLevel[] = ['SOLD_OUT', 'FEW_LEFT', 'AVAILABLE'];

/** Уровень по числу видимых окон или столов на день (сборщик и ручной ввод числом) */
export function levelFromSlots(freeSlots: number): AvailabilityLevel {
  if (freeSlots <= 0) return 'SOLD_OUT';
  return freeSlots <= FEW_SLOTS_MAX ? 'FEW_LEFT' : 'AVAILABLE';
}

/**
 * Снимок дня из формы: день не раньше «сегодня» филиала (`observedOn`), уровень словом или число окон; число
 * задаёт уровень, а «нет мест» с окнами — противоречие (та же проверка в базе).
 */
export function parseSnapshotInput(dto: Record<string, unknown>, observedOn: string): SnapshotInput {
  const day = String(dto.day ?? '').trim();
  if (!ISO.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)))
    throw new MarketInputError('День: дата в формате ГГГГ-ММ-ДД');
  if (day < observedOn) throw new MarketInputError('День: не раньше сегодняшнего');
  let freeSlots: number | null = null;
  if (dto.freeSlots !== undefined && dto.freeSlots !== null && String(dto.freeSlots).trim() !== '') {
    const n = Number(String(dto.freeSlots).trim());
    if (!Number.isInteger(n) || n < 0 || n > 10_000)
      throw new MarketInputError('Свободных окон или столов: целое число от нуля');
    freeSlots = n;
  }
  const raw = dto.level;
  if (raw === undefined || raw === null || raw === '') {
    if (freeSlots === null) throw new MarketInputError('Укажите уровень или число свободных окон');
    return { day, level: levelFromSlots(freeSlots), freeSlots };
  }
  if (!LEVELS.includes(raw as AvailabilityLevel))
    throw new MarketInputError('Уровень: «нет мест», «мало мест» или «есть места»');
  const level = raw as AvailabilityLevel;
  if (level === 'SOLD_OUT' && freeSlots !== null && freeSlots > 0)
    throw new MarketInputError('«Нет мест» и свободные окна вместе не бывают');
  return { day, level, freeSlots };
}

/** Площадка онлайн-записи или брони по ссылке соседа (проба 23.10.2026); иначе null: данные вносит человек */
const BUSINESS_PLATFORMS: Array<[RegExp, string]> = [
  [/(^|\.)dikidi\.(net|ru)$/, 'Dikidi'],
  [/(^|\.)yclients\.(com|ru)$/, 'YCLIENTS'],
  [/(^|\.)restoplace\.(cc|ws)$/, 'Restoplace'],
  [/(^|\.)booksy\.com$/, 'Booksy'],
];

export function businessPlatform(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return BUSINESS_PLATFORMS.find(([re]) => re.test(host))?.[1] ?? null;
}

export interface BusinessSnapshotRow {
  competitorId: string;
  day: string;
  observedOn: string;
  level: AvailabilityLevel;
  freeSlots: number | null;
  source: ObservationSource;
}

export interface BusinessCompetitorRef {
  id: string;
  name: string;
  url: string | null;
  distanceM: number | null;
}

export interface BusinessCell {
  day: string;
  level: AvailabilityLevel | null;
  freeSlots: number | null;
  source: ObservationSource | null;
  observedOn: string | null;
}

export interface BusinessMarketDay {
  day: string;
  /** соседей с данными на этот день */
  withData: number;
  /** из них «нет мест» или «мало мест» */
  tight: number;
  /** рынок почти полон: половина соседей с данными и больше «нет мест / мало мест» (§23.1, Q-MKT-LVL-2) */
  full: boolean;
}

export interface BusinessMarketBoard {
  days: string[];
  competitors: Array<BusinessCompetitorRef & { platform: string | null; cells: BusinessCell[]; lastObservedOn: string | null }>;
  market: BusinessMarketDay[];
  summary: { competitors: number; withData: number; fullDays: number; lastObservedOn: string | null };
}

/** Дни окна подряд, начиная с `from` */
export function businessMarketDays(from: string, days: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Доска «вы и рынок» по дням: на пару «сосед, день» берётся самый свежий снимок (`observedOn`), в один и тот же
 * день наблюдения ручной ввод сильнее сборщика. Чисел не придумываем: нет снимка, клетка пустая.
 */
export function buildBusinessMarketBoard(input: {
  from: string;
  days: number;
  competitors: readonly BusinessCompetitorRef[];
  snapshots: readonly BusinessSnapshotRow[];
}): BusinessMarketBoard {
  const days = businessMarketDays(input.from, input.days);
  const best = new Map<string, BusinessSnapshotRow>();
  for (const s of input.snapshots) {
    const key = `${s.competitorId}|${s.day}`;
    const cur = best.get(key);
    if (
      !cur ||
      s.observedOn > cur.observedOn ||
      (s.observedOn === cur.observedOn && s.source === 'MANUAL' && cur.source !== 'MANUAL')
    )
      best.set(key, s);
  }
  const competitors = input.competitors.map((c) => {
    const cells = days.map((day): BusinessCell => {
      const s = best.get(`${c.id}|${day}`);
      return {
        day,
        level: s?.level ?? null,
        freeSlots: s?.freeSlots ?? null,
        source: s?.source ?? null,
        observedOn: s?.observedOn ?? null,
      };
    });
    const seen = cells.map((x) => x.observedOn).filter((x): x is string => x !== null).sort();
    return { ...c, platform: businessPlatform(c.url), cells, lastObservedOn: seen.at(-1) ?? null };
  });
  const market = days.map((day, i): BusinessMarketDay => {
    const levels = competitors.map((c) => c.cells[i]!.level).filter((l): l is AvailabilityLevel => l !== null);
    const tight = levels.filter((l) => l !== 'AVAILABLE').length;
    return { day, withData: levels.length, tight, full: levels.length > 0 && tight * 2 >= levels.length };
  });
  const last = competitors.map((c) => c.lastObservedOn).filter((x): x is string => x !== null).sort();
  return {
    days,
    competitors,
    market,
    summary: {
      competitors: competitors.length,
      withData: competitors.filter((c) => c.lastObservedOn !== null).length,
      fullDays: market.filter((m) => m.full).length,
      lastObservedOn: last.at(-1) ?? null,
    },
  };
}
