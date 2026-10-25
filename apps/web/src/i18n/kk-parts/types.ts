/**
 * Часть казахского словаря (KK2): экраны одной области. `paths` от `apps/web/src`, папка или файл: сторож
 * `kk-screens.test.ts` требует, чтобы в них не было русского текста мимо `t(…)` и `msg(…)`, и чтобы каждая такая
 * фраза была в словаре.
 */
export interface KkPart {
  paths: string[];
  phrases: Record<string, string>;
}
