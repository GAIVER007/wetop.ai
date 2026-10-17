import { test, expect, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';
import { confirmDialog } from '../e2e/confirm';

let script: string;
test.beforeAll(() => {
  const bundle = buildSync({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { ConfirmDialog } from './apps/web/src/components/confirm-dialog';
        function Harness() {
          const [open, setOpen] = useState(true);
          const [pending, setPending] = useState(false);
          const [error, setError] = useState('');
          const [label, setLabel] = useState('Выселить');
          window.finishConfirmation = (result) => {
            setPending(false);
            if (result === 'closed') setOpen(false);
            if (result === 'error') setError('Счёт TEST-FOLIO закрыт');
            if (result === 'next') setLabel('Выселить с долгом');
          };
          return <ConfirmDialog open={open} title="Тестовое действие"
            confirmLabel={label} pending={pending}
            onConfirm={() => setPending(true)} onCancel={() => setOpen(false)}>
            {error && <p role="alert">{error}</p>}
          </ConfirmDialog>;
        }
        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"test"' },
  });
  script = bundle.outputFiles[0]!.text;
});

async function mount(page: Page) {
  page.on('pageerror', (error) => { throw error; });
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: script });
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function finish(page: Page, result: 'closed' | 'error' | 'next') {
  await page.evaluate((value) => {
    (window as unknown as { finishConfirmation: (result: string) => void }).finishConfirmation(value);
  }, result);
}

for (const result of ['closed', 'error', 'next'] as const) {
  test(`confirmation waits through pending until ${result}`, async ({ page }) => {
    await mount(page);
    let settled = false;
    // Attach the rejection handler immediately, including on the RED implementation.
    const completion = confirmDialog(page, 'Выселить').then(
      () => ({ error: null }),
      (error: Error) => ({ error: error.message }),
    ).finally(() => { settled = true; });
    await expect(page.getByRole('button', { name: 'Выполняю…', exact: true })).toBeDisabled();
    // A browser round trip ensures the helper has observed the pending label.
    await expect(page.getByRole('dialog')).toContainText('Выполняю…');
    expect(settled, 'pending is not successful confirmation').toBe(false);
    await finish(page, result);
    const outcome = await completion;
    if (result === 'error') {
      expect(outcome.error).toContain('Счёт TEST-FOLIO закрыт');
      await expect(page.getByRole('dialog')).toBeVisible();
    } else {
      expect(outcome.error).toBeNull();
      if (result === 'closed') await expect(page.getByRole('dialog')).toHaveCount(0);
      else await expect(page.getByRole('button', { name: 'Выселить с долгом', exact: true })).toBeEnabled();
    }
  });
}

test('declining closes the dialog without confirming', async ({ page }) => {
  await mount(page);
  await confirmDialog(page, 'Оставить как есть');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
