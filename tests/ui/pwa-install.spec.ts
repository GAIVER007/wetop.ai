import { FIXTURE_API, expect, test } from './fixtures';

/**
 * PWA1 (plans/pwa1-install-2026-10-19.md): стойку можно поставить на телефон. Манифест и значки браузер забирает без
 * входа, поэтому проверяются анонимным запросом; ссылки в `<head>` видны и на странице входа.
 */
test.beforeEach(() => test.setTimeout(120_000));

/** Ширина и высота PNG из заголовка IHDR */
function pngSize(body: Buffer): [number, number] {
  expect(body.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [body.readUInt32BE(16), body.readUInt32BE(20)];
}

test('манифест отдаётся без входа и ведёт на «Сегодня»', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/manifest+json');
  const m = await res.json();
  expect(m).toMatchObject({ name: 'WETOP', start_url: '/today', display: 'standalone' });
});

for (const [path, px] of [
  ['/pwa-icon/192', 192],
  ['/pwa-icon/512', 512],
  ['/pwa-icon/maskable', 512],
] as const)
  test(`значок ${path}: PNG ${px}×${px} без входа`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(pngSize(await res.body())).toEqual([px, px]);
  });

test('чужой размер значка: 404', async ({ request }) => {
  expect((await request.get('/pwa-icon/64')).status()).toBe(404);
});

test('ссылки на манифест и значок iPhone, цвет строки состояния', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  // резервный вход (`/auth/fallback`) собран вручную без макета стойки, метаданные есть у экранов стойки
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  // Next стримит метаданные: обычному браузеру теги могут прийти в конце документа, а не в <head>
  const head = page.locator('html');
  await expect(head.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest\.webmanifest/);
  const apple = head.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveCount(1);
  const icon = await request.get((await apple.getAttribute('href'))!);
  expect(pngSize(await icon.body())).toEqual([180, 180]);
  await expect(head.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(head.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]')).not.toHaveCount(0);
});
