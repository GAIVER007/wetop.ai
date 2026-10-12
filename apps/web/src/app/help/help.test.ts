import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const shell = vi.hoisted(() => ({
  vertical: 'HOSPITALITY',
  scopeKey: 'b:l' as string | undefined,
}));
vi.mock('../../lib/desk-shell', () => ({ deskShell: async () => shell }));
import HelpPage from './page';
describe('L-02 confirmed vertical help', () => {
  it.each([
    ['HOSPITALITY', 'Начало работы в гостинице', '/inventory', '/services'],
    ['BEAUTY', 'Начало работы в салоне', '/services', '/inventory'],
    ['FOOD_SERVICE', 'Начало работы в ресторане', '/floor-plan', '/inventory'],
  ])('%s has its own content and links', async (vertical, heading, link, foreign) => {
    shell.vertical = vertical;
    shell.scopeKey = 'b:l';
    const html = renderToStaticMarkup(await HelpPage());
    expect(html).toContain(heading);
    expect(html).toContain(`href="${link}"`);
    expect(html).not.toContain(`href="${foreign}"`);
  });
  it('unknown context shows neutral help', async () => {
    shell.vertical = 'HOSPITALITY';
    shell.scopeKey = undefined;
    const html = renderToStaticMarkup(await HelpPage());
    expect(html).toContain('Выберите филиал');
    expect(html).not.toContain('Начало работы в гостинице');
    expect(html).not.toContain('href="/reservations/new"');
  });
});
