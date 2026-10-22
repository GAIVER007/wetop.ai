import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { BusinessGrowthScreen } from './business-screen';
const { requireFeature, hotelToday, loadBusinessSales, budgetView } = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  hotelToday: vi.fn(),
  loadBusinessSales: vi.fn(),
  budgetView: vi.fn(),
}));
vi.mock('../../lib/vertical-guard', () => ({ requireFeature }));
vi.mock('./business-sales', () => ({ loadBusinessSales }));
vi.mock('../../lib/api', async (orig) => ({
  ...(await orig<typeof import('../../lib/api')>()),
  marketingBudgetApi: { view: budgetView },
}));
vi.mock('../../lib/hotel-api', () => ({ hotelToday }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
import SalesPage from '../sales/page';
import MarketingPage from '../marketing/page';

describe('Разделы роста по направлению бизнеса', () => {
  it('маркетинг салона: бюджет и «Сайт и SEO» доступны (SITE-1), тексты про клиентов салона', () => {
    const html = renderToStaticMarkup(
      createElement(BusinessGrowthScreen, { vertical: 'BEAUTY', mode: 'marketing' }),
    );
    expect(html).toContain('marketing-hub__modules');
    expect(html).toContain('Сайт и SEO');
    // аудит 21.10.2026 п. 5: гостиничных «Конкурентов» у салона нет. С «Голосовым агентом» (22.10.2026) модулей
    // пять: сетка 2 на 2 для четырёх больше не подходит, работает обычная (3 + 2)
    expect(html.match(/data-testid="marketing-module"/g)).toHaveLength(5);
    expect(html).not.toContain('marketing-competitors');
    expect(html).not.toContain('marketing-hub__modules--four');
    // ИИ-колл-центр: карточка есть только у салона, живая, ведёт на свой экран
    expect(html).toMatch(/data-testid="marketing-voice-status"[^>]*>Доступно</);
    expect(html).toContain('href="/marketing/voice"');
    expect(html).toContain('Голосовой агент');
    // единая система: бюджет ведётся по филиалу любого направления
    expect(html).toMatch(/data-testid="marketing-budget-status"[^>]*>Доступно</);
    expect(html).toContain('href="/marketing/budget"');
    // SITE-1: первый экран сайта открыт всем направлениям; публикация и изображения пока гостиничные, меню «⋯» нет
    expect(html).toMatch(/data-testid="marketing-site-status"[^>]*>Доступно</);
    expect(html).toContain('href="/marketing/site/editor"');
    expect(html).not.toContain('href="/marketing/site/assets"');
    expect(html).toContain('сайт салона');
    expect(html).toContain('Онлайн-запись');
    expect(html).not.toMatch(/гостиниц/);
    // п. 5: у рабочей «Рекламы» значок «Доступно», а не «Скоро» рядом с живой кнопкой
    expect(html).toMatch(/data-testid="marketing-ads-status"[^>]*>Доступно</);
    // п. 18: результаты ведут в аналитику маркетинга, дубля «Начать с сайта» нет
    expect(html).toContain('href="/marketing/analytics"');
    expect(html).not.toContain('href="/management/analytics"');
    expect(html).not.toContain('Начать с сайта');
    // п. 36: у карточек салона одинаковые действия, без отдельного меню «⋯» у одной
    expect(html).not.toContain('Ещё действия');
  });
  it('продажи ресторана: реальные плитки, лучшие блюда и официанты, без анализа конкурентов', () => {
    const html = renderToStaticMarkup(
      createElement(BusinessGrowthScreen, {
        vertical: 'FOOD_SERVICE',
        mode: 'sales',
        data: {
          period: { from: '2026-10-08', to: '2026-10-14', preset: '7' },
          currency: 'KZT',
          revenueMinor: '1250000',
          averageCheckMinor: '625000',
          sold: 2,
          bookings: 3,
          lost: 1,
          guests: 5,
          top: [{ name: 'Плов', count: 4, revenueMinor: '800000' }],
          team: [{ name: 'Айгерим', count: 2, revenueMinor: '1250000' }],
          seller: null,
          error: null,
        },
      }),
    );
    expect(html).toContain('sales-kpis');
    // аудит 21.10.2026 пп. 22, 30: итоги строкой без плиток, период «8-14 окт.», выбор дат как на «Финансах»
    expect(html).not.toContain('kpi-tile');
    expect(html).toContain('money-summary');
    expect(html).toMatch(/data-testid="sales-kpi-sold"[^>]*>2</);
    expect(html).toContain('8-14 окт.');
    expect(html).not.toContain(' \u2014 ');
    expect(html).toContain('href="/sales?days=30"');
    expect(html).toContain('name="from"');
    // п. 41: шапка как у остальных экранов «Продвижения»
    expect(html).toContain('Назад к модулям');
    expect(html).toContain('Лучшие блюда');
    expect(html).toContain('Плов');
    expect(html).toContain('Официанты');
    expect(html).toContain('Айгерим');
    expect(html).toContain('ИИ-продавец');
    expect(html).not.toContain('href="/market"');
    expect(html).not.toContain('Нет данных рынка');
  });

  for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
    it(`${vertical}: продажи не запрашивают гостиничные данные`, async () => {
      requireFeature.mockResolvedValue({ context: { vertical } });
      loadBusinessSales.mockResolvedValue(null);
      hotelToday.mockClear();
      const html = renderToStaticMarkup(await SalesPage({ searchParams: Promise.resolve({}) }));
      expect(html).toContain('data-testid="business-sales"');
      expect(html).toContain(vertical === 'BEAUTY' ? 'href="/appointments"' : 'href="/orders"');
      expect(hotelToday).not.toHaveBeenCalled();
      expect(requireFeature).toHaveBeenCalledWith('/sales');
    });
    it(`${vertical}: маркетинг открывает общие модули без ссылки на гостиничный сайт`, async () => {
      requireFeature.mockResolvedValue({ context: { vertical } });
      budgetView.mockRejectedValue(new Error('нет филиала'));
      const html = renderToStaticMarkup(await MarketingPage());
      expect(html).toContain('data-testid="business-marketing"');
      expect(html).toContain('href="/marketing/ads"');
      expect(html).toContain('href="/marketing/content"');
      expect(html).not.toContain('href="/website');
      // голосовой агент: пока только салон (решение владельца 22.10.2026)
      if (vertical === 'BEAUTY') expect(html).toContain('href="/marketing/voice"');
      else expect(html).not.toContain('marketing-voice');
    });
  }
  it('для салона каталог ведёт к услугам, для ресторана к блюдам', () => {
    const beauty = renderToStaticMarkup(
      createElement(BusinessGrowthScreen, { vertical: 'BEAUTY', mode: 'sales' }),
    );
    const food = renderToStaticMarkup(
      createElement(BusinessGrowthScreen, { vertical: 'FOOD_SERVICE', mode: 'sales' }),
    );
    expect(beauty).toContain('href="/services"');
    expect(food).toContain('href="/menu"');
  });
});

// Локальный SSR preview использует те же компоненты, без API и production-данных.
afterAll(() => {
  if (process.env.GROWTH_PREVIEW !== '1') return;
  const folder = '/private/tmp/wetop-growth-preview';
  mkdirSync(folder, { recursive: true });
  const css =
    ['globals', 'tokens', 'components', 'workspace', 'premium']
      .map((name) => readFileSync(`apps/web/src/app/${name}.css`, 'utf8'))
      .join('\n') +
    readFileSync('apps/web/src/app/food/food.css', 'utf8') +
    readFileSync('apps/web/src/app/food/restaurant.css', 'utf8') +
    readFileSync('apps/web/src/app/marketing/marketing.css', 'utf8') +
    readFileSync('apps/web/src/app/sales/sales.css', 'utf8') +
    readFileSync('apps/web/src/app/growth/growth.css', 'utf8');
  for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
    for (const mode of ['sales', 'marketing'] as const) {
      const main = renderToStaticMarkup(createElement(BusinessGrowthScreen, { vertical, mode }));
      writeFileSync(
        `${folder}/${vertical}-${mode}.html`,
        `<!doctype html><html lang="ru" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="workspace"><div style="padding:12px 20px">WETOP · локальный SSR preview</div>${main}</div></body></html>`,
      );
    }
  }
});
