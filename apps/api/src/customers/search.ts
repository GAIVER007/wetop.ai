import { BadRequestException } from '@nestjs/common';

/** Сколько клиентов отдаёт поиск в шапке (аудит 22.10.2026 P1-4): быстрый переход, а не выгрузка */
export const CUSTOMER_SEARCH_LIMIT = 20;
const MAX_QUERY = 100;

/**
 * Строка поиска клиента из адреса: `undefined` или пустая строка значат «без поиска». Длиннее 100 знаков или не
 * строка: 400. Регистр не важен, условие строит `customerSearchWhere` поверх фильтра организации и бизнеса.
 */
export function customerSearch(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new BadRequestException('Некорректный запрос поиска');
  const q = raw.trim().replace(/\s+/g, ' ');
  if (q.length > MAX_QUERY) throw new BadRequestException('Запрос поиска длиннее 100 знаков');
  return q || null;
}

/**
 * Условие Prisma. Запрос из цифр («8 700 000», «+7 (700)», «+974 5186») ищется по телефону как есть и по цифрам
 * нормализованного телефона: и сырыми цифрами, и вариантом с ведущей 8 → 7 (так `customerPhoneKey` хранит
 * казахстанские номера). Только 8 → 7 ломало номера других стран (салон в Катаре, владелец 25.10.2026). Иначе каждое
 * слово встречается в имени, фамилии или телефоне; слово с тремя и больше цифрами ещё и в цифрах телефона
 * («Aidai 51865708» находит «+974 5186 5708»). Это только сужение: вызывающий обязан добавить organizationId и
 * связь с бизнесом.
 */
export function customerSearchWhere(q: string) {
  if (/^[\d\s()+.-]+$/.test(q)) {
    const raw = q.replace(/\D/g, '');
    const variants = raw.length >= 3 ? [...new Set([raw, raw.startsWith('8') ? `7${raw.slice(1)}` : raw])] : [];
    return {
      OR: [
        { phone: { contains: q } },
        ...variants.map((digits) => ({ phoneNormalized: { contains: digits } })),
      ],
    };
  }
  return {
    AND: q
      .split(' ')
      .filter(Boolean)
      .map((word) => {
        const digits = word.replace(/\D/g, '');
        return {
          OR: [
            { firstName: { contains: word, mode: 'insensitive' as const } },
            { lastName: { contains: word, mode: 'insensitive' as const } },
            { phone: { contains: word } },
            ...(digits.length >= 3 ? [{ phoneNormalized: { contains: digits } }] : []),
          ],
        };
      }),
  };
}
