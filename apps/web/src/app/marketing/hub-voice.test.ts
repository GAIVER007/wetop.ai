import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => '/marketing' }));

import { featureVerticals, ALL_VERTICALS } from '../../lib/features';
import { MarketingHub, liveModules } from './hub';

/**
 * Решение владельца 22.10.2026 (второе): «Голосовой агент» открыт всем направлениям, не только салону.
 * Карточка живая везде, ведёт на `/marketing/voice`, а текст говорит про то, что агент реально умеет в этом направлении.
 */
const VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
// пульт «Продвижения» (вариант В, 28.10.2026): шесть инструментов и строка «ИИ-продавец»
const COUNTS = { HOSPITALITY: 7, BEAUTY: 7, FOOD_SERVICE: 7 } as const;

describe('«Голосовой агент» во всех направлениях', () => {
  it('реестр функций: экран открыт всем трём направлениям', () => {
    expect([...featureVerticals('/marketing/voice')].sort()).toEqual([...ALL_VERTICALS].sort());
  });

  it.each(VERTICALS)('%s: карточка живая, ссылка на экран, число карточек хаба', (vertical) => {
    expect(liveModules().has('voice')).toBe(true);
    const html = renderToStaticMarkup(createElement(MarketingHub, { vertical }));
    expect(html).toMatch(/data-testid="marketing-voice-status"[^>]*>Доступно</);
    expect(html).toContain('href="/marketing/voice"');
    expect(html).toContain('aria-label="Подключить: Голосовой агент"');
    expect(html.match(/data-module=""/g)).toHaveLength(COUNTS[vertical]);
  });

  it('тексты карточки по направлению, без чужих слов', () => {
    const card = (vertical: (typeof VERTICALS)[number]) => {
      const html = renderToStaticMarkup(createElement(MarketingHub, { vertical }));
      const start = html.indexOf('data-testid="marketing-voice"');
      return html.slice(start, html.indexOf('</tr>', start));
    };
    expect(card('BEAUTY')).toContain('услугам и ценам');
    expect(card('FOOD_SERVICE')).toContain('часах работы');
    expect(card('HOSPITALITY')).toContain('просьбы перезвонить');
    expect(card('HOSPITALITY')).not.toContain('услугам');
    expect(card('FOOD_SERVICE')).not.toContain('услугам');
  });
});
