import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const api = 'http://127.0.0.1:55844';
const desk = 'http://127.0.0.1:55843';
async function headers(page: Page) {
  const cookies = await page.context().cookies(desk);
  const session = cookies.find(c => c.name === 'wetop_session')?.value;
  const scope = cookies.find(c => c.name === 'wetop_scope')?.value;
  if (!session || !scope) throw new Error('Registered synthetic session and scope required');
  return { 'x-wetop-session': session, 'x-wetop-scope': decodeURIComponent(scope) };
}
async function snapshot(page: Page) {
  const response = await page.request.get(`${api}/__onboarding-test/guest-snapshot`, { headers: await headers(page) });
  expect(response.status()).toBe(200);
  return response.json();
}
async function hospitality(page: Page) {
  const email = `onboarding-recovery-${randomUUID()}@example.invalid`;
  const response = await page.request.post(`${api}/auth/register`, { data: {
    email, name: 'Тестовый Владелец', businessName: `Отель Проверки Гостя ${randomUUID()}`, vertical: 'HOSPITALITY',
    password: 'Onboarding-Test-2026!a', phoneCountry: 'KZ', phone: '7000000000', privacyAccepted: true,
  } });
  expect(response.ok(), `registration HTTP ${response.status()}`).toBe(true);
  const mail = await (await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)).json();
  expect(mail.link).toBeTruthy();
  await page.goto(mail.link);
  await page.waitForURL(/55843\/(?:register\/setup|today|onboarding)/);
  await page.goto('/register/setup');
  const main = page.getByRole('main');
  await main.getByLabel('Название категории', { exact: true }).fill('Номер Проверки Гостя');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByLabel('Сколько мест', { exact: true }).fill('2');
  await main.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Сохранено');
  await main.getByRole('button', { name: 'Запустить отель', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  const provisioned = await snapshot(page);
  expect(provisioned.properties).toHaveLength(1);
  const property = provisioned.properties[0];
  expect(property.accommodationTypes.length).toBeGreaterThan(0);
  expect(property.ratePlans.length).toBeGreaterThan(0);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: property.timezone }).format(new Date());
  const stayDate = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  const created = await page.request.post(`${api}/reservations`, { headers: await headers(page), data: {
    creationKey: randomUUID(), source: 'WALK_IN', arrivalDate: stayDate(7), departureDate: stayDate(9),
    guest: { firstName: 'Synthetic', lastName: 'GuestAcceptance' },
    items: [{ accommodationTypeCode: property.accommodationTypes[0].code, ratePlanCode: property.ratePlans[0].code, adults: 1, autoAssign: true }],
  } });
  expect(created.ok(), `reservation HTTP ${created.status()}`).toBe(true);
  const card = await created.json();
  expect(card.primaryGuest.id).toBeTruthy();
  await page.goto(`/reservations/${card.confirmationNumber}`);
  const occupied = await snapshot(page);
  expect(occupied.reservations).toHaveLength(1);
  const item = occupied.reservations[0].items[0];
  expect(item).toBeTruthy();
  expect(item.adults).toBe(1);
  expect(item.children).toBe(0);
  expect(item.arrivalDate.slice(0, 10)).toBe(stayDate(7));
  expect(item.departureDate.slice(0, 10)).toBe(stayDate(9));
  expect(item.allocations.length).toBeGreaterThan(0);
  for (const allocation of item.allocations) {
    expect(allocation.inventoryUnitId).toBeTruthy();
    expect(allocation.startDate.slice(0, 10)).toBe(stayDate(7));
    expect(allocation.endDate.slice(0, 10)).toBe(stayDate(9));
  }
  expect(item.stayGuests).toEqual(expect.arrayContaining([expect.objectContaining({ guestId: card.primaryGuest.id, isPrimary: true })]));
  return { id: card.primaryGuest.id as string, number: card.confirmationNumber as string, itemId: item.id as string };
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Изменить гостя', exact: true }).click();
  await expect(page.getByTestId('guest-form')).toBeVisible();
}
async function deniedEditor(page: Page, access: 'READ_ONLY' | 'restricted') {
  await page.reload();
  const trigger = page.getByRole('button', { name: 'Изменить гостя', exact: true });
  if (access === 'restricted') await expect(trigger).toHaveCount(0);
  else await expect(trigger).toBeDisabled();
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
}
test('REALGUEST owner edits in-card citizenship through server actions without changing occupancy or money', async ({ page }) => {
  const guest = await hospitality(page);
  const before = await snapshot(page);
  expect(before.reservations).toHaveLength(1);
  expect(before.reservations[0].items.length).toBeGreaterThan(0);
  expect(before.reservations[0].items[0].folio).toBeTruthy();
  expect(before.reservations[0].items[0].folio.charges.length).toBeGreaterThan(0);
  await open(page);
  await page.getByTestId('guest-form').locator('[name="citizenship"]').fill('KGZ');
  await page.getByTestId('guest-form').getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).guests.find((g: { id: string }) => g.id === guest.id)?.citizenship).toBe('KGZ');
  const read = await page.request.get(`${api}/guests/${guest.id}`, { headers: await headers(page) });
  expect(read.status()).toBe(200);
  expect((await read.json()).citizenship).toBe('KGZ');
  await page.reload();
  await open(page);
  await expect(page.getByTestId('guest-form').locator('[name="citizenship"]')).toHaveValue('KGZ');
  const after = await snapshot(page);
  expect(after.reservations).toEqual(before.reservations);
  expect(after.properties).toEqual(before.properties);
});
test('REALGUEST READ_ONLY hides cached editor and real PATCH is forbidden without guest or ledger mutation', async ({ page }) => {
  const guest = await hospitality(page);
  await open(page);
  const before = await snapshot(page);
  expect((await page.request.post(`${api}/__onboarding-test/recovery`, { headers: await headers(page), data: { mode: 'READ_ONLY' } })).status()).toBe(200);
  await deniedEditor(page, 'READ_ONLY');
  const write = await page.request.patch(`${api}/guests/${guest.id}`, { headers: await headers(page), data: { citizenship: 'KGZ' } });
  expect(write.status()).toBe(403);
  expect(await snapshot(page)).toEqual(before);
});
test('REALGUEST restricted branch membership denies own and foreign guest reads/writes and discards cached form', async ({ page, browser }) => {
  const guest = await hospitality(page);
  // Availability/price previews can post other server actions on the same card.
  // Capture the actual guest load, not whichever action happens to start first.
  const actionRequest = page.waitForRequest(request =>
    request.method() === 'POST' && !!request.headers()['next-action'] &&
    new URL(request.url()).pathname === `/reservations/${encodeURIComponent(guest.number)}` &&
    request.postData()?.includes(guest.id) === true,
  );
  await open(page);
  const cachedLoad = await actionRequest;
  const otherContext = await browser.newContext({ baseURL: desk });
  try {
    const other = await otherContext.newPage();
    const foreign = await hospitality(other);
    const before = await snapshot(page);
    const foreignBefore = await snapshot(other);
    const h = await headers(page);
    const foreignRead = await page.request.get(`${api}/guests/${foreign.id}`, { headers: h });
    const foreignWrite = await page.request.patch(`${api}/guests/${foreign.id}`, { headers: h, data: { citizenship: 'KGZ' } });
    expect(foreignRead.status()).toBe(404);
    expect(foreignWrite.status()).toBe(404);
    expect(await snapshot(page)).toEqual(before);
    expect(await snapshot(other)).toEqual(foreignBefore);
    const capturedBody = cachedLoad.postData();
    expect(capturedBody).toBeTruthy();
    expect(capturedBody).toContain(guest.id);
    expect(cachedLoad.url()).toContain(`/reservations/${guest.number}`);
    const foreignBody = capturedBody!.replaceAll(guest.id, foreign.id);
    expect(foreignBody).not.toBe(capturedBody);
    expect(foreignBody).toContain(foreign.id);
    expect(foreignBody).not.toContain(guest.id);
    expect((await page.request.post(`${api}/__onboarding-test/guest-restrict`, { headers: h })).status()).toBe(200);
    await deniedEditor(page, 'restricted');
    // Replay the actual previously successful server action, not a mocked action or guessed ID.
    for (const id of [guest.id, foreign.id]) {
      const replay = await page.request.post(`${desk}/reservations/${guest.number}`, {
        headers: { 'next-action': cachedLoad.headers()['next-action']!, 'content-type': cachedLoad.headers()['content-type']!, origin: desk },
        data: id === guest.id ? capturedBody! : foreignBody,
      });
      expect(replay.status()).toBe(200);
      const payload = await replay.text();
      expect(payload).toContain('Изменение гостя недоступно.');
      expect(payload).not.toContain('GuestAcceptance');
      expect(payload).not.toContain('citizenship');
    }
    for (const id of [guest.id, foreign.id]) {
      const read = await page.request.get(`${api}/guests/${id}`, { headers: h });
      const write = await page.request.patch(`${api}/guests/${id}`, { headers: h, data: { citizenship: 'KGZ' } });
      expect(read.status()).toBe(403);
      expect(write.status()).toBe(403);
      for (const response of [read, write]) {
        const text = await response.text();
        expect(text).not.toContain(id);
        expect(text).not.toContain('GuestAcceptance');
        expect(text).not.toContain('Synthetic');
      }
    }
    // Foreign pointer is rejected independently of the organization-level guest guard.
    const badScope = { ...h, 'x-wetop-scope': (await headers(other))['x-wetop-scope'] };
    expect((await page.request.get(`${api}/guests/${foreign.id}`, { headers: badScope })).status()).toBe(403);
    await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(badScope['x-wetop-scope']), url: desk }]);
    await page.goto(`/reservations/${foreign.number}`);
    await expect(page.getByTestId('guest-form')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('GuestAcceptance');
    await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(h['x-wetop-scope']), url: desk }]);
    // Snapshot uses the retained registered actor session and restored original pointer.
    expect(await snapshot(page)).toEqual(before);
    expect(await snapshot(other)).toEqual(foreignBefore);
  } finally { await otherContext.close(); }
});
