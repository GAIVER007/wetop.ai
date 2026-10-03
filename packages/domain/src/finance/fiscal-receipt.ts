/**
 * Номер фискального чека, выданного по запросу гостя (DATA_MODEL §25, ADR-143): то, что напечатала касса объекта.
 * Строка одна, 1–64 знака; переводы строк и управляющие знаки не принимаются: номер ищут при споре, он должен быть ровным.
 */
export function parseReceiptNumber(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw new Error('Номер чека: впишите номер или фискальный признак из кассы');
  if (value.length > 64) throw new Error('Номер чека длиннее 64 знаков');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value))
    throw new Error('Номер чека: одна строка без переводов строки');
  return value;
}
