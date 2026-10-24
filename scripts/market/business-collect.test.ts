import { describe, expect, it } from 'vitest';
import { collectBusiness, firstDikidiService, type BusinessTarget, type Fetcher } from './business-collect';

const NOW = new Date('2026-10-23T20:30:00Z'); // в Алматы уже 24.10
const dikidi: BusinessTarget = { id: 'd', name: 'Студия', url: 'https://dikidi.net/ru/record/2091353', platform: 'Dikidi', timezone: 'Asia/Almaty' };
const yclients: BusinessTarget = { id: 'y', name: 'Барбер', url: 'https://n1.yclients.com/company/1', platform: 'YCLIENTS', timezone: 'Asia/Almaty' };
const resto: BusinessTarget = { id: 'r', name: 'Бар', url: 'https://bar.restoplace.ws/', platform: 'Restoplace', timezone: 'Asia/Almaty' };

const services = JSON.stringify({ error: { code: 0 }, data: { list: [{ id: 22672844, name: 'Стрижка', cost: 10000, time: 60 }] } });
const datetimes = (day: string) =>
  JSON.stringify({
    error: { code: 0 },
    data: {
      dates_true: ['2026-10-24', '2026-10-26'],
      times: day === '2026-10-24' ? { m1: ['2026-10-24 10:00:00', '2026-10-24 11:00:00'], m2: ['2026-10-24 11:00:00'] } : day === '2026-10-26' ? { m1: ['2026-10-26 09:00:00'] } : {},
      company: { phone: '+77000000000' },
    },
  });

function setup(competitors: BusinessTarget[], fetcher: Fetcher) {
  const writes: Array<{ id: string; entries: unknown }> = [];
  const urls: string[] = [];
  const sleeps: number[] = [];
  const run = (dryRun = false) =>
    collectBusiness(
      {
        api: { competitors: async () => competitors, write: async (id, entries) => (writes.push({ id, entries }), { saved: entries.length, kept: 0 }) },
        get: async (url, kind) => (urls.push(url), fetcher(url, kind)),
      },
      { days: 3, delayMs: 8000, dryRun, now: NOW, sleep: async (ms) => void sleeps.push(ms) },
    );
  return { run, writes, urls, sleeps };
}

const ok: Fetcher = async (url) => {
  if (url.includes('/record/')) return { status: 200, body: '<html>Онлайн-запись</html>' };
  if (url.includes('company_services')) return { status: 200, body: services };
  const day = new URL(url).searchParams.get('date')!;
  return { status: 200, body: datetimes(day) };
};

describe('сборщик соседей салона (§60, срез 3)', () => {
  it('Dikidi: окна по дням от сегодня соседа, одно время у двух мастеров одно окно, день вне dates_true = 0', async () => {
    const { run, writes, urls, sleeps } = setup([dikidi], ok);
    const [report] = await run();
    expect(writes).toEqual([{ id: 'd', entries: [{ day: '2026-10-24', freeSlots: 2 }, { day: '2026-10-25', freeSlots: 0 }, { day: '2026-10-26', freeSlots: 1 }] }]);
    expect(report).toMatchObject({ outcome: 'written', saved: 3 });
    expect(urls[0]).toBe('https://dikidi.net/ru/record/2091353');
    expect(urls.filter((u) => u.includes('get_datetimes'))).toHaveLength(3);
    expect(urls.every((u) => !/add|record_info|agreements|phone/.test(u.split('?')[0]!.replace('/record/2091353', '')))).toBe(true);
    // пауза между каждым запросом к площадке, кроме самого первого
    expect(sleeps).toEqual([8000, 8000, 8000, 8000]);
  });

  it('пробный прогон ничего не пишет; соседи YCLIENTS пропускаются с причиной', async () => {
    const { run, writes } = setup([yclients, dikidi], ok);
    const reports = await run(true);
    expect(writes).toEqual([]);
    expect(reports.map((r) => [r.id, r.outcome])).toEqual([['y', 'skipped'], ['d', 'dry-run']]);
    expect(reports[0]!.reason).toMatch(/токеном виджета/);
  });

  it('403 или капча: сосед закрыт, дальше не идём и ничего не пишем; непонятный ответ дня не пишется', async () => {
    const blocked = setup([dikidi], async (url) => (url.includes('get_datetimes') ? { status: 429, body: '' } : ok(url, 'json')));
    expect((await blocked.run())[0]).toMatchObject({ outcome: 'blocked' });
    expect(blocked.writes).toEqual([]);
    const captcha = setup([dikidi], async () => ({ status: 200, body: '<div class="captcha">' }));
    expect((await captcha.run())[0]).toMatchObject({ outcome: 'blocked' });
    const odd = setup([dikidi], async (url) => (url.includes('get_datetimes') ? { status: 200, body: '{"error":{"code":0},"data":{"times":{}}}' } : ok(url, 'json')));
    expect((await odd.run())[0]).toMatchObject({ outcome: 'no-data' });
    expect(odd.writes).toEqual([]);
  });

  it('первая услуга виджета: id числом, без услуг null', () => {
    expect(firstDikidiService(JSON.parse(services))).toBe('22672844');
    expect(firstDikidiService({ data: {} })).toBeNull();
    expect(firstDikidiService(null)).toBeNull();
  });

  it('Restoplace: адрес со страницы, свободные столы по дням тем же запросом, что у виджета; без брони гостей', async () => {
    const forms: Array<Record<string, string>> = [];
    const writes: Array<{ id: string; entries: unknown }> = [];
    const items = [{ id: '1', type: 'table', reserve: '1' }, { id: '2', type: 'table', reserve: '1' }];
    const [report] = await collectBusiness(
      {
        api: { competitors: async () => [resto], write: async (id, entries) => (writes.push({ id, entries }), { saved: entries.length, kept: 0 }) },
        get: async () => ({ status: 200, body: "<body data-hash='e542ee65a7ec768858ad'>" }),
        post: async (_url, form) => {
          forms.push(form);
          const day = form.action!.split(':')[1]!;
          const tables_reserve = day === '2026-10-24' ? { '1_table': { n: [{ time_from: '2026-10-24 19:00:00' }] } } : [];
          return { status: 200, body: JSON.stringify({ items, tables_reserve }) };
        },
      },
      { days: 2, delayMs: 1, dryRun: false, now: NOW, sleep: async () => undefined },
    );
    expect(forms[0]).toEqual({ action: 'getJsonParams:2026-10-24:first:0', address: 'e542ee65a7ec768858ad', langApi: 'ru' });
    expect(writes).toEqual([{ id: 'r', entries: [{ day: '2026-10-24', freeSlots: 1 }, { day: '2026-10-25', freeSlots: 2 }] }]);
    expect(report).toMatchObject({ outcome: 'written' });
  });
});
