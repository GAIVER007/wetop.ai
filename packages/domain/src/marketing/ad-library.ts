/**
 * «Аудитории» и «Креативы» ИИ-таргетолога (23.10.2026, пункт 5 плана вертикалей). Сводка успешных запусков филиала
 * (§57) с днями кабинета их кампаний (§53, §55): какие аудитории и какие файлы креатива дали заявки и по какой цене.
 * Новой таблицы нет: аудитория это настройки запуска, креатив это `marketing_ad_creatives`. Деньги в minor units
 * строками, разные валюты не складываются. Мастер берёт аудиторию отсюда в один клик (адрес с номером запуска).
 */
export interface AudienceSettings {
  countryCode: string;
  cities: Array<{ key: string; name: string }>;
  ageMin: number;
  ageMax: number;
  genders: number[];
  advantageAudience: boolean;
}

export interface AdLibraryLaunch {
  id: string;
  status: string;
  createdAt: string;
  currency: string;
  headline: string;
  settings: AudienceSettings;
  creative: { id: string; kind: 'IMAGE' | 'VIDEO'; fileName: string } | null;
  /** Сумма дней кабинета кампании запуска; `null`, пока дней нет */
  stats: { spendMinor: bigint; leads: number; impressions: number; clicks: number } | null;
}

interface Totals {
  currency: string;
  launches: number;
  leads: number;
  clicks: number;
  impressions: number;
  spendMinor: string;
  /** Цена заявки: расход / заявки, округление вниз; без заявок `null` */
  cplMinor: string | null;
  lastAt: string;
  lastLaunchId: string;
}

export interface AudienceRow extends Totals {
  key: string;
  label: string;
  settings: AudienceSettings;
}

export interface CreativeRow extends Totals {
  creativeId: string;
  kind: 'IMAGE' | 'VIDEO';
  fileName: string;
  /** Заголовок запуска с этим креативом, давшего больше всего заявок */
  bestHeadline: string;
}

const COUNTRY_RU: Record<string, string> = { KZ: 'Казахстан' };

function audience(raw: unknown): AudienceSettings | null {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);
  const ageMin = int(s.ageMin);
  const ageMax = int(s.ageMax);
  if (typeof s.countryCode !== 'string' || ageMin === null || ageMax === null) return null;
  const cities = (Array.isArray(s.cities) ? s.cities : [])
    .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
    .filter((c) => typeof c.key === 'string')
    .map((c) => ({ key: String(c.key), name: typeof c.name === 'string' ? c.name : String(c.key) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const genders = (Array.isArray(s.genders) ? s.genders : []).filter((g): g is number => g === 1 || g === 2);
  return { countryCode: s.countryCode, cities, ageMin, ageMax, genders, advantageAudience: s.advantageAudience === true };
}

export function audienceKey(s: AudienceSettings): string {
  const a = audience(s)!;
  return [a.countryCode, a.cities.map((c) => c.key).join(','), a.ageMin, a.ageMax, a.genders.join(','), a.advantageAudience ? 1 : 0].join('|');
}

export function audienceLabel(s: AudienceSettings): string {
  const where = s.cities.length ? s.cities.map((c) => c.name).join(', ') : `Весь ${COUNTRY_RU[s.countryCode] ?? s.countryCode}`;
  const who = s.genders.length === 1 ? (s.genders[0] === 1 ? 'мужчины' : 'женщины') : 'все';
  return [where, `${s.ageMin}–${s.ageMax}`, who, ...(s.advantageAudience ? ['расширение Meta'] : [])].join(' · ');
}

type Acc = { currency: string; launches: number; leads: number; clicks: number; impressions: number; spend: bigint; lastAt: string; lastLaunchId: string };

function add(acc: Acc | undefined, l: AdLibraryLaunch): Acc {
  const a = acc ?? { currency: l.currency, launches: 0, leads: 0, clicks: 0, impressions: 0, spend: 0n, lastAt: '', lastLaunchId: '' };
  a.launches += 1;
  a.leads += l.stats?.leads ?? 0;
  a.clicks += l.stats?.clicks ?? 0;
  a.impressions += l.stats?.impressions ?? 0;
  a.spend += l.stats?.spendMinor ?? 0n;
  if (l.createdAt > a.lastAt) {
    a.lastAt = l.createdAt;
    a.lastLaunchId = l.id;
  }
  return a;
}

function totals(a: Acc): Totals {
  return {
    currency: a.currency,
    launches: a.launches,
    leads: a.leads,
    clicks: a.clicks,
    impressions: a.impressions,
    spendMinor: a.spend.toString(),
    cplMinor: a.leads > 0 ? (a.spend / BigInt(a.leads)).toString() : null,
    lastAt: a.lastAt,
    lastLaunchId: a.lastLaunchId,
  };
}

/** Лучшие сверху: с заявками по цене заявки, затем без заявок по свежести */
function byResult(a: Totals, b: Totals): number {
  if (a.cplMinor !== null && b.cplMinor !== null) {
    const d = BigInt(a.cplMinor) - BigInt(b.cplMinor);
    if (d !== 0n) return d < 0n ? -1 : 1;
    return b.leads - a.leads;
  }
  if (a.cplMinor !== null) return -1;
  if (b.cplMinor !== null) return 1;
  return b.lastAt.localeCompare(a.lastAt);
}

export function adLibrary(launches: AdLibraryLaunch[]): { audiences: AudienceRow[]; creatives: CreativeRow[] } {
  const aud = new Map<string, { acc: Acc; settings: AudienceSettings }>();
  const cre = new Map<string, { acc: Acc; kind: 'IMAGE' | 'VIDEO'; fileName: string; best: { leads: number; headline: string } }>();
  for (const l of launches) {
    if (l.status !== 'SUCCEEDED') continue;
    const s = audience(l.settings);
    if (!s) continue;
    const key = `${l.currency}|${audienceKey(s)}`;
    const a = aud.get(key);
    aud.set(key, { acc: add(a?.acc, l), settings: a?.settings ?? s });
    if (l.creative) {
      const ck = `${l.currency}|${l.creative.id}`;
      const c = cre.get(ck);
      const leads = l.stats?.leads ?? 0;
      const best = !c || leads > c.best.leads ? { leads, headline: l.headline } : c.best;
      cre.set(ck, { acc: add(c?.acc, l), kind: l.creative.kind, fileName: l.creative.fileName, best });
    }
  }
  const audiences = [...aud.entries()]
    .map(([key, { acc, settings }]) => ({ key, label: audienceLabel(settings), settings, ...totals(acc) }))
    .sort(byResult);
  const creatives = [...cre.entries()]
    .map(([key, c]) => ({
      creativeId: key.split('|')[1]!,
      kind: c.kind,
      fileName: c.fileName,
      bestHeadline: c.best.headline,
      ...totals(c.acc),
    }))
    .sort(byResult);
  return { audiences, creatives };
}
