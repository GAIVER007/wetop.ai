import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * UI5 §16: точечный аудит живых диалогов (UI5_AUDIT=1, в гейте не бежит).
 * По каждому: у диалога есть имя, есть кнопка закрытия, Escape закрывает,
 * фокус возвращается на открывшую кнопку.
 */
const OUT = 'reports/ui5-audit-2026-10-14/modals';
const TARGETS: Array<{ route: string; open: string }> = [
  // только модальный паттерн (<dialog>/Overlay-окно): боковые панели бара и команды —
  // другой паттерн, их гарантии держат bar.spec, team-спеки и ds1c-primitives
  { route: '/branches', open: 'Добавить' },
  { route: '/today', open: 'Все задачи' },
];

test.describe(() => {
  test.skip(!process.env['UI5_AUDIT'], 'аудит включается только UI5_AUDIT=1');
  for (const t of TARGETS) {
    test(`диалог: ${t.route} → ${t.open}`, async ({ page, request }) => {
      await request.post(`${FIXTURE_API}/__test/reset`);
      await page.goto(t.route);
      await expect(page.getByRole('main')).toBeVisible();
      const opener = page
        .getByRole('button', { name: new RegExp(t.open) })
        .or(page.getByRole('link', { name: new RegExp(t.open) }))
        .first();
      const r: Record<string, unknown> = { opener: (await opener.count()) > 0 };
      if (r['opener']) {
        await opener.click();
        const dialog = page.getByRole('dialog').first();
        await expect(dialog).toBeVisible();
        r['name'] = await dialog.evaluate(
          (el) => el.ariaLabel || document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent || null,
        );
        r['closeButton'] =
          (await dialog.getByRole('button', { name: /закрыть|close/i }).count()) > 0;
        await page.keyboard.press('Escape');
        r['escapeCloses'] = await dialog.isHidden().catch(() => true);
        r['focusReturned'] = await opener.evaluate((el) => el === document.activeElement).catch(() => false);
      }
      mkdirSync(OUT, { recursive: true });
      writeFileSync(
        `${OUT}/${(t.route + '-' + t.open).replace(/\W+/g, '-')}.json`,
        `${JSON.stringify({ [`${t.route} → ${t.open}`]: r }, null, 1)}\n`,
      );
    });
  }
});
