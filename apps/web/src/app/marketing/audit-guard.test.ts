import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Сторож аудита живого сайта 21.10.2026 (раздел «Продвижение», пп. 14-17, 32-34, 42): без ряда плиток над
 * списками, без текстов для разработчиков и без гостиничных слов у салона.
 */
const src = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const ads = src('./ads/page.tsx');
const meta = src('./ads/meta.tsx');
const content = src('./content/page.tsx');
const analytics = src('./analytics/page.tsx');
const budget = src('./budget/page.tsx');

describe('Продвижение без плиток и служебных слов', () => {
  it('нет рядов плиток Stats на рекламе, аналитике и бюджете', () => {
    for (const s of [ads, analytics, budget]) {
      expect(s).not.toMatch(/<Stats[ >]/);
      expect(s).not.toContain('<Stat ');
      expect(s).toContain('money-summary');
    }
  });
  it('реклама называется «Реклама», пустые вкладки спрятаны, текст без «следующих этапов»', () => {
    expect(ads).toContain("title={t('Реклама')}");
    expect(ads).not.toContain('ИИ-таргетолог"');
    expect(ads).not.toContain("label: 'Аудитории'");
    expect(ads).not.toContain("label: 'Креативы'");
    expect(ads).not.toContain('следующих этапах');
    expect(meta).not.toContain('владелец платформы');
    expect(meta).toContain('Подключение Facebook скоро');
  });
  it('контент: русские названия форматов, без «следующих этапов»', () => {
    expect(content).not.toMatch(/'(Stories|Reels|Email)'/);
    expect(content).not.toContain('(Stories)');
    expect(content).not.toContain('следующих этапах');
    expect(content).toContain('Сторис');
    expect(content).toContain('Рилс');
    expect(content).toContain('Рассылка');
  });
  it('аналитика: вкладки бюджета, слова вертикали, без «этап В5»', () => {
    expect(analytics).toContain('<BudgetTabs current="analytics"');
    expect(analytics).not.toContain('этап В5');
    expect(analytics).toContain('verticalCopy');
    expect(analytics).not.toContain('OTA и стойка в маркетинг не входят. Реклама');
  });
});
