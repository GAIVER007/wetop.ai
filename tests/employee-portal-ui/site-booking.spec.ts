
import { test, expect, type Browser, type Page } from '@playwright/test';
const describe = test.describe;
const it = test;
import { parseBeautyBookRequest, parseBeautySlotsQuery } from '../../packages/domain/src/web-booking/site-forms';
import type { BeautyBookResult, BeautySlotsResult } from '../../apps/api/src/site-forms/site-forms.service';
import { ctx, MASTER_ID, verticalSpec } from '../../apps/sites/src/test/fixtures';
import { LEAD_JS } from '../../apps/sites/src/render/lead-script';
import { renderSections } from '../../apps/sites/src/render/sections';

const SERVICE = '10000000-0000-4000-8000-000000000001';
const OTHER_SERVICE = '10000000-0000-4000-8000-000000000002';
const TARGET = '20000000-0000-4000-8000-000000000001';
const ISO = '2026-10-20T09:30:00.000Z';
const DAY = '2026-10-20';
function available(service = SERVICE, employee = TARGET): BeautySlotsResult {
  return {
    date: DAY, timezone: 'Asia/Almaty',
    service: { id: service, name: 'Canonical service', durationMinutes: 60, priceMinor: '812345', currency: 'KZT' },
    employees: [{ id: employee, name: 'Canonical master' }],
    slots: [{ startsAt: ISO, endsAt: '2026-10-20T10:30:00.000Z', time: '14:30', employeeIds: [employee] }],
  };
}
let browser: Browser;
test.beforeAll(async ({ browser: instance }) => { browser = instance; });

async function harness(options: { query?: string; mode?: 'BEAUTY_APPOINTMENT' | 'CALLBACK' | 'TABLE_RESERVATION'; noStaff?: boolean; captchaFailure?: 409 | 403 } = {}) {
  const page = await browser.newPage();
  const spec = verticalSpec(options.mode === 'TABLE_RESERVATION' ? 'FOOD_SERVICE' : 'BEAUTY');
  for (const section of spec.pages.flatMap((p) => p.sections)) {
    if (section.type === 'services') {
      const items = section['items'] as Array<Record<string, unknown>>;
      items[0]!['serviceCode'] = SERVICE;
      items[1]!['serviceCode'] = OTHER_SERVICE;
    }
    if (section.type === 'staff' && options.noStaff) section['items'] = [];
    if (section.type === 'leadForm' && options.mode) section['mode'] = options.mode;
  }
  const html = renderSections(ctx({ spec, bookingLive: false, facts: null }));
  const queries: Record<string, string>[] = [];
  const bodies: Record<string, unknown>[] = [];
  let slots: BeautySlotsResult = available();
  let slotsStatus = 200;
  let bookStatus = 201;
  let networkFailure = false;
  let bookResult: BeautyBookResult | Record<string, never> = {
    appointmentId: '40000000-0000-4000-8000-000000000001', status: 'BOOKED', startsAt: ISO,
    endsAt: '2026-10-20T10:30:00.000Z', service: { id: SERVICE, name: 'Booked service' },
    employee: { id: TARGET, name: 'Booked master' }, priceMinor: '912345', currency: 'KZT',
  };
  const consumedTokens = new Set<unknown>();
  let holdSlots: Promise<void> | undefined;
  await page.route('https://api.example.test/**', async (route) => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-headers': 'content-type' } });
    if (url.pathname === '/w/config') return route.fulfill({ json: { turnstileSiteKey: 'test-key' }, headers });
    if (url.pathname === '/w/beauty/slots') {
      const query = Object.fromEntries(url.searchParams);
      queries.push(query);
      await holdSlots;
      return route.fulfill({ status: slotsStatus, json: slotsStatus === 200 ? { ...slots, date: query.date } : { message: 'Master unavailable' }, headers });
    }
    bodies.push(route.request().postDataJSON());
    if (networkFailure) return route.abort();
    if (options.captchaFailure) {
      const token = bodies.at(-1)!.turnstileToken;
      const valid = typeof token === 'string' && /^captcha-token(?:-\d+)?$/.test(token) && !consumedTokens.has(token);
      consumedTokens.add(token);
      const status = !valid ? 403 : bodies.length === 1 ? options.captchaFailure : 201;
      return route.fulfill({ status, json: status === 201 ? bookResult : { message: status === 409 ? 'Slot conflict' : 'Captcha expired or invalid' }, headers });
    }
    return route.fulfill({ status: bookStatus, json: bookStatus === 201 ? bookResult : { message: 'Slot conflict' }, headers });
  });
  await page.route('https://salon.example.test/**', (route) => {
    if (new URL(route.request().url()).pathname === '/lead.js') return route.fulfill({ contentType: 'text/javascript', body: LEAD_JS });
    return route.fulfill({ contentType: 'text/html', body: `${html}<script>window.turnstile={render:function(el,cfg){this.cfg=cfg;this.issued=1;cfg.callback('captcha-token');return 1},reset:function(){this.issued++;this.cfg.callback('captcha-token-'+this.issued)}}</script><script src="/lead.js" data-api="https://api.example.test" data-site="pms_0123456789ab" data-locale="ru"></script>` });
  });
  page.setDefaultTimeout(3000);
  await page.goto('https://salon.example.test/?' + (options.query ?? `employeeId=${TARGET}&serviceId=${SERVICE}`));
  if (!options.mode || options.mode === 'BEAUTY_APPOINTMENT') {
    expect(await page.locator('select[name=startsAt]').count(), 'Beauty must render a server-slot selector, never a manual time input').toBe(1);
  }
  const form = page.locator('form[data-lead-form]');
  await page.waitForFunction(() => !document.querySelector<HTMLFormElement>('form[data-lead-form]')!.hidden);
  return { page, form, queries, bodies,
    setSlots: (data: BeautySlotsResult) => { slots = data; },
    setSlotsStatus: (status: number) => { slotsStatus = status; },
    setBookStatus: (status: number) => { bookStatus = status; },
    setNetworkFailure: (fail: boolean) => { networkFailure = fail; },
    setBookResult: (result: typeof bookResult) => { bookResult = result; },
    hold: (promise: Promise<void> | undefined) => { holdSlots = promise; },
  };
}
async function contact(page: Page) {
  await page.locator('[name=name]').fill('Test Guest');
  await page.locator('[name=phone]').fill('+77000000001');
}
async function ready(page: Page) {
  await page.locator('[name=date]').fill(DAY);
  await page.waitForFunction(() => document.querySelector<HTMLSelectElement>('[name=startsAt]')?.options.length === 2);
  await page.locator('[name=startsAt]').selectOption(ISO);
  await contact(page);
}

describe('generated public form in a real DOM (intercepted HTTP only)', () => {
  it('prefills profile IDs, queries an explicit master, renders only canonical slots/timezone/price and posts a backend-accepted ISO', async () => {
    const h = await harness({ query: `employeeId=${TARGET}&serviceId=${SERVICE}&employeeName=UNTRUSTED` });
    try {
      await ready(h.page);
      expect(h.queries).toHaveLength(1);
      expect(parseBeautySlotsQuery(h.queries[0])).toEqual({ ok: true, value: { siteKey: 'pms_0123456789ab', serviceId: SERVICE, employeeId: TARGET, date: DAY } });
      expect(await h.page.locator('[name=employeeId]').inputValue()).toBe(TARGET);
      expect(await h.page.locator('[name=employeeId] option:checked').textContent()).toBe('Canonical master');
      expect(await h.page.locator('[name=startsAt] option').allTextContents()).toEqual([expect.any(String), '14:30 (Asia/Almaty)']);
      expect(await h.page.locator('[data-beauty-details]').getAttribute('data-price-minor')).toBe('812345');
      expect(await h.page.locator('[data-beauty-details]').textContent()).toContain('123,45');
      expect(await h.form.textContent()).not.toContain('UNTRUSTED');
      expect(await h.form.locator('input[type=time]').count()).toBe(0);
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => document.querySelector('[data-lead-status]')!.textContent === document.querySelector('form[data-lead-form]')!.getAttribute('data-done'));
      expect(h.bodies).toHaveLength(1);
      expect(h.bodies[0]).toMatchObject({ serviceId: SERVICE, employeeId: TARGET, startsAt: ISO, turnstileToken: 'captcha-token' });
      expect(h.bodies[0]).not.toHaveProperty('serviceCode');
      expect(parseBeautyBookRequest(h.bodies[0]).ok).toBe(true);
      expect(await h.page.locator('[data-beauty-details]').getAttribute('data-price-minor')).toBe('912345');
      expect(await h.page.locator('[data-beauty-details]').textContent()).toContain('Booked master');
    } finally { await h.page.close(); }
  });

  it('populates a missing service/staff from canonical response without silently changing profile target', async () => {
    const h = await harness({ query: `employeeId=${TARGET}&serviceId=30000000-0000-4000-8000-000000000001`, noStaff: true });
    try {
      h.setSlots(available('30000000-0000-4000-8000-000000000001'));
      await ready(h.page);
      expect(h.queries[0]).toMatchObject({ employee: TARGET, service: '30000000-0000-4000-8000-000000000001' });
      expect(await h.page.locator('[name=serviceId] option:checked').textContent()).toBe('Canonical service');
      expect(await h.page.locator('[name=employeeId]').inputValue()).toBe(TARGET);
    } finally { await h.page.close(); }
  });

  it('clears selected slots immediately on date/service/master changes; any master requires a visible choice', async () => {
    const h = await harness();
    try {
      await ready(h.page);
      let release!: () => void;
      h.hold(new Promise<void>((resolve) => { release = resolve; }));
      await h.page.locator('[name=date]').fill('2026-10-21');
      expect(await h.page.locator('[name=startsAt]').inputValue()).toBe('');
      expect(await h.form.locator('button[type=submit]').isDisabled()).toBe(true);
      release(); h.hold(undefined);
      await h.page.waitForFunction(() => !document.querySelector<HTMLSelectElement>('[name=startsAt]')!.disabled);
      await h.page.locator('[name=startsAt]').selectOption(ISO);
      h.setSlots(available(OTHER_SERVICE));
      await h.page.locator('[name=serviceId]').selectOption(OTHER_SERVICE);
      await h.page.waitForFunction(() => document.querySelector<HTMLSelectElement>('[name=startsAt]')!.options.length === 2 && !document.querySelector<HTMLSelectElement>('[name=startsAt]')!.disabled);
      expect(await h.page.locator('[name=startsAt]').inputValue()).toBe('');
      expect(h.queries.at(-1)).toMatchObject({ employee: TARGET, service: OTHER_SERVICE });
      await h.page.locator('[name=employeeId]').selectOption('');
      await h.page.waitForFunction(() => !document.querySelector<HTMLSelectElement>('[name=startsAt]')!.disabled);
      expect(h.queries.at(-1)).not.toHaveProperty('employee');
      expect(await h.page.locator('[name=startsAt]').inputValue()).toBe('');
    } finally { await h.page.close(); }
  });

  it('fails closed on empty/error/ineligible responses and retains unavailable URL master (never any fallback)', async () => {
    const h = await harness();
    try {
      h.setSlots({ ...available(), slots: [] });
      await h.page.locator('[name=date]').fill(DAY);
      await h.page.waitForFunction(() => document.querySelector('[data-lead-status]')!.textContent !== '');
      expect(await h.page.locator('[name=startsAt] option').count()).toBe(1);
      expect(await h.form.locator('button[type=submit]').isDisabled()).toBe(true);
      h.setSlotsStatus(404);
      await h.page.locator('[name=date]').fill('2026-10-21');
      await h.page.waitForFunction(() => document.querySelector('[data-lead-status]')!.textContent === 'Master unavailable');
      expect(await h.page.locator('[name=employeeId]').inputValue()).toBe(TARGET);
      expect(h.queries.every((q) => q.employee === TARGET)).toBe(true);
      expect(h.bodies).toHaveLength(0);
    } finally { await h.page.close(); }
  });

  it('reuses request UUID, captcha, honeypot on network retry and clears stale slots on conflict without success', async () => {
    const h = await harness();
    try {
      h.setNetworkFailure(true);
      await ready(h.page);
      await h.page.locator('[name=website]').evaluate((el: HTMLInputElement) => { el.value = 'bot'; });
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled);
      h.setNetworkFailure(false); h.setBookStatus(409);
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => document.querySelector('[data-lead-status]')!.textContent === 'Slot conflict');
      expect(h.bodies).toHaveLength(2);
      expect(h.bodies[1]).toEqual(h.bodies[0]);
      expect(h.bodies[1]).toMatchObject({ website: 'bot', turnstileToken: 'captcha-token', startsAt: ISO });
      expect(h.bodies[1]!.requestKey).toMatch(/^[0-9a-f-]{14}4[0-9a-f-]{21}$/);
      expect(await h.page.locator('[name=startsAt]').inputValue()).toBe('');
      expect(await h.form.locator('button[type=submit]').isDisabled()).toBe(true);
      expect(await h.page.locator('[name=name]').inputValue()).toBe('Test Guest');
    } finally { await h.page.close(); }
  });

  for (const status of [409, 403] as const) {
    it(`recovers from definitive ${status} with a fresh CAPTCHA and the same request key`, async () => {
      const h = await harness({ captchaFailure: status });
      try {
        await ready(h.page);
        await h.form.locator('button[type=submit]').click();
        await expect(h.form.locator('[data-lead-status]')).toHaveText(status === 409 ? 'Slot conflict' : 'Captcha expired or invalid');
        expect(h.bodies).toHaveLength(1);
        expect(h.bodies[0]!.turnstileToken).toBe('captcha-token');
        if (status === 409) {
          await expect(h.page.locator('[name=startsAt]')).toHaveValue('');
          const next = '2026-10-20T11:30:00.000Z';
          const slots = available();
          slots.slots = [{ ...slots.slots[0]!, startsAt: next, endsAt: '2026-10-20T12:30:00.000Z', time: '16:30' }];
          h.setSlots(slots);
          h.setBookResult({ appointmentId: '40000000-0000-4000-8000-000000000002', status: 'BOOKED', startsAt: next,
            endsAt: '2026-10-20T12:30:00.000Z', service: { id: SERVICE, name: 'Booked service' },
            employee: { id: TARGET, name: 'Booked master' }, priceMinor: '912345', currency: 'KZT' });
          await h.page.locator('[data-beauty-refresh]').click();
          await expect(h.page.locator(`[name=startsAt] option[value="${next}"]`)).toHaveCount(1);
          await h.page.locator('[name=startsAt]').selectOption(next);
        }
        await h.form.locator('button[type=submit]').click();
        await expect(h.form.locator('[data-lead-status]')).toHaveText((await h.form.getAttribute('data-done'))!);
        expect(h.bodies).toHaveLength(2);
        expect(h.bodies[1]).toMatchObject({ requestKey: h.bodies[0]!.requestKey, turnstileToken: 'captcha-token-2',
          startsAt: status === 409 ? '2026-10-20T11:30:00.000Z' : ISO });
      } finally { await h.page.close(); }
    });
  }

  it('does not claim a booking on an empty successful HTTP response and retries with the same key', async () => {
    const h = await harness();
    try {
      h.setBookResult({});
      await ready(h.page);
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled);
      expect(await h.form.locator('[data-lead-status]').textContent()).toBe(await h.form.getAttribute('data-error'));
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled);
      expect(h.bodies).toHaveLength(2);
      expect(h.bodies[1]!.requestKey).toBe(h.bodies[0]!.requestKey);
    } finally { await h.page.close(); }
  });

  it('retains invalid URL master until an explicit visible alternative is chosen', async () => {
    const h = await harness({ query: `employeeId=not-a-uuid&serviceId=${SERVICE}` });
    try {
      await h.page.locator('[name=date]').fill(DAY);
      expect(h.queries).toHaveLength(0);
      expect(await h.page.locator('[name=employeeId]').inputValue()).toBe('not-a-uuid');
      expect(await h.form.locator('button[type=submit]').isDisabled()).toBe(true);
      h.setSlots(available(SERVICE, MASTER_ID));
      await h.page.locator('[name=employeeId]').selectOption(MASTER_ID);
      await h.page.waitForFunction(() => !document.querySelector<HTMLSelectElement>('[name=startsAt]')!.disabled);
      expect(h.queries[0]).toMatchObject({ employee: MASTER_ID });
    } finally { await h.page.close(); }
  });

  it('preserves an offset ISO verbatim and rejects slots for a different master or without a zone', async () => {
    const h = await harness();
    try {
      const data = available();
      const offset = '2026-10-20T14:30:00+05:00';
      data.slots = [
        { ...data.slots[0]!, startsAt: offset },
        { ...data.slots[0]!, startsAt: '2026-10-20T15:30:00' },
        { ...data.slots[0]!, startsAt: '2026-10-20T11:30:00.000Z', employeeIds: [MASTER_ID] },
      ];
      h.setSlots(data);
      await h.page.locator('[name=date]').fill(DAY);
      await h.page.waitForFunction(() => !document.querySelector<HTMLSelectElement>('[name=startsAt]')!.disabled);
      expect(await h.page.locator('[name=startsAt] option').count()).toBe(2);
      await h.page.locator('[name=startsAt]').selectOption(offset);
      await contact(h.page);
      await h.form.locator('button[type=submit]').click();
      await h.page.waitForFunction(() => document.querySelector('[data-lead-status]')!.textContent === document.querySelector('form')!.getAttribute('data-done'));
      expect(h.bodies[0]!.startsAt).toBe(offset);
      expect(parseBeautyBookRequest(h.bodies[0]).ok).toBe(true);
    } finally { await h.page.close(); }
  });

  for (const mode of ['CALLBACK', 'TABLE_RESERVATION'] as const) {
    it(`preserves ${mode} submission and does not fetch Beauty slots or apply URL targeting`, async () => {
      const h = await harness({ mode });
      try {
        await contact(h.page);
        if (mode === 'TABLE_RESERVATION') { await h.page.locator('[name=date]').fill(DAY); await h.page.locator('[name=time]').fill('19:00'); }
        await h.form.locator('button[type=submit]').click();
        await h.page.waitForFunction(() => document.querySelector<HTMLInputElement>('[name=name]')!.value === '');
        expect(h.queries).toHaveLength(0);
        expect(h.bodies).toHaveLength(1);
        expect(h.bodies[0]).not.toHaveProperty('serviceId');
        if (mode === 'TABLE_RESERVATION') expect(h.bodies[0]).toMatchObject({ date: DAY, time: '19:00', partySize: 2 });
      } finally { await h.page.close(); }
    });
  }
});
