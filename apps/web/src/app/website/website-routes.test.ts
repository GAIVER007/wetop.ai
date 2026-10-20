import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { featureVerticals } from '../../lib/features';

/**
 * `/website/*` это сайт и онлайн-бронь гостиницы (тарифы, номера). У салона и ресторана эти страницы отвечали
 * «Не удалось загрузить данные (404)» и показывали гостиничные тарифы; их сайт в «Продвижении → Сайт» (аудит
 * платформы 17.10.2026, Д11).
 */
describe('/website только у гостиницы', () => {
  for (const page of ['page.tsx', 'analytics/page.tsx', 'booking/page.tsx', 'settings/page.tsx'])
    it(page, () => {
      const source = readFileSync(resolve(import.meta.dirname, page), 'utf8');
      // охрана по реестру функций (У1): страница зовёт `requireFeature`, реестр отдаёт `/website` только гостинице
      expect(source).toMatch(/requireFeature\('\/website(\/[a-z]+)?'\)/);
      expect(featureVerticals('/website')).toEqual(['HOSPITALITY']);
    });
});
