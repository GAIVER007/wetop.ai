import { displayDate } from './display-date';
import { formatMoney } from './money';

/**
 * Предпросмотр действия (срез 7.3, Д5): что станет с деньгами, если действие подтвердить.
 * Считает API теми же функциями, что и само действие — здесь только слова для окна подтверждения.
 */
export interface ActionPreview {
  action: 'move' | 'extend' | 'cancel' | 'no_show';
  currentPriceMinor: string;
  currency: string;
  newPriceMinor?: string;
  differenceMinor?: string;
  changesCategory?: boolean;
  unitCode?: string;
  categoryName?: string;
  nights?: number;
  departureDate?: string;
  /** продление: свободна ли ячейка на добавленные ночи — иначе кнопка говорит «сначала переселите» до окна */
  nextNightsFree?: boolean;
  penaltyMinor?: string;
  policy?: string;
  voidedMinor?: string;
}

const plural = (n: number, forms: [string, string, string]) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

/**
 * Одна строка для окна подтверждения. Сумму администратор называет гостю вслух, поэтому она идёт
 * словами и целиком: «станет столько вместо столько». `null` — предпросмотр не ответил: действие
 * не запрещаем, но и молчать о деньгах нельзя.
 */
export function previewLine(preview: ActionPreview | null): string {
  if (!preview) return 'Сумму посчитать не удалось — проверьте счёт после действия.';
  const money = (minor: string) => formatMoney(minor, preview.currency);

  if (preview.action === 'cancel' || preview.action === 'no_show') {
    const voided = money(preview.voidedMinor ?? preview.currentPriceMinor);
    const penalty = BigInt(preview.penaltyMinor ?? '0');
    return penalty > 0n
      ? `Начисление ${voided} сторнируется, вместо него штраф ${money(penalty.toString())}.`
      : `Начисление ${voided} сторнируется, штрафа не будет.`;
  }

  if (preview.action === 'extend') {
    const nights = preview.nights ?? 1;
    const word = `${plural(nights, ['Новая ночь', 'Новые ночи', 'Новые ночи'])}`;
    const added = money(preview.differenceMinor ?? '0');
    const total = money(preview.newPriceMinor ?? preview.currentPriceMinor);
    // `displayDate` уже даёт «19 сент.» с точкой — второй точки в строке быть не должно
    const out = preview.departureDate ? `, выезд ${displayDate(preview.departureDate)}` : '.';
    return `${word} — ${added}. Проживание станет ${total}${out}`;
  }

  if (!preview.changesCategory) return 'Цена не меняется: та же категория.';
  const diff = BigInt(preview.differenceMinor ?? '0');
  const abs = (diff < 0n ? -diff : diff).toString();
  const direction = diff === 0n ? 'столько же' : diff > 0n ? `дороже на ${money(abs)}` : `дешевле на ${money(abs)}`;
  const where = preview.categoryName ? ` (пересчёт по календарю категории «${preview.categoryName}»)` : '';
  return `Цена проживания станет ${money(preview.newPriceMinor ?? preview.currentPriceMinor)} вместо ${money(preview.currentPriceMinor)} — ${direction}${where}.`;
}

/**
 * Бронь может состоять из нескольких проживаний, а отменяются они все разом: окно называет общую
 * сумму. Одно непосчитанное проживание делает неизвестной всю сумму — складывать половину нечестно.
 */
export function sumPreviews(previews: Array<ActionPreview | null>): ActionPreview | null {
  if (!previews.length || previews.some((p) => !p)) return null;
  const all = previews as ActionPreview[];
  const sum = (pick: (p: ActionPreview) => string | undefined) =>
    all.reduce((s, p) => s + BigInt(pick(p) ?? '0'), 0n).toString();
  const voided = sum((p) => p.voidedMinor ?? p.currentPriceMinor);
  return {
    action: all[0]!.action,
    currency: all[0]!.currency,
    currentPriceMinor: voided,
    voidedMinor: voided,
    penaltyMinor: sum((p) => p.penaltyMinor),
  };
}
