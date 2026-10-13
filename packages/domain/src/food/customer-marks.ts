import { foodObject } from './food';

/** VIP-метка и день рождения клиента (DATA_MODEL §36, ADR-166). Даты — `ГГГГ-ММ-ДД` по дню филиала. */
const ymd = (s: string) => s.split('-').map(Number) as [number, number, number];
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** День рождения в году `y`: 29 февраля в невисокосный год — 28-го */
const birthdayIn = (y: number, m: number, d: number) =>
  Date.UTC(y, m - 1, m === 2 && d === 29 && !leap(y) ? 28 : d);

/** Через сколько дней ближайший день рождения: 0 — сегодня */
export function birthdayInDays(birthDate: string, today: string): number {
  const [, m, d] = ymd(birthDate);
  const [y, tm, td] = ymd(today);
  const now = Date.UTC(y, tm - 1, td);
  let next = birthdayIn(y, m, d);
  if (next < now) next = birthdayIn(y + 1, m, d);
  return Math.round((next - now) / 86_400_000);
}

function realDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export interface CustomerMarks {
  isVip?: boolean;
  birthDate?: string | null;
}
export function parseCustomerMarks(raw: unknown, today: string): CustomerMarks {
  const b = foodObject(raw, ['isVip', 'birthDate']);
  const out: CustomerMarks = {};
  if (b.isVip !== undefined) {
    if (typeof b.isVip !== 'boolean') throw new Error('Метка VIP: да или нет');
    out.isVip = b.isVip;
  }
  if (b.birthDate !== undefined) {
    if (b.birthDate === null) out.birthDate = null;
    else {
      if (typeof b.birthDate !== 'string' || !realDate(b.birthDate))
        throw new Error('Дата рождения в формате ГГГГ-ММ-ДД');
      if (b.birthDate < '1900-01-01' || b.birthDate > today)
        throw new Error('Дата рождения не в будущем и не раньше 1900 года');
      out.birthDate = b.birthDate;
    }
  }
  if (Object.keys(out).length === 0) throw new Error('Нечего менять');
  return out;
}
