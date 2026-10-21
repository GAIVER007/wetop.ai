import { expect, test, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

declare global { interface Window { __beautyCalls: Array<{ kind: string; args: unknown[] }>; } }
let server: Server;
let origin: string;
const ledger = new Map<string, unknown>();
test.beforeAll(async () => {
  const built = await build({
    stdin: { resolveDir: fileURLToPath(new URL('.', import.meta.url)), loader: 'tsx', contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AppointmentCard} from '../../apps/web/src/app/beauty/appointment-card';
window.__beautyCalls=[];
const row={id:'appointment',employeeId:'employee',serviceId:'service',serviceName:'Тестовая услуга',customer:{id:'customer',name:'Вымышленный клиент',phone:null},startsAt:'2026-10-18T13:00:00Z',endsAt:'2026-10-18T14:00:00Z',startMinutes:1080,endMinutes:1140,status:'DONE',next:[],priceMinor:'800000',paidMinor:'300000',refundedMinor:'0',currency:'KZT',notes:null};
function Harness(){
 const [generation,setGeneration]=useState(0);const [locationId,setLocation]=useState('location');const [done,setDone]=useState(0);
 const scopeKey=JSON.stringify({organizationId:'org',businessId:'business',locationId});
 const day={location:{id:locationId,name:'Тестовый салон',timezone:'Asia/Almaty',currency:'KZT'},date:'2026-10-18',columns:[],appointments:[row],services:[],bounds:{fromMinutes:480,toMinutes:1200}};
 return <main><h1>Money recovery component, explicit HTTP adapters</h1>
 <button onClick={()=>setGeneration(n=>n+1)}>Remount</button>
 <button onClick={()=>setLocation(s=>s==='location'?'another-location':'location')}>Switch scope</button>
 <p role="status">Confirmed callbacks: {done}</p>
 <AppointmentCard key={generation} row={row} day={day} scopeKey={scopeKey} canEdit canRefund onDone={()=>setDone(n=>n+1)}/></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);` },
    bundle: true, write: false, jsx: 'automatic',
    plugins: [{ name: 'explicit-adapters-not-backend-proof', setup(builder) {
      builder.onResolve({ filter: /^(\.\/journal-actions|\.\.\/\.\.\/components\/ui|\.\.\/\.\.\/components\/use-confirm|\.\/appointment-editor|\.\/appointment-history-panel|\.\/review-invitation|@pms\/domain)$/ }, () => ({ path: 'adapter', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ loader: 'tsx', resolveDir: fileURLToPath(new URL('../../', import.meta.url)), contents: `
import React from 'react';
export function Field({label,children}){return <label>{label}{children}</label>}
export function Input(props){return <input {...props}/>}
export function Select(props){return <select {...props}/>}
export function Button({tone,size,...props}){return <button {...props}/>}
export function Alert({children}){return <p role="alert">{children}</p>}
export function useConfirm(){return {ask:async()=>true,dialog:null}}
export function AppointmentEditor(){return null}
export function AppointmentHistoryPanel(){return null}
export function ReviewInvitation(){return null}
export const NO_SHOW_BEFORE_START_MESSAGE='Можно после начала визита';
// бонусы и сертификаты салона (миграции 140/141): в этом сценарии оплаты деньгами не участвуют
export function maxRedeem(total,balance,percent){const cap=total*BigInt(percent)/100n;return cap<balance?cap:balance}
export function normalizeCertificateCode(raw){return typeof raw==='string'&&raw.trim()?raw.trim().toUpperCase():null}
export async function customerBonusQuote(){return null}
export async function lookupCertificate(){return {error:'not used'}}
export async function moveAppointment(){return {}}
export async function setAppointmentStatus(){return {}}
async function command(kind,args){
 window.__beautyCalls.push({kind,args});
 const response=await fetch('/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,args})});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return await response.json();
}
export async function payAppointment(...args){return command('pay',args)}
export async function refundAppointment(...args){return command('refund',args)}
` }));
    } }],
  });
  const bundle = built.outputFiles[0]!.text;
  server = createServer((req, res) => {
    if (req.url === '/command' && req.method === 'POST') {
      let body = ''; req.setEncoding('utf8'); req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const operation = JSON.parse(body) as { kind: string; args: unknown[] };
        const key = String(operation.args[operation.kind === 'pay' ? 3 : 4]);
        if (!ledger.has(key)) ledger.set(key, operation);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: operation.kind === 'pay' ? 'Оплата принята' : 'Возврат оформлен' }));
      });
    } else if (req.url === '/ledger') {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([...ledger.values()]));
    } else if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'text/javascript'); res.end(bundle);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/bundle.js"></script></html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No loopback listener');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
test.beforeEach(() => ledger.clear());
async function open(page: Page) {
  await page.goto(origin);
  await expect(page.getByRole('button', { name: 'Принять оплату', exact: true })).toBeEnabled();
}
async function loseFirstResponse(page: Page) {
  let first = true;
  await page.route('**/command', async (route) => {
    if (!first) return route.continue();
    first = false; await route.fetch(); await route.abort('failed');
  });
}
for (const width of [390, 1440]) test.describe(`real Chromium ${width}, explicit adapters`, () => {
  test.use({ viewport: { width, height: 1000 } });
  test('lost partial-payment response retries identical command; same-tick clicks dispatch once', async ({ page, request }) => {
    await open(page); await loseFirstResponse(page);
    await page.getByLabel('Сумма, ₸', { exact: true }).fill('3000');
    await page.getByRole('button', { name: 'Принять оплату', exact: true }).evaluate((button) => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    const retry = page.getByRole('button', { name: 'Повторить ту же операцию', exact: true });
    await expect(retry).toBeVisible();
    await expect(page.getByLabel('Сумма, ₸', { exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.__beautyCalls.length)).toBe(1);
    await retry.click(); await expect(page.getByRole('status')).toHaveText('Confirmed callbacks: 1');
    const calls = await page.evaluate(() => window.__beautyCalls); expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(calls[0]!.args.slice(0, 3)).toEqual(['appointment', 'CASH', 300000]);
    expect(await (await request.get(origin + '/ledger')).json()).toHaveLength(1);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });
  test('lost refund response retains reason in memory only and exact retry key', async ({ page, request }) => {
    await open(page); await loseFirstResponse(page);
    await page.getByLabel('Сумма возврата, ₸', { exact: true }).fill('1000');
    await page.getByLabel('Причина', { exact: true }).fill('  Вымышленная причина возврата  ');
    await page.getByRole('button', { name: 'Оформить возврат', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить ту же операцию', exact: true })).toBeVisible();
    await expect(page.getByLabel('Причина', { exact: true })).toBeDisabled();
    const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain('Вымышленная'); expect(storage).not.toContain('100000');
    await page.getByRole('button', { name: 'Повторить ту же операцию', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Confirmed callbacks: 1');
    const calls = await page.evaluate(() => window.__beautyCalls); expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
    expect(calls[0]!.args.slice(0, 4)).toEqual(['appointment', 'CASH', 100000, 'Вымышленная причина возврата']);
    expect(await (await request.get(origin + '/ledger')).json()).toHaveLength(1);
  });
  test('unresolved remount/reload blocks replacement operation without storing payload', async ({ page }) => {
    await open(page); await loseFirstResponse(page);
    await page.getByRole('button', { name: 'Принять оплату', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Повторить ту же операцию', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remount', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Принять оплату', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Сверьте историю и кассу');
    expect(await page.evaluate(() => window.__beautyCalls.length)).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Принять оплату', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Сверьте историю и кассу');
    expect(await page.evaluate(() => window.__beautyCalls.length)).toBe(0);
  });
  test('unavailable storage prevents every command', async ({ page }) => {
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Test blocked storage', 'SecurityError'); }; });
    await open(page); await page.getByRole('button', { name: 'Принять оплату', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Безопасная отправка недоступна');
    expect(await page.evaluate(() => window.__beautyCalls)).toEqual([]);
  });
  test('scope switch ignores late completion and settles only the original marker', async ({ page }) => {
    await open(page);
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    let reached!: () => void; const arrived = new Promise<void>((resolve) => { reached = resolve; });
    await page.route('**/command', async (route) => { const response = await route.fetch(); reached(); await gate; await route.fulfill({ response }); });
    await page.getByRole('button', { name: 'Принять оплату', exact: true }).click(); await arrived;
    await page.getByRole('button', { name: 'Switch scope', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Принять оплату', exact: true })).toBeEnabled();
    release(); await expect.poll(() => page.evaluate(() => sessionStorage.length)).toBe(0);
    await expect(page.getByRole('status')).toHaveText('Confirmed callbacks: 0');
  });
});
