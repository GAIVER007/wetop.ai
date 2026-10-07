import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createPrismaClient } from '@pms/database';
import { randomUUID } from 'node:crypto';
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '55864'}`;
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
let fixture: { agents: Array<{ id: string; business: string; location: string; vertical: string }>; organizationId: string };
test.beforeAll(async ({ request }) => {
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const seed = await request.post(`${api}/__test/seed-today`, { data: { timezone: 'Pacific/Kiritimati', analyticsStable: true } });
  expect(seed.ok()).toBe(true);
  const business = await db.business.findUniqueOrThrow({ where: { id: f.beauty } });
  await db.organizationExtension.upsert({ where: { organizationId_extension: { organizationId: business.organizationId, extension: 'AI_SELLER' } },
    create: { organizationId: business.organizationId, extension: 'AI_SELLER', status: 'ACTIVE', updatedAt: new Date() }, update: { status: 'ACTIVE', activeUntil: null } });
  fixture = { agents: [], organizationId: business.organizationId };
  for (const businessId of [f.hotel, f.beauty, f.business]) {
    const b = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const l = await db.location.findFirstOrThrow({ where: { businessId }, orderBy: { name: 'asc' } });
    const r = await request.post(`${api}/ai-seller/agents`, { headers: { 'idempotency-key': randomUUID(), 'x-wetop-scope': `business=${businessId};location=${l.id}` },
      data: { name: `Агент ${b.vertical}`, businessId, locationId: l.id } });
    expect(r.status()).toBe(201);
    fixture.agents.push({ id: (await r.json()).id, business: businessId, location: l.id, vertical: b.vertical });
  }
});
test.afterAll(async ({ request }) => {
  await request.post(`${api}/__test/cleanup`);
  await db.$disconnect();
});
for (const vertical of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE']) {
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    test(`MV10 ${vertical} ${theme} ${width} server binding and accessible shared agent screen`, async ({ page }) => {
      const a = fixture.agents.find(a => a.vertical === vertical)!;
      await page.setViewportSize({ width, height: 1000 });
      await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(`business=${a.business};location=${a.location}`), domain: '127.0.0.1', path: '/' }]);
      await page.addInitScript(t => { localStorage.setItem('wetop.theme', t); localStorage.setItem('wetop.training.dismissed', '1'); }, theme);
      await page.goto(`/ai-agents/${a.id}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Агент ${vertical}`);
      const tools = page.getByTestId('agent-tools');
      if (vertical !== 'HOSPITALITY') {
        await expect(page.getByText('Правила бронирования', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: 'Ваш рассказ' })).not.toHaveAttribute('placeholder', /отеля|размещение/);
      }
      await expect(tools).toContainText(vertical === 'BEAUTY' ? 'цены каталога' : vertical === 'FOOD_SERVICE' ? 'периоды обслуживания' : 'стоимость проживания');
      await expect(page.getByTestId('agent-lifecycle')).toHaveText('Черновик');
      await expect(page.getByTestId('agent-vertical')).not.toHaveText('Направление не определено');
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
      await page.screenshot({ path: `reports/mv10-20261007/screenshots/${vertical}-${theme}-${width}.png`, fullPage: true });
      const other = fixture.agents.find(b => b.vertical !== vertical)!;
      await page.goto(`/ai-agents/${other.id}`);
      await expect(page.getByRole('heading', { name: `Агент ${other.vertical}`, exact: true })).toHaveCount(0);
    });
  }
}
