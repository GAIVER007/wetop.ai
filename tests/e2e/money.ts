/**
 * Сумма с экрана → тиыны (ADR-008). Экран печатает по DESIGN.md §14: «12 000 ₸», а тиыны — только
 * когда они есть («12 000,50 ₸»); минус — «−» (U+2212). До 18.09 помощник просто выкидывал всё,
 * кроме цифр, и после перехода на формат без тиынов ошибался бы в сто раз.
 */
export function minorFromText(text: string): bigint {
  const m = /(−|-)?\s*(\d[\d\s]*)(?:,(\d{2}))?\s*₸/.exec(text);
  if (!m) throw new Error(`не сумма: «${text}»`);
  const whole = BigInt(m[2]!.replace(/\s/g, '')) * 100n + BigInt(m[3] ?? '0');
  return m[1] ? -whole : whole;
}
