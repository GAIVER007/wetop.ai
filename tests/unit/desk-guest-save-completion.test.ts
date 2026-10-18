import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Source guards only: real server/action completion still requires the E2E CI run.
const source = readFileSync('tests/e2e/desk-edit.spec.ts', 'utf8');
const loop = source.slice(
  source.indexOf('for (const item of beforeGuests.items)'),
  source.indexOf(
    "await cardTab(page, 'Обзор');",
    source.indexOf('for (const item of beforeGuests.items)'),
  ),
);

test('each stay proves server rejection before success, with unchanged authoritative snapshots', () => {
  const required = [
    "await adults.fill('0');",
    "await children.fill('0');",
    '(form as HTMLFormElement).noValidate = true;',
    'await submit();',
    'await expect(error).toContainText(/adults.*1/);',
    'await expect(save).toBeEnabled();',
    'expect(await readCard()).toEqual(beforeGuests);',
    'expect(await readFinance()).toEqual(beforeFinance);',
    '(form as HTMLFormElement).noValidate = false;',
    "await adults.fill('1');",
    "await children.fill('0');",
    'await expect(error).toContainText(/adults.*1/);',
    'await submit();',
    'await expect(error).toHaveCount(0);',
    'await expect(save).toBeEnabled();',
    "await expect(adults).toHaveValue('1');",
    "await expect(children).toHaveValue('0');",
    'expect(await readCard()).toEqual(beforeGuests);',
    'expect(await readFinance()).toEqual(beforeFinance);',
  ];
  let cursor = 0;
  for (const statement of required) {
    const at = loop.indexOf(statement, cursor);
    expect(at, `missing or out-of-order: ${statement}`).toBeGreaterThanOrEqual(cursor);
    cursor = at + statement.length;
  }
});

test('completion never waits for the whole RSC transport; native constraints remain asserted', () => {
  expect(source).not.toMatch(/\.finished\s*\(/);
  expect(source).toContain('test.setTimeout(180_000)');
  for (const assertion of [
    "expect(adults).toHaveAttribute('min', '1')",
    "expect(adults).toHaveAttribute('step', '1')",
    "expect(children).toHaveAttribute('min', '0')",
    "expect(children).toHaveAttribute('step', '1')",
  ])
    expect(loop).toContain(assertion);
});

test('response listener identifies exact reservation, action, item and both multipart count fields', () => {
  for (const guard of [
    "req.method() === 'POST'",
    'new URL(response.url()).pathname === reservationPath',
    "Boolean(req.headers()['next-action'])",
    'body.includes(item.id)',
    '/name="(?:_\\d+_)?adults"/.test(body)',
    '/name="(?:_\\d+_)?children"/.test(body)',
  ])
    expect(loop).toContain(guard);
  expect(loop.indexOf('page.waitForResponse')).toBeLessThan(loop.indexOf('await save.click()'));
});
