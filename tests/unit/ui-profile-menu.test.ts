import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Меню профиля в спеках UI открывает только `openProfileMenu(page)` из `tests/ui/fixtures.ts`: помощник ждёт, пока
 * React оживит кнопку «Меню администратора», и проверяет, что меню раскрылось. Прямой клик сразу после перехода
 * гонится с оживлением страницы: кнопка уже нарисована сервером, обработчика у неё ещё нет, клик пропадает.
 * На медленном раннере GitHub это случалось не раз (TESTING.md, строки 20.09 `real-data` и 03.10 `login-access`,
 * release-checks #7). Сторож ищет само название кнопки: спек, которому понадобится меню, берёт помощник.
 */
const UI = resolve(import.meta.dirname, '../ui');
const MENU = 'Меню администратора';

describe('меню профиля в спеках UI открывается после оживления кнопки', () => {
  it('название кнопки встречается только в помощнике openProfileMenu, не в спеках', () => {
    const hits = readdirSync(UI)
      .filter((file) => file.endsWith('.spec.ts'))
      .flatMap((file) =>
        readFileSync(resolve(UI, file), 'utf8')
          .split('\n')
          .flatMap((line, index) => (line.includes(MENU) ? [`${file}:${index + 1}`] : [])),
      );
    expect(hits, 'меню профиля открывает openProfileMenu(page) из tests/ui/fixtures.ts').toEqual(
      [],
    );
  });

  it('помощник на месте: ждёт оживления и раскрытия меню', () => {
    const fixtures = readFileSync(resolve(UI, 'fixtures.ts'), 'utf8');
    expect(fixtures).toContain('export async function openProfileMenu(');
    expect(fixtures).toContain(`name: '${MENU}'`);
    expect(fixtures).toContain("key.startsWith('__reactProps$')");
    expect(fixtures).toContain("toHaveAttribute('aria-expanded', 'true')");
  });
});
