/**
 * Телефон для глаз (решение владельца 22.10.2026: «формата +7 777 777 77 77, чтобы было удобно видеть»).
 * Только показ и ввод: в базе номер хранится как раньше (`customerPhoneKey`, `normalizePhone`).
 * Казахстан и Россия (+7, 11 цифр): «+7 777 777 77 77»; ведущая 8 и 10 цифр без кода считаются +7.
 * Другая страна: «+» и цифры группами по три. Не номер (текст, маска со звёздочками) остаётся как есть.
 */
function groups(digits: string, sizes: number[]): string {
  const out: string[] = [];
  let at = 0;
  for (const size of sizes) {
    if (at >= digits.length) break;
    out.push(digits.slice(at, at + size));
    at += size;
  }
  while (at < digits.length) {
    out.push(digits.slice(at, at + 3));
    at += 3;
  }
  return out.join(' ');
}

const KZ = [3, 3, 2, 2];

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const text = raw.trim();
  if (!/^\+?[0-9 ().-]+$/.test(text)) return raw;
  let digits = text.replace(/\D/g, '');
  const plus = text.startsWith('+');
  if (!plus && digits.length === 10) digits = `7${digits}`;
  if (!plus && digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+7 ${groups(digits.slice(1), KZ)}`;
  if (digits.length < 7) return raw;
  return `+${groups(digits, [3])}`;
}

/** Формат по мере набора в поле: «+7 701 123 45 67»; лишние цифры после 11 у +7 отрезаются */
export function formatPhoneInput(raw: string): string {
  // буквы и чужие коды страны не трогаем: человек видит ровно то, что ввёл, а проверку делает сервер
  if (/[^0-9 +()\-.]/.test(raw)) return raw;
  const plus = raw.trim().startsWith('+');
  if (plus && !/^\+\s*7/.test(raw.trim()) && raw.replace(/\D/g, '').length > 0) return raw;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return plus ? '+' : '';
  if (!plus && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  else if (!plus && !digits.startsWith('7')) digits = `7${digits}`;
  if (digits.startsWith('7')) {
    const rest = digits.slice(1, 11);
    return rest ? `+7 ${groups(rest, KZ).split(' ').slice(0, 4).join(' ')}` : '+7';
  }
  return `+${digits.slice(0, 15)}`;
}
