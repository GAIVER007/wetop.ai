/**
 * Предложение ИИ-таргетолога (DATA_MODEL §57, ADR-MKT-LAUNCH, контракт `ad-proposal/0`): модель советует, код решает.
 * Ответ модели приводится к правилам: длины по рекомендациям Meta и экрана, возраст 18–65, пол только «все», мужчины
 * или женщины, приветствие только у рекламы в переписку. Бюджет, город и кнопку модель не выбирает.
 */
import { MarketingBudgetError } from './budget';

export const AD_DESTINATIONS = [
  'LEAD_FORM',
  'WHATSAPP',
  'MESSENGER',
  'INSTAGRAM_DIRECT',
  'WEBSITE',
] as const;
export type AdDestination = (typeof AD_DESTINATIONS)[number];
const MESSAGING: readonly AdDestination[] = ['WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT'];

export interface AdProposal {
  headline: string;
  primaryText: string;
  description: string | null;
  ageMin: number;
  ageMax: number;
  /** [] все, [1] мужчины, [2] женщины */
  genders: number[];
  interests: string[];
  welcome: { text: string; autofill: string } | null;
  notes: string[];
}

/** Строка без длинного тире (правило проекта) и не длиннее предела; пусто: null */
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return s === '' ? null : s;
};
const list = (v: unknown, count: number, max: number): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => clean(x, max))
    .filter((x): x is string => x !== null)
    .slice(0, count);
const age = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) ? Math.min(65, Math.max(18, v)) : fallback;

export function normalizeAdProposal(spec: unknown, destination: AdDestination): AdProposal {
  if (!spec || typeof spec !== 'object') throw new MarketingBudgetError('ИИ ответил не по схеме');
  const s = spec as Record<string, unknown>;
  const headline = clean(s.headline, 40);
  if (!headline) throw new MarketingBudgetError('ИИ не предложил заголовок');
  const primaryText = clean(s.primaryText, 500);
  if (!primaryText) throw new MarketingBudgetError('ИИ не предложил текст объявления');
  const a = age(s.ageMin, 18);
  const b = age(s.ageMax, 65);
  const g =
    Array.isArray(s.genders) && s.genders.length === 1 && (s.genders[0] === 1 || s.genders[0] === 2)
      ? [s.genders[0]]
      : [];
  const text = clean(s.welcomeMessage, 200);
  const autofill = clean(s.autofill, 100);
  return {
    headline,
    primaryText,
    description: clean(s.description, 30),
    ageMin: Math.min(a, b),
    ageMax: Math.max(a, b),
    genders: g,
    interests: list(s.interests, 5, 40),
    welcome: MESSAGING.includes(destination) && text && autofill ? { text, autofill } : null,
    notes: list(s.notes, 3, 200),
  };
}
