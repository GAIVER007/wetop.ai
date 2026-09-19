import { expect, test } from '@playwright/test';

/**
 * Сколько рейсов к API стоит один экран. Разбор «всё тормозит» (16.09.2026): база в Сингапуре, стойка в
 * Алматы, каждый лишний запрос — задержка сети на пустом месте. Счётчик в фикстуре (`/__test/hits`)
 * показывает правду по каждому пути.
 *
 * Правило: путь с данными экрана не запрашивается дважды за один показ, и всего запросов не больше десяти.
 * Два пути исключены намеренно: `/system/freshness` браузер опрашивает сам раз в минуту, а `/auth/me`
 * рисуется в двух местах оболочки (панель и меню профиля); плюс стенд работает на `next dev`, где React
 * умышленно вызывает эффекты и рендер по два раза — это шум разработки, а не рейсы живой стойки.
 */
interface Hits {
  total: number;
  byPath: Record<string, number>;
}

const API = 'http://127.0.0.1:4311';
const SHELL = ['/system/freshness', '/auth/me'];

async function hits(request: import('@playwright/test').APIRequestContext): Promise<Hits> {
  const res = await request.get(`${API}/__test/hits`);
  expect(res.ok(), 'фикстура не отдала счётчик запросов').toBe(true);
  return (await res.json()) as Hits;
}

for (const screen of [
  '/today',
  '/chessboard',
  '/reservations',
  '/reservations/new?unit=M03',
  '/guests',
  '/rooms',
]) {
  test(`экран ${screen}: данные берутся одним запросом на путь`, async ({ page, request }) => {
    await request.post(`${API}/__test/reset`);
    await page.goto(screen);
    await page.waitForLoadState('networkidle');
    const { total, byPath } = await hits(request);
    const seen = JSON.stringify(byPath);
    const twice = Object.entries(byPath).filter(([p, n]) => n > 1 && !SHELL.includes(p));
    expect(twice, `путь с данными запрошен повторно за один показ ${screen}: ${seen}`).toEqual([]);
    expect(total, `запросов на экран ${screen}: ${seen}`).toBeLessThanOrEqual(10);
  });
}
