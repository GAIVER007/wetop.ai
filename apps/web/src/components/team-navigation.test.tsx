import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: ({ children, href }: { children: unknown; href: string }) => createElement('a', { href }, children as never) }));
vi.mock('../i18n/locale-provider', () => ({ useT: () => (s: string) => s }));

import { TeamNavigation } from './team-navigation';

/** Владелец 31.10.2026: «в разделе сотрудники убери у всех раздел История действий» (она остаётся в «Настройках») */
describe('вкладки «Сотрудники»', () => {
  it('у владельца только «Сотрудники» и «Роли и права», без «Истории действий»', () => {
    const html = renderToStaticMarkup(createElement(TeamNavigation, { current: 'team', owner: true }));
    expect(html).toContain('Сотрудники');
    expect(html).toContain('Роли и права');
    expect(html).not.toContain('История действий');
    expect(html).not.toContain('href="/journal"');
  });
});
