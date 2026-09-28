/**
 * Перетаскивание брони по шахматке: администратор тянет клетку проживания на другую строку-ячейку.
 * Здесь только чистая часть — что едет в dataTransfer, куда бросать можно и что спросить перед
 * переселением; сам вызов остаётся в существующем server action (assignUnitAction), API не меняется.
 */
import type { ActionPreview } from '../../lib/action-preview';
import { blockTypeLabel } from '../../lib/block-types';
import { displayDate } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { nightsBetween, pluralRu } from '../../lib/plural';

export const DRAG_MIME = 'application/x-pms-stay';

export interface DragPayload {
  /** Номер брони */
  number: string;
  /** Проживание (reservation item) — его и переселяем */
  itemId: string;
  /** Дата взятой клетки — с неё и переселяем (YYYY-MM-DD по Алматы) */
  date: string;
  /** Ячейка, в которой клетка сейчас */
  unitCode: string;
}

/** Взятая плашка целиком: чтобы ещё до броска сказать, куда её можно положить (ТЗ v2 §26) */
export interface DragSource extends DragPayload {
  guest: string;
  categoryCode: string;
  /** Первая и последняя видимые ночи плашки в её строке */
  plateFrom: string;
  plateTo: string;
  /** Заезд раньше окна: начала проживания на экране нет */
  startsBefore: boolean;
  /** Выезд позже окна: конца проживания на экране нет */
  endsAfter: boolean;
}

/** Строка, над которой бронь: клетки уже загруженной сетки, запросов на строку нет (§69) */
export interface DropRow {
  unitCode: string;
  categoryCode: string;
  cells: ReadonlyArray<{
    date: string;
    state: string;
    itemId?: string | null | undefined;
    blockType?: string | null | undefined;
  }>;
}

export type DropVerdict =
  | { kind: 'noop' }
  | { kind: 'ok'; fromDate: string; toDate: string; changesCategory: boolean }
  | { kind: 'blocked'; fromDate: string; toDate: string; reason: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Только адрес брони: имя гостя и прочее из плашки в dataTransfer не уходят */
export function encodeDrag(p: DragPayload): string {
  return JSON.stringify({ number: p.number, itemId: p.itemId, date: p.date, unitCode: p.unitCode });
}

/** Чужой drop (файл, текст, ссылка) или битые данные — не бронь: возвращаем null, ничего не делаем. */
export function decodeDrag(raw: string): DragPayload | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' && p[k] !== '' ? (p[k] as string) : null);
  const number = str('number');
  const itemId = str('itemId');
  const date = str('date');
  const unitCode = str('unitCode');
  if (!number || !itemId || !date || !unitCode || !ISO_DATE.test(date)) return null;
  return { number, itemId, date, unitCode };
}

/**
 * Можно ли бросить бронь на строку — по клеткам, которые администратор видит (ТЗ v2 §26, §29:
 * конфликт виден до броска). Правила — те же, что у команды `assign`: ячейку можно сменить с любой
 * ночи проживания, а в другую категорию переезжает только всё проживание — тогда переезд с первой
 * ночи плашки. Своих правил нет; за краем окна и при гонке двух администраторов решает сервер (§50).
 */
export function checkDrop(source: DragSource, row: DropRow): DropVerdict {
  if (row.unitCode === source.unitCode) return { kind: 'noop' };
  const changesCategory = row.categoryCode !== source.categoryCode;
  const fromDate = changesCategory ? source.plateFrom : source.date;
  const toDate = source.plateTo;
  if (changesCategory && source.startsBefore)
    return {
      kind: 'blocked',
      fromDate,
      toDate,
      reason: 'Другая категория: переезжает всё проживание, а заезд раньше окна',
    };
  for (const cell of row.cells) {
    if (cell.date < fromDate || cell.date > toDate) continue;
    if (cell.state === 'BLOCKED')
      return {
        kind: 'blocked',
        fromDate,
        toDate,
        reason: `Недоступно с ${displayDate(cell.date)}: ${blockTypeLabel(cell.blockType)}`,
      };
    if (cell.state === 'OCCUPIED' && cell.itemId !== source.itemId)
      return { kind: 'blocked', fromDate, toDate, reason: `Занято с ${displayDate(cell.date)}` };
  }
  return { kind: 'ok', fromDate, toDate, changesCategory };
}

export interface MoveQuestion {
  /** Вопрос с номером брони (DESIGN.md §14) */
  title: string;
  guest: string;
  /** «R05 → R07» */
  route: string;
  /** «15 сент. → 17 сент., 2 ночи» или «с 15 сент. до выезда», если выезд за краем окна */
  dates: string;
  /** «Стоимость не изменится» или «Разница стоимости: +15 000 ₸» (ТЗ v2 §27) */
  money: string;
  /** Последствие: что освободится или какой станет цена */
  note: string;
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Окно перед переселением (ТЗ v2 §27): гость, откуда и куда, даты, разница в деньгах. Сумма — из
 * предпросмотра API (срез 7.3, Д5), здесь только слова; `null` — предпросмотр не ответил: действие
 * не запрещаем, но о деньгах не молчим.
 */
export function moveQuestion(
  source: DragSource,
  unitCode: string,
  verdict: Extract<DropVerdict, { kind: 'ok' }>,
  preview: ActionPreview | null,
): MoveQuestion {
  const departure = nextDay(verdict.toDate);
  const dates = source.endsAfter
    ? `с ${displayDate(verdict.fromDate)} до выезда`
    : `${displayDate(verdict.fromDate)} → ${displayDate(departure)}, ${pluralRu(
        nightsBetween(verdict.fromDate, departure),
        ['ночь', 'ночи', 'ночей'],
      )}`;
  const money = (minor: string) => formatMoney(minor, preview?.currency);
  const diff = BigInt(preview?.differenceMinor ?? '0');
  const abs = (diff < 0n ? -diff : diff).toString();
  const changed = !!preview?.changesCategory && diff !== 0n;
  return {
    title: `Переселить бронь ${source.number}?`,
    guest: source.guest,
    route: `${source.unitCode} → ${unitCode}`,
    dates,
    money: !preview
      ? 'Сумму посчитать не удалось — проверьте счёт после переселения.'
      : changed
        ? `Разница стоимости: ${diff > 0n ? '+' : '−'}${money(abs)}`
        : 'Стоимость не изменится',
    note:
      preview?.changesCategory && preview.newPriceMinor
        ? `Проживание станет ${money(preview.newPriceMinor)} вместо ${money(preview.currentPriceMinor)}${
            preview.categoryName ? `: категория «${preview.categoryName}»` : ''
          }.`
        : `С ${displayDate(verdict.fromDate)} ячейка ${source.unitCode} освободится.`,
  };
}
