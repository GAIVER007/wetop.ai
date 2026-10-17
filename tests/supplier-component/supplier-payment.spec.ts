import { test, expect, type Page, type Locator } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

declare global {
  interface Window {
    __calls: Array<Record<string, string>>;
    __mode: string;
    __uuidCalls: string[];
    __restore: () => void;
  }
}
let server: Server;
let origin: string;
let bundle: string;
let success = 0;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SupplierPaymentForm} from '../../apps/web/src/app/bar/supplier-payment-form';
window.__calls=[];window.__mode='transport-failure';
class Boundary extends React.Component {
 state={error:null};
 static getDerivedStateFromError(error){return {error:String(error)}}
 render(){return this.state.error?<p role="alert">Transport boundary: {this.state.error}</p>:this.props.children}
}
function Harness(){const [generation,setGeneration]=useState(0);return <main><h1>Isolated SupplierPaymentForm</h1><button onClick={()=>setGeneration(n=>n+1)}>Remount component</button><Boundary key={generation}><SupplierPaymentForm receiptId="receipt-isolated-1" dueAmount="12345" context={{propertyId:'isolated-property',currency:'KZT'}} methods={['BANK_TRANSFER_LEGAL','CASH']}/></Boundary></main>}
createRoot(document.getElementById('root')).render(<Harness/>);
`,
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    plugins: [
      {
        name: 'explicit-test-adapters',
        setup(builder) {
          builder.onResolve(
            { filter: /^(\.\.\/\.\.\/components\/ui|\.\/actions|@pms\/domain)$/ },
            () => ({ path: 'adapter', namespace: 'test' }),
          );
          builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
            contents: `import React from 'react';
export function Field({label,children}) {return <label>{label}{children}</label>}
export function Input(props) {return <input {...props}/>}
export function Select(props) {return <select {...props}/>}
export function Button({size,...props}) {return <button {...props}/>}
export function barMethodRu(method){return method}
export async function payBarSupplierAction(state,data){
 const payload=Object.fromEntries(data.entries());
 window.__calls.push(payload);
 const response=await fetch(window.__mode==='transport-failure'?'/transport-failure':'/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return await response.json();
}
`,
            loader: 'tsx',
            resolveDir: fileURLToPath(new URL('../../', import.meta.url)),
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0]!.text;
  server = createServer((req, res) => {
    if (req.url === '/command' && req.method === 'POST') {
      req.resume();
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({ error: null, ok: ++success, message: 'Isolated stub payment accepted' }),
        );
      });
    } else if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(bundle);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="ru"><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing loopback port');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});
class PaymentPage {
  amount: Locator;
  pay: Locator;
  alert: Locator;
  success: Locator;
  constructor(readonly page: Page) {
    this.amount = page.getByLabel('Сумма, KZT');
    this.pay = page.getByRole('button', { name: 'Оплатить', exact: true });
    this.alert = page.getByRole('alert');
    this.success = page.getByRole('status').filter({ hasText: 'Isolated stub payment accepted' });
  }
  async fill(value = '70.25') {
    await this.amount.fill(value);
  }
  async remount() {
    await this.page.getByRole('button', { name: 'Remount component' }).click();
    await expect(this.amount).toBeVisible();
  }
  async calls() {
    return this.page.evaluate(() => window.__calls);
  }
  async mode(mode: string) {
    await this.page.evaluate((m) => (window.__mode = m), mode);
  }
  async inject(method: 'getItem' | 'setItem' | 'removeItem') {
    await this.page.evaluate((m) => {
      const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, m)!;
      Object.defineProperty(Storage.prototype, m, {
        ...descriptor,
        value: function (this: Storage, ...args: string[]) {
          if (this === window.sessionStorage)
            throw new DOMException('Injected ' + m, 'SecurityError');
          return Reflect.apply(descriptor.value, this, args);
        },
      });
      window.__restore = () => {
        Object.defineProperty(Storage.prototype, m, descriptor);
      };
    }, method);
  }
  async restore() {
    await this.page.evaluate(() => window.__restore());
  }
}

type Scenario = [string, (p: PaymentPage, errors: string[]) => Promise<void>];
const scenarios: Scenario[] = [
  [
    'same-tick repeated submits dispatch only once and unlock after completion',
    async (p, errors) => {
      await p.mode('success');
      await p.fill();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await p.page.route('**/command', async (route) => {
        await gate;
        await route.continue();
      });
      await p.page.locator('form').evaluate((form) => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await expect.poll(async () => (await p.calls()).length).toBeGreaterThan(0);
      try {
        assert.equal((await p.calls()).length, 1);
      } finally {
        release();
      }
      await expect(p.success).toBeVisible();
      await expect(p.pay).toBeEnabled();
      assert.equal((await p.calls()).length, 1);
      await p.fill();
      await p.pay.click();
      await expect.poll(async () => (await p.calls()).length).toBe(2);
      await expect(p.pay).toBeEnabled();
      assert.deepEqual(errors, []);
    },
  ],
  [
    'equivalent accepted formats after uncertain failure and remount reuse key',
    async (p) => {
      for (const amount of ['70', '70.00', '70,00', '070.00']) {
        await p.fill(amount);
        await p.pay.click();
        await expect(p.alert).toContainText('Transport boundary');
        await p.remount();
      }
      const calls = await p.calls();
      assert.equal(new Set(calls.map((c) => c.idempotencyKey)).size, 1);
      assert.equal(calls.length, 4);
    },
  ],
  [
    'legacy raw-format intent is reused across formatting and cleaned only after success',
    async (p) => {
      const key = '12345678-1234-4123-8123-123456789abc';
      await p.page.evaluate(
        (key) =>
          sessionStorage.setItem(
            JSON.stringify([
              'supplier-payment',
              { currency: 'KZT', propertyId: 'isolated-property' },
              'receipt-isolated-1',
              '070.00',
              'BANK_TRANSFER_LEGAL',
            ]),
            key,
          ),
        key,
      );
      await p.fill('70,00');
      await p.pay.click();
      await expect(p.alert).toContainText('Transport boundary');
      assert.equal((await p.calls())[0]!.idempotencyKey, key);
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 2);
      await p.remount();
      await p.fill('70.00');
      await p.mode('success');
      await p.pay.click();
      await expect(p.success).toBeVisible();
      assert.equal((await p.calls())[1]!.idempotencyKey, key);
      await expect.poll(() => p.page.evaluate(() => sessionStorage.length)).toBe(0);
    },
  ],
  [
    'conflicting legacy keys block dispatch and preserve evidence',
    async (p, errors) => {
      await p.page.evaluate(() => {
        for (const [amount, key] of [
          ['70', '12345678-1234-4123-8123-123456789abc'],
          ['70.00', '87654321-1234-4123-8123-123456789abc'],
        ] as const)
          sessionStorage.setItem(
            JSON.stringify([
              'supplier-payment',
              { propertyId: 'isolated-property', currency: 'KZT' },
              'receipt-isolated-1',
              amount,
              'BANK_TRANSFER_LEGAL',
            ]),
            key,
          );
      });
      await p.mode('success');
      await p.fill('70,00');
      await p.pay.click();
      await expect(p.alert).toContainText('разные ключи');
      assert.equal((await p.calls()).length, 0);
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 2);
      assert.deepEqual(errors, []);
    },
  ],
  ...(['getItem', 'setItem'] as const).map(
    (method) =>
      [
        method + ' failure is visible, failclosed, recoverable with stable draft',
        async (p, errors) => {
          await p.mode('success');
          await p.fill();
          await p.page.evaluate(() => {
            window.__uuidCalls = [];
            const original = crypto.randomUUID.bind(crypto);
            crypto.randomUUID = () => {
              const key = original() as `${string}-${string}-${string}-${string}-${string}`;
              window.__uuidCalls.push(key);
              return key;
            };
          });
          await p.inject(method);
          await p.pay.click();
          await expect(p.alert).toContainText('Платёж не отправлен', { timeout: 1500 });
          await expect(p.amount).toHaveValue('70.25');
          assert.equal((await p.calls()).length, 0);
          assert.deepEqual(errors, []);
          await p.pay.click();
          await expect(p.alert).toContainText('Платёж не отправлен');
          assert.equal((await p.calls()).length, 0);
          const generated = await p.page.evaluate(() => window.__uuidCalls);
          assert.equal(generated.length, method === 'setItem' ? 1 : 0);
          await p.restore();
          await p.pay.click();
          await expect(p.success).toBeVisible();
          const calls = await p.calls();
          assert.equal(calls.length, 1);
          if (method === 'setItem') assert.equal(calls[0]!.idempotencyKey, generated[0]);
          await expect(p.alert).toHaveCount(0);
          assert.deepEqual(errors, []);
        },
      ] as Scenario,
  ),
  [
    'removeItem failure preserves success and locks mounted form',
    async (p, errors) => {
      await p.mode('success');
      await p.fill();
      await p.inject('removeItem');
      await p.pay.click();
      await expect(p.success).toBeVisible({ timeout: 1500 });
      await expect(p.alert).toContainText('Не отправляйте другой платёж', { timeout: 1500 });
      await expect(p.pay).toBeDisabled();
      assert.deepEqual(errors, []);
      assert.equal((await p.calls()).length, 1);
      await p.restore();
      await p.page
        .locator('form')
        .evaluate((form) =>
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
        );
      await expect(p.pay).toBeDisabled();
      assert.equal((await p.calls()).length, 1);
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 1);
    },
  ],
  [
    'network rejection and remount retain key then success clears slot',
    async (p) => {
      await p.fill();
      await p.pay.click();
      await expect(p.alert).toContainText('Transport boundary');
      const first = (await p.calls())[0]!;
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 1);
      await p.remount();
      await p.fill();
      await p.pay.click();
      await expect(p.alert).toContainText('Transport boundary');
      assert.equal((await p.calls())[1]!.idempotencyKey, first.idempotencyKey);
      await p.remount();
      await p.fill();
      await p.mode('success');
      await p.pay.click();
      await expect(p.success).toBeVisible();
      assert.equal((await p.calls())[2]!.idempotencyKey, first.idempotencyKey);
      await expect.poll(() => p.page.evaluate(() => sessionStorage.length)).toBe(0);
      await expect(p.amount).toHaveValue('123.45');
    },
  ],
  [
    'normal success permits a new payment with new key',
    async (p, errors) => {
      await p.mode('success');
      await p.fill();
      await p.pay.click();
      await expect(p.success).toBeVisible();
      await expect.poll(() => p.page.evaluate(() => sessionStorage.length)).toBe(0);
      await p.fill();
      await p.pay.click();
      await expect.poll(async () => (await p.calls()).length).toBe(2);
      await expect.poll(() => p.page.evaluate(() => sessionStorage.length)).toBe(0);
      const calls = await p.calls();
      assert.notEqual(calls[0]!.idempotencyKey, calls[1]!.idempotencyKey);
      await expect(p.pay).toBeEnabled();
      assert.deepEqual(errors, []);
    },
  ],
  [
    'changed amount retains separate unresolved slots',
    async (p) => {
      await p.fill('80.25');
      await p.pay.click();
      await expect(p.alert).toContainText('Transport boundary');
      await p.remount();
      await p.fill('81.25');
      await p.pay.click();
      await expect(p.alert).toContainText('Transport boundary');
      const calls = await p.calls();
      assert.notEqual(calls[0]!.idempotencyKey, calls[1]!.idempotencyKey);
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 2);
    },
  ],
];
for (const [left, right] of [
  ['70.25', '070,25'],
  ['9007199254740993.99', '09007199254740993,99'],
] as const) {
  scenarios.push([
    `decimal-safe identity ${left} equals ${right}`,
    async (p) => {
      for (const amount of [left, right]) {
        await p.fill(amount);
        await p.pay.click();
        await expect(p.alert).toContainText('Transport boundary');
        await p.remount();
      }
      const calls = await p.calls();
      assert.equal(calls.length, 2);
      assert.equal(calls[0]!.idempotencyKey, calls[1]!.idempotencyKey);
      assert.deepEqual(
        calls.map((call) => call.amount),
        [left, right],
      );
    },
  ]);
}
for (const amount of ['70.250', '1e2', '-70', 'not-money']) {
  scenarios.push([
    `invalid amount ${amount} never dispatches`,
    async (p, errors) => {
      await p.fill(amount);
      await p.pay.click();
      await expect(p.alert).toContainText('Сумма:');
      assert.equal((await p.calls()).length, 0);
      assert.equal(await p.page.evaluate(() => sessionStorage.length), 0);
      assert.deepEqual(errors, []);
    },
  ]);
}
for (const [name, run] of scenarios) {
  test(name, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname === '/transport-failure')
        return route.abort('blockedbyclient');
      return route.continue();
    });
    await page.goto(origin);
    const form = new PaymentPage(page);
    await expect(form.amount).toBeVisible();
    await run(form, errors);
  });
}
