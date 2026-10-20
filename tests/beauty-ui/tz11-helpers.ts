import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { mkdirSync } from 'node:fs';
export const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
// Понедельник в будущем: записи фикстур не должны «кончаться в прошлом» (ends_at > now() в конфликтах часов)
const nextMonday = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + (((8 - d.getUTCDay()) % 7) || 7));
  return d.toISOString().slice(0, 10);
})();
export const date = nextMonday;
export const nextDate = (() => {
  const d = new Date(`${nextMonday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
export const evidence = process.env.TZ11_EVIDENCE || 'test-results/tz11-evidence';
mkdirSync(evidence + '/screenshots', { recursive: true });
export async function seed(page: Page, request: APIRequestContext) {
  const reset = await request.post(api + '/__test/reset');
  expect(reset.ok()).toBeTruthy();
  const f = await reset.json();
  const pointer = `business=${f.business};location=${f.locations[0]}`;
  const headers = { 'x-wetop-scope': pointer };
  await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' }]);
  async function call(path: string, data: object, method: 'post' | 'put' | 'patch' = 'post') {
    const r = await request[method](api + path, { headers, data });
    expect(r.ok(), path + ': ' + await r.text()).toBeTruthy();
    return r.json();
  }
  const services: Array<{ id: string }> = [];
  for (const name of ['Тест стрижка', 'Тест укладка']) {
    const s = await call('/beauty/services', { name, durationMinutes: 60, priceMinor: '1200000', currency: 'KZT' });
    await call(`/beauty/services/${s.id}/location`, { enabled: true }, 'put'); services.push(s);
  }
  const employees: Array<{ id: string }> = [];
  for (const name of ['Тест Анна', 'Тест Борис']) {
    const e = await call('/beauty/employees', { name });
    await call(`/beauty/employees/${e.id}/services`, { serviceIds: services.map(s => s.id) }, 'put');
    const schedule = await request.get(`${api}/beauty/schedule?employee=${e.id}`, { headers });
    expect(schedule.ok(), `initial employee week: HTTP ${schedule.status()}`).toBeTruthy();
    const originalWeekRevision = (await schedule.json()).weekRevision;
    expect(originalWeekRevision).toBeTruthy();
    await call(`/beauty/employees/${e.id}/working-hours`, { expectedRevision: originalWeekRevision, intervals: [0,1,2,3,4,5,6].map(weekday => ({ weekday, timeFrom: '09:00', timeTo: '18:00' })) }, 'put'); employees.push(e);
  }
  const book = (hour: string, master = 0, service = 0, firstName = 'Тест клиент') => {
    const selectedEmployee = employees[master];
    const selectedService = services[service];
    if (!selectedEmployee || !selectedService) throw new Error('Invalid synthetic fixture index');
    return call('/beauty/appointments', { employeeId: selectedEmployee.id, serviceId: selectedService.id, startsAt: `${date}T${hour}:00+05:00`, firstName });
  };
  return { ...f, headers, call, services, employees, book };
}
