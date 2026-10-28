import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/marketing' }));

import { MarketingHub } from './hub';

/**
 * «Продвижение», вариант В владельца (28.10.2026): пульт одной строкой на инструмент. Поправка того же дня: у каждого
 * буста кнопка «Подключить» и колонка «Стоимость»; цены назначает WETOP, без цены «Цена скоро».
 */
const row = (html: string, testId: string) => {
  const start = html.lastIndexOf('<tr', html.indexOf(`data-testid="${testId}"`));
  return html.slice(start, html.indexOf('</tr>', start));
};

describe('пульт «Продвижения»', () => {
  it('семь строк в таблице, сверху цифры месяца, колонка «Стоимость»', () => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical: 'BEAUTY' }));
    expect(html.match(/data-module=""/g)).toHaveLength(7);
    expect(html.indexOf('data-testid="marketing-results"')).toBeLessThan(html.indexOf('data-testid="marketing-pult"'));
    expect(html).toContain('>Стоимость</th>');
    expect(html).not.toContain('Оплата');
  });

  it('у каждого буста «Подключить», «Открыть» нет', () => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical: 'HOSPITALITY' }));
    expect(html.match(/>Подключить</g)).toHaveLength(7);
    expect(html).not.toContain('Открыть:');
    expect(row(html, 'marketing-budget')).toContain('href="/marketing/budget"');
  });

  it('цены из кабинета WETOP в строке, без цены «Цена скоро»', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingHub, { vertical: 'BEAUTY', prices: { seller: '$29', ads: '$29' } }),
    );
    expect(row(html, 'marketing-seller')).toContain('<strong>$29</strong>');
    expect(row(html, 'marketing-seller')).toContain('в месяц');
    expect(row(html, 'marketing-content')).toContain('Цена скоро');
  });

  it('ИИ-продавец не подключён: «Не подключён», кнопка ведёт к подключению', () => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical: 'BEAUTY', seller: null }));
    const seller = row(html, 'marketing-seller');
    expect(seller).toContain('Не подключён');
    expect(seller).toContain('href="/ai-agents"');
    expect(seller).toContain('aria-label="Подключить: ИИ-продавец"');
  });

  it('ИИ-продавец пробный: «Пробный»', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingHub, {
        vertical: 'FOOD_SERVICE',
        seller: { access: 'active', status: 'TRIAL', activeUntil: '2026-11-10T00:00:00Z', daysLeft: 12 },
      }),
    );
    expect(row(html, 'marketing-seller')).toContain('Пробный');
  });

  it('сайт без конструктора: «Подключает WETOP», кнопка в конструктор', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingHub, {
        vertical: 'HOSPITALITY',
        builder: { access: 'off', status: 'OFF', activeUntil: null, daysLeft: null } as never,
      }),
    );
    const site = row(html, 'marketing-site');
    expect(site).toContain('Подключает WETOP');
    expect(site).toContain('href="/marketing/site/editor"');
  });
});
