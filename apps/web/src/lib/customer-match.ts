/**
 * Поиск клиента по имени или телефону одним полем (владелец 25.10.2026: «поиск должен работать по имени или
 * телефону»). Один помощник для журналов салона, ресторана и календаря гостиницы, чтобы везде искалось одинаково.
 *
 * Правила: регистр, лишние пробелы, «ё/е» и знаки над буквами не важны; запрос делится на слова, и КАЖДОЕ слово
 * должно найтись (порядок любой: «Aidai Asanova» найдёт «Asanova Aidai»). Слово с буквами ищется в имени. Слово из
 * цифр (можно с «+», скобками, точкой, дефисом) от трёх цифр ищется в цифрах телефона или в имени, короче только в
 * имени. Запрос целиком из знаков телефона («5186 5708», «+974 5186») читается одним номером.
 */

const PHONE_CHARS = /^[\d\s()+.-]+$/;
const PHONE_WORD = /^[\d()+.-]+$/;

/** нижний регистр без зависимости от языка, без знаков над буквами («ё» → «е», «é» → «e»), пробелы схлопнуты */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const digitsOf = (value: string) => value.replace(/\D/g, '');

export function matchesCustomer(
  query: string,
  customer: { name: string | null | undefined; phone?: string | null | undefined },
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const name = normalizeSearchText(customer.name ?? '');
  const phone = digitsOf(customer.phone ?? '');
  const phoneHas = (digits: string) => digits.length >= 3 && !!phone && phone.includes(digits);
  if (PHONE_CHARS.test(q) && /\d/.test(q)) {
    const digits = digitsOf(q);
    return phoneHas(digits) || name.includes(q);
  }
  return q.split(' ').every((word) => {
    if (PHONE_WORD.test(word) && /\d/.test(word)) return phoneHas(digitsOf(word)) || name.includes(word);
    return name.includes(word);
  });
}

/**
 * Новый клиент из одного поля поиска (владелец 26.10.2026: «зачем нам тавтология», поиск «Телефон или имя» и
 * отдельные «Имя / Фамилия / Телефон» дублировали друг друга). Номер телефона (от 7 цифр подряд, со знаками «+()-.»
 * и пробелами) выделяется из строки, первое слово остатка становится именем, остальное фамилией.
 */
const PHONE_RUN = /\+?[\d(][\d\s()+.-]{5,}\d/;
export function splitCustomerQuery(value: string): { firstName: string; lastName: string; phone: string } {
  const text = value.replace(/\s+/g, ' ').trim();
  const found = text.match(PHONE_RUN)?.[0]?.trim() ?? '';
  const phone = digitsOf(found).length >= 7 ? found : '';
  const words = (phone ? text.replace(found, ' ') : text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return { firstName: words[0] ?? '', lastName: words.slice(1).join(' '), phone };
}
