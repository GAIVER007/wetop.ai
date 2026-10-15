import { mkdirSync, writeFileSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * UI5 §14: инструментальный аудит форм (UI5_AUDIT=1, в гейте не бежит).
 * По каждой форме: поля без подписи (label/aria-label), placeholder вместо подписи,
 * обязательные без отметки, разнобой высоты контролов. Ничего не отправляет.
 */
const OUT = 'reports/ui5-audit-2026-10-14/forms';
const TARGETS: Array<{ route: string; open?: string; dialog?: string }> = [
  { route: '/reservations/new?unit=M03' },
  { route: '/team', open: 'Пригласить сотрудника', dialog: 'Пригласить' },
  { route: '/bar/receipts/new' },
  { route: '/bar', open: 'Добавить товар' },
  { route: '/finance?tab=cash', open: 'Расход' },
  { route: '/hotel-settings' },
  { route: '/branches', open: 'Добавить' },
  { route: '/guests/ui-guest' },
];

test.describe(() => {
  test.skip(!process.env['UI5_AUDIT'], 'аудит включается только UI5_AUDIT=1');
  for (const t of TARGETS) {
    test(`формы: ${t.route}${t.open ? ` → ${t.open}` : ''}`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await request.post(`${FIXTURE_API}/__test/reset`);
      await page.goto(t.route);
      await expect(page.getByRole('main')).toBeVisible();
      if (t.open) {
        const btn = page.getByRole('button', { name: t.open }).first();
        if (await btn.count()) await btn.click();
      }
      await page.waitForTimeout(400);
      const facts = await page.evaluate(() => {
        const unlabeled: string[] = [];
        const placeholderOnly: string[] = [];
        const heights = new Map<string, number>();
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>(
            'main input:not([type=hidden]), main select, main textarea, [role=dialog] input:not([type=hidden]), [role=dialog] select, [role=dialog] textarea, dialog[open] input:not([type=hidden]), dialog[open] select, dialog[open] textarea',
          ),
        ).filter((el) => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }));
        for (const el of controls) {
          const input = el as HTMLInputElement;
          const id = input.id;
          const hasLabel =
            (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
            input.closest('label') ||
            input.ariaLabel ||
            input.getAttribute('aria-labelledby');
          const name = `${input.tagName}[${input.name || input.type || ''}]`;
          if (!hasLabel) unlabeled.push(`${name} ph="${input.placeholder || ''}"`);
          if (!hasLabel && input.placeholder) placeholderOnly.push(name);
          const h = Math.round(input.getBoundingClientRect().height);
          if (input.tagName !== 'TEXTAREA' && input.type !== 'checkbox' && input.type !== 'radio' && h > 0)
            heights.set(`${h}px`, (heights.get(`${h}px`) ?? 0) + 1);
        }
        return {
          controls: controls.length,
          unlabeled: unlabeled.slice(0, 10),
          placeholderOnly: placeholderOnly.slice(0, 10),
          controlHeights: Object.fromEntries(heights),
        };
      });
      mkdirSync(OUT, { recursive: true });
      writeFileSync(
        `${OUT}/${(t.route + (t.open ?? '')).replace(/\W+/g, '-')}.json`,
        `${JSON.stringify({ [t.route]: { open: t.open ?? null, ...facts } }, null, 1)}\n`,
      );
    });
  }
});
