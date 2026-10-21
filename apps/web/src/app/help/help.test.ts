import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CLOSED_ACCESS } from '../../lib/navigation';
const shell = vi.hoisted(() => ({
  vertical: 'HOSPITALITY',
  scopeKey: 'b:l' as string | undefined,
  access: undefined as unknown,
}));
vi.mock('../../lib/desk-shell', () => ({ deskShell: async () => shell }));
vi.mock('./support-block', () => ({ SupportBlock: () => null }));
import HelpPage from './page';
describe('«Помощь» из меню направления', () => {
  it.each([
    ['HOSPITALITY', '/inventory', '/services'],
    ['BEAUTY', '/services', '/inventory'],
    ['FOOD_SERVICE', '/menu', '/inventory'],
  ])('%s: шаги ведут на свои экраны', async (vertical, link, foreign) => {
    Object.assign(shell, { vertical, scopeKey: 'b:l', access: { ...CLOSED_ACCESS, role: 'OWNER' } });
    const html = renderToStaticMarkup(await HelpPage());
    expect(html).toContain('Начало работы');
    expect(html).toContain(`href="${link}"`);
    expect(html).not.toContain(`href="${foreign}"`);
  });
  it('аудит 21.10.2026 пп. 12, 13, 39: слова салона, без дубля подзаголовка, две колонки', async () => {
    Object.assign(shell, { vertical: 'BEAUTY', scopeKey: 'b:l', access: { ...CLOSED_ACCESS, role: 'OWNER' } });
    const html = renderToStaticMarkup(await HelpPage());
    expect(html).not.toContain('page__subtitle');
    expect(html).toContain('help-columns');
    expect(html).not.toMatch(/или вместимость|запись или бронь|данные объекта|направление находится/);
    expect(html).toContain('создайте первую запись');
    expect(html).toContain('длительность');
  });
  it('unknown context shows neutral help', async () => {
    shell.scopeKey = undefined;
    const html = renderToStaticMarkup(await HelpPage());
    expect(html).toContain('Выберите филиал');
    expect(html).not.toContain('Начало работы');
  });
});
