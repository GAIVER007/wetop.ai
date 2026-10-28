import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/marketing' }));

import { MarketingHub } from './hub';

/**
 * «Продвижение», вариант В владельца (28.10.2026): пульт одной строкой на инструмент. Входит в подписку всё,
 * кроме доп. услуг WETOP (ИИ-продавец, конструктор сайта): у них «Дополнительно», а без подключения кнопка
 * «Подключить» вместо «Открыть».
 */
const row = (html: string, testId: string) => {
  const start = html.lastIndexOf('<tr', html.indexOf(`data-testid="${testId}"`));
  return html.slice(start, html.indexOf('</tr>', start));
};

describe('пульт «Продвижения»', () => {
  it('семь строк в таблице, сверху цифры месяца', () => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical: 'BEAUTY' }));
    expect(html.match(/data-module=""/g)).toHaveLength(7);
    expect(html.indexOf('data-testid="marketing-results"')).toBeLessThan(html.indexOf('data-testid="marketing-pult"'));
    expect(html).toContain('<table');
  });

  it('ИИ-продавец не подключён: «Дополнительно» и «Подключить»', () => {
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical: 'BEAUTY', seller: null }));
    const seller = row(html, 'marketing-seller');
    expect(seller).toContain('Не подключён');
    expect(seller).toContain('Дополнительно');
    expect(seller).toContain('aria-label="Подключить: ИИ-продавец"');
    expect(seller).not.toContain('Открыть:');
  });

  it('ИИ-продавец пробный: «Пробный» и «Открыть»', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingHub, {
        vertical: 'FOOD_SERVICE',
        seller: { access: 'active', status: 'TRIAL', activeUntil: '2026-11-10T00:00:00Z', daysLeft: 12 },
      }),
    );
    const seller = row(html, 'marketing-seller');
    expect(seller).toContain('Пробный');
    expect(seller).toContain('aria-label="Открыть: ИИ-продавец"');
  });

  it('бюджет в подписке; сайт без конструктора: «Подключает WETOP» и «Подключить»', () => {
    const html = renderToStaticMarkup(
      createElement(MarketingHub, {
        vertical: 'HOSPITALITY',
        builder: { access: 'off', status: 'OFF', activeUntil: null, daysLeft: null } as never,
      }),
    );
    expect(row(html, 'marketing-budget')).toContain('В подписке');
    const site = row(html, 'marketing-site');
    expect(site).toContain('Подключает WETOP');
    expect(site).toContain('aria-label="Подключить: Сайт и SEO"');
  });
});
