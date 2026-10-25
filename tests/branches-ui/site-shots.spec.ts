import { expect, test, type Page } from '@playwright/test';
import { createPrismaClient } from '@pms/database';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

/*
 * Экраны продукта для лендингов wetop.ai (14.10.2026): день салона (/calendar) и план зала (/floor-plan)
 * с вымышленными данными, светлая и тёмная темы, 1440x1000, в apps/site/public/screens/.
 * Идёт только с SITE_SHOTS=1 (локальное снятие), в гейте пропускается. Данные поверх /__test/seed-today:
 * служебные имена заменяются псевдонимами, день досеивается записями и столами, чтобы экран выглядел рабочим.
 */
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '26864'}`;
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const dir = 'apps/site/public/screens';

test.skip(process.env.SITE_SHOTS !== '1', 'снятие экранов сайта: включается SITE_SHOTS=1');
test.afterAll(async () => {
  await db.$disconnect();
});

const setScope = (page: Page, business: string, location: string) =>
  page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${business};location=${location}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);

async function shoot(
  page: Page,
  name: string,
  ready: () => Promise<void>,
  focus?: () => ReturnType<Page['locator']>,
) {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.reload();
    await ready();
    // Прокрутка к занятой части дня внутри своего контейнера: шапка липкая и остаётся в кадре
    if (focus) await focus().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    // Имя человека в шапке зашито в ответ /auth/me фикстуры, базу оно не читает:
    // для снимка подменяется в DOM, остальные имена переименованы в данных
    await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode;
        if (node.nodeValue?.includes('Тестовый владелец'))
          node.nodeValue = node.nodeValue.replace('Тестовый владелец', 'Демо-владелец');
        else if (node.nodeValue?.trim() === 'ТВ') node.nodeValue = 'ДВ';
      }
    });
    // Служебные имена сида на маркетинговый снимок не попадают (и шапка тоже)
    expect(await page.locator('body').innerText()).not.toContain('Тестов');
    await page.screenshot({ caret: 'initial', path: `${dir}/${name}-${theme}.png` });
  }
}

test('день салона и план зала для лендингов', async ({ page, request }) => {
  test.setTimeout(240_000);
  mkdirSync(dir, { recursive: true });
  const f = await (await request.post(`${api}/__test/reset`)).json();
  const seededRes = await request.post(`${api}/__test/seed-today`, { data: {} });
  expect(seededRes.ok()).toBe(true);
  const seeded = await seededRes.json();
  const now = Date.now();
  const at = (minutes: number) => new Date(now + minutes * 60_000);

  // Псевдонимы вместо служебных имён (на экране только вымышленные люди, ADR-010)
  for (const [from, to] of [
    ['Тестовый мастер Анна', 'Анна'],
    ['Тестовый мастер Вера', 'Вера'],
    ['Тестовый мастер Ольга', 'Ольга'],
  ] as const)
    await db.employee.updateMany({ where: { name: from }, data: { name: to } });
  await db.customer.updateMany({
    where: { firstName: 'Тестовая' },
    data: { firstName: 'Алия', lastName: 'К.' },
  });
  await db.beautyService.updateMany({
    where: { name: 'Тестовая стрижка' },
    data: { name: 'Стрижка' },
  });

  // Салон: третий мастер и ещё услуги с записями, чтобы день выглядел рабочим
  const salonLoc = await db.location.findUniqueOrThrow({ where: { id: seeded.salon } });
  await db.location.update({ where: { id: seeded.salon }, data: { name: 'Демо-салон' } });
  await db.business.update({ where: { id: salonLoc.businessId }, data: { name: 'Демо-салон' } });
  // Архивный мастер с записью показывается колонкой «не принимает»: для снимка он не нужен
  const archived = await db.employee.findMany({ where: { status: 'ARCHIVED' } });
  await db.appointment.deleteMany({
    where: { employeeId: { in: archived.map((e) => e.id) } },
  });
  await db.employeeLocation.deleteMany({
    where: { employeeId: { in: archived.map((e) => e.id) } },
  });
  const haircut = await db.beautyService.findFirstOrThrow({
    where: { businessId: salonLoc.businessId, name: 'Стрижка' },
  });
  const biz = await db.business.findUniqueOrThrow({ where: { id: salonLoc.businessId } });
  // Поиски только в организации этого прогона: pms_test хранит остатки прошлых прогонов
  const customer = await db.customer.findFirstOrThrow({
    where: { organizationId: biz.organizationId, firstName: 'Алия' },
  });
  const dana = await db.employee.create({
    data: { businessId: salonLoc.businessId, name: 'Дана' },
  });
  await db.employeeLocation.create({ data: { employeeId: dana.id, locationId: seeded.salon } });
  const services = [haircut];
  for (const [name, durationMinutes, price] of [
    ['Окрашивание', 90, 2500000n],
    ['Маникюр', 60, 900000n],
  ] as const) {
    const service = await db.beautyService.create({
      data: { businessId: salonLoc.businessId, name, durationMinutes, price, currency: 'KZT' },
    });
    await db.locationService.create({
      data: { locationId: seeded.salon, serviceId: service.id, enabled: true },
    });
    services.push(service);
  }
  const anna = await db.employee.findFirstOrThrow({
    where: { name: 'Анна', businessId: salonLoc.businessId },
  });
  const vera = await db.employee.findFirstOrThrow({
    where: { name: 'Вера', businessId: salonLoc.businessId },
  });
  for (const employee of [anna, vera, dana]) {
    for (const service of services)
      await db.employeeService.upsert({
        where: { employeeId_serviceId: { employeeId: employee.id, serviceId: service.id } },
        create: { employeeId: employee.id, serviceId: service.id },
        update: {},
      });
    // График 10:00-21:00 во все дни, иначе в колонке мастера напечатано «Выходной»
    for (let weekday = 0; weekday < 7; weekday++)
      await db.workingHours.create({
        data: {
          employeeId: employee.id,
          locationId: seeded.salon,
          weekday,
          timeFrom: new Date('1970-01-01T10:00:00Z'),
          timeTo: new Date('1970-01-01T21:00:00Z'),
        },
      });
  }
  const second = await db.customer.create({
    data: { organizationId: customer.organizationId, firstName: 'Мади', lastName: 'Т.' },
  });
  await db.customerBusiness.create({
    data: { customerId: second.id, businessId: salonLoc.businessId },
  });
  for (const [employee, service, who, from, to, status] of [
    [anna, services[1], second, 150, 240, 'CONFIRMED'],
    [vera, services[2], second, 210, 270, 'BOOKED'],
    [dana, services[2], customer, -90, -30, 'DONE'],
    [dana, services[0], second, 45, 105, 'CONFIRMED'],
    [dana, services[1], customer, 150, 240, 'BOOKED'],
  ] as const)
    await db.appointment.create({
      data: {
        locationId: seeded.salon,
        customerId: who.id,
        employeeId: employee.id,
        serviceId: service!.id,
        startsAt: at(from),
        endsAt: at(to),
        status,
        price: service!.price,
        currency: 'KZT',
      },
    });

  // Круглые времена на снимке: все записи дня выравниваются к ближайшему получасу
  for (const a of await db.appointment.findMany({ where: { locationId: seeded.salon } })) {
    const round = (d: Date) => new Date(Math.round(d.getTime() / 1_800_000) * 1_800_000);
    await db.appointment.update({
      where: { id: a.id },
      data: { startsAt: round(a.startsAt), endsAt: round(a.endsAt) },
    });
  }

  await setScope(page, f.beauty, seeded.salon);
  await page.goto('/calendar');
  await shoot(
    page,
    'salon-day',
    async () => {
      const day = page.getByRole('region', { name: 'Расписание дня' });
      await expect(day.getByRole('heading', { name: /^Анна/ })).toBeVisible();
      await expect(day.getByText('Стрижка').first()).toBeVisible();
    },
    () => page.getByRole('region', { name: 'Расписание дня' }).getByText('Окрашивание').first(),
  );

  // Ресторан: ещё столы и брони, чтобы на плане были свободные, забронированные и занятые
  const foodLoc = await db.location.findUniqueOrThrow({ where: { id: seeded.food } });
  await db.location.update({ where: { id: seeded.food }, data: { name: 'Демо-ресторан' } });
  await db.business.update({ where: { id: foodLoc.businessId }, data: { name: 'Демо-ресторан' } });
  const hall = await db.diningArea.findFirstOrThrow({
    where: { locationId: seeded.food, name: 'Основной зал' },
  });
  const period = await db.servicePeriod.findFirstOrThrow({ where: { locationId: seeded.food } });
  const tables = [];
  for (const [name, capacity] of [
    ['Стол 5', 2],
    ['Стол 6', 4],
    ['Стол 7', 6],
    ['Стол 8', 2],
  ] as const)
    tables.push(
      await db.diningTable.create({
        data: { areaId: hall.id, name, capacity, sortOrder: 10 + tables.length, active: true },
      }),
    );
  const reservation = async (
    startsAt: Date,
    endsAt: Date,
    status: 'CONFIRMED' | 'SEATED',
    table: { id: string },
    partySize: number,
  ) => {
    const key = randomUUID();
    const row = await db.restaurantReservation.create({
      data: {
        locationId: seeded.food,
        customerId: customer.id,
        servicePeriodId: period.id,
        startsAt,
        endsAt,
        partySize,
        status: status === 'SEATED' ? 'CONFIRMED' : status,
        creationKey: key,
        creationFingerprint: createHash('sha256').update(key).digest('hex'),
      },
    });
    await db.tableAssignment.create({ data: { reservationId: row.id, tableId: table.id } });
    if (status === 'SEATED')
      await db.restaurantReservation.update({ where: { id: row.id }, data: { status } });
  };
  // Безстольные брони сида (проверка страниц списка) заливают план колонкой одинаковых строк: убрать из кадра
  await db.restaurantReservation.deleteMany({
    where: { locationId: seeded.food, tableAssignment: null },
  });
  await reservation(at(-40), at(80), 'SEATED', tables[0]!, 2);
  // Активные непосаженные брони, чтобы на снимке были и забронированные столы, не только занятые
  await reservation(at(-10), at(110), 'CONFIRMED', tables[1]!, 4);
  await reservation(at(-5), at(115), 'CONFIRMED', tables[2]!, 6);

  await setScope(page, f.business, seeded.food);
  // План зала компактный: кадр ниже, чтобы на лендинге не было пустой полосы под планом
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto('/floor-plan');
  await shoot(page, 'restaurant-floor', async () => {
    await expect(page.getByRole('heading', { name: 'Журнал', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Стол 5/ })).toBeVisible();
  });
});
