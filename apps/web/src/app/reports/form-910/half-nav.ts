/** Соседние полугодия словами: «← 2-е полугодие 2025», а не безликое «Следующее полугодие» (аудит 22.10.2026 P2-8) */
import { translator, type Translate } from '../../../i18n';

export function halfLinks(year: number, half: 1 | 2, t: Translate = translator('ru')) {
  const link = (y: number, h: 1 | 2) => ({ href: `/reports/form-910?year=${y}&half=${h}`, y, h });
  const p = half === 1 ? link(year - 1, 2) : link(year, 1);
  const n = half === 1 ? link(year, 2) : link(year + 1, 1);
  return {
    prev: { href: p.href, label: t('← {h}-е полугодие {y}', { h: p.h, y: p.y }) },
    next: { href: n.href, label: t('{h}-е полугодие {y} →', { h: n.h, y: n.y }) },
  };
}
