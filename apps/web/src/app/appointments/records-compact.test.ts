import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// владелец 29.10.2026 («продолжай» после проверки Kyial): строки записей по 3-4 строки, кнопка «Открыть запись»
// уходит за край на 1440 px. С компьютера строка записи в одну линию: длинные клиент, услуга, специалист и автор
// с многоточием и полным текстом в подсказке, телефон целиком. На телефоне (до 600 px) карточки как были.
const css = readFileSync(new URL('../beauty/beauty.css', import.meta.url), 'utf8');
const list = readFileSync(new URL('./list.tsx', import.meta.url), 'utf8');
describe('записи: компактная строка с компьютера', () => {
  it('строка в одну линию с 961 px (на планшете 601–960 карточки, tablet-layout.test.ts)', () => {
    const at = css.indexOf('@media (min-width: 961px) {\n    /* записи в одну строку');
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, at + 1500);
    expect(block).toContain('white-space: nowrap');
    expect(block).toContain('text-overflow: ellipsis');
    expect(block).toContain("td[data-col='service']");
  });
  it('у длинных полей есть подсказка с полным текстом', () => {
    for (const col of ['client', 'service', 'staff', 'author']) expect(list).toMatch(new RegExp(`data-col="${col}"[^>]*title=`));
  });
});
