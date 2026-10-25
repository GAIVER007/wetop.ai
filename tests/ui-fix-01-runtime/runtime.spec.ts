import { mkdirSync } from 'node:fs';
import { createPrismaClient, type Db } from '@pms/database';
import { READ_ONLY_MESSAGE } from '@pms/domain';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { PASSWORD, readRuntimeState, type RuntimeState } from './runtime-state';

const API = `http://127.0.0.1:${process.env.UI_FIX_01_API_PORT ?? 4324}`;
const scope = (s: RuntimeState) => `business=${s.businessId};location=${s.locationId}`;
const hospitalityScope = (s: RuntimeState) =>
  `business=${s.hospitalityBusinessId};location=${s.hospitalityLocationId}`;
const beautyScope = (s: RuntimeState) =>
  `business=${s.beautyBusinessId};location=${s.beautyLocationId}`;

async function customerRow(db: Db, id: string) {
  const row = await db.customer.findUniqueOrThrow({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      status: true,
      isVip: true,
      birthDate: true,
    },
  });
  return {
    ...row,
    birthDate: row.birthDate?.toISOString().slice(0, 10) ?? null,
  };
}

async function expectApiContext(
  request: APIRequestContext,
  token: string,
  pointer: string,
  expected: {
    businessId: string;
    locationId: string;
    vertical: 'FOOD_SERVICE' | 'HOSPITALITY' | 'BEAUTY';
  },
) {
  const response = await request.get(`${API}/auth/me`, {
    headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': pointer },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { context: Record<string, unknown> };
  expect(body.context).toEqual({ scope: 'LOCATION', ...expected });
}

async function switchBranch(page: Page, name: string) {
  await page.getByRole('button', { name: 'Выбрать филиал' }).click();
  const choices = page.locator('section[aria-label="Выбор филиала"]');
  await expect(choices).toBeVisible();
  await choices.getByRole('button').filter({ hasText: name }).click();
}

async function expectHelp(
  page: Page,
  subtitle: string,
  ownLinks: ReadonlyArray<readonly [name: string, href: string]>,
  otherHrefs: readonly string[],
) {
  await page.goto('/help');
  await expect(page).toHaveURL(/\/help$/);
  const help = page.getByRole('main');
  await expect(help.getByRole('heading', { name: 'Помощь', exact: true })).toBeVisible();
  await expect(help.getByText(subtitle, { exact: true })).toBeVisible();
  for (const [name, href] of ownLinks)
    await expect(help.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  for (const href of otherHrefs) await expect(help.locator(`a[href="${href}"]`)).toHaveCount(0);
}

async function screenshotMatrix(page: Page, state: RuntimeState, feature: string, stage: string) {
  const root = process.env.UI_FIX_01_SCREENSHOTS ?? '/tmp/ui-fix-01-runtime-screenshots';
  const directory = `${root}/${state.run}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const size of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.screenshot({
        path: `${directory}/${feature}-${stage}-${size.name}-${theme}.png`,
        fullPage: true,
      });
    }
  }
}

async function signIn(
  request: APIRequestContext,
  context: BrowserContext,
  state: RuntimeState,
): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email: state.email, password: PASSWORD },
  });
  expect(response.status(), 'synthetic runtime login must succeed').toBe(201);
  const session = (await response.json()) as { token: string; expiresAt: string };
  await context.addCookies([
    {
      name: 'wetop_session',
      value: session.token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(new Date(session.expiresAt).getTime() / 1000),
    },
    {
      name: 'wetop_scope',
      value: encodeURIComponent(scope(state)),
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  return session.token;
}

test.describe('UI-FIX-01 genuine web, Nest API and PostgreSQL', () => {
  let state: RuntimeState;
  let token = '';
  test.beforeAll(() => {
    state = readRuntimeState();
  });

  test.beforeEach(async ({ request, context }) => {
    token = await signIn(request, context, state);
  });

  test('invitation keeps location and whole-business scopes and rejects foreign or forbidden scopes', async ({
    page,
    request,
  }) => {
    const runtimeRole = await request.get(`${API}/__ui-fix-01/runtime-role`, {
      headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': scope(state) },
    });
    expect(runtimeRole.status()).toBe(200);
    expect(await runtimeRole.json()).toEqual({
      role: 'wetop_app',
      organizationId: state.organizationId,
    });

    const email = `scoped-${state.run}@example.invalid`;
    await page.goto('/team');
    await page.getByTestId('team-invite').click();
    const form = page.locator('.team-invite-form');
    await form.getByLabel('Почта приглашённого').fill(email);
    await form.getByLabel('Выбранные филиалы').check();
    await form.getByLabel(`Филиал Runtime ${state.run}`).check();
    await screenshotMatrix(page, state, 'team', 'before');
    await form.getByRole('button', { name: 'Отправить приглашение' }).click();
    await expect(page.getByText(email)).toBeVisible();
    await screenshotMatrix(page, state, 'team', 'after');

    const db = createPrismaClient(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA);
    try {
      const saved = await db.invite.findFirstOrThrow({
        where: { organizationId: state.organizationId, email },
      });
      expect(saved.scopes).toEqual([
        { role: 'STAFF', businessId: state.businessId, locationId: state.locationId },
      ]);

      const wholeBusinessEmail = `whole-business-${state.run}@example.invalid`;
      const wholeBusiness = await request.post(`${API}/auth/invites`, {
        headers: { authorization: `Bearer ${token}` },
        data: {
          email: wholeBusinessEmail,
          role: 'STAFF',
          scopes: [{ role: 'STAFF', businessId: state.businessId, locationId: null }],
        },
      });
      expect(wholeBusiness.status()).toBe(201);
      expect(
        (
          await db.invite.findFirstOrThrow({
            where: { organizationId: state.organizationId, email: wholeBusinessEmail },
          })
        ).scopes,
      ).toEqual([{ role: 'STAFF', businessId: state.businessId, locationId: null }]);

      const wholeOrganizationEmail = `whole-organization-${state.run}@example.invalid`;
      const wholeOrganization = await request.post(`${API}/auth/invites`, {
        headers: { authorization: `Bearer ${token}` },
        data: { email: wholeOrganizationEmail, role: 'STAFF', scopes: [] },
      });
      expect(wholeOrganization.status()).toBe(201);
      const organizationInvite = await db.invite.findFirstOrThrow({
        where: { organizationId: state.organizationId, email: wholeOrganizationEmail },
      });
      expect(organizationInvite.role).toBe('STAFF');
      expect(
        organizationInvite.scopes === null || JSON.stringify(organizationInvite.scopes) === '[]',
      ).toBe(true);

      const before = await db.invite.count({ where: { organizationId: state.organizationId } });
      for (const [emailPrefix, scopes] of [
        [
          'foreign',
          [
            {
              role: 'STAFF',
              businessId: state.foreignBusinessId,
              locationId: state.foreignLocationId,
            },
          ],
        ],
        [
          'forbidden-role',
          [{ role: 'OWNER', businessId: state.businessId, locationId: state.locationId }],
        ],
      ] as const) {
        const refused = await request.post(`${API}/auth/invites`, {
          headers: { authorization: `Bearer ${token}` },
          data: { email: `${emailPrefix}-${state.run}@example.invalid`, role: 'STAFF', scopes },
        });
        expect(refused.status()).toBe(400);
      }
      expect(await db.invite.count({ where: { organizationId: state.organizationId } })).toBe(
        before,
      );
    } finally {
      await db.$disconnect();
    }
  });

  test('Food customer PATCH distinguishes omitted, null, new and invalid, then the web clears and reloads', async ({
    page,
    request,
  }) => {
    const db = createPrismaClient(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA);
    const patch = (data: Record<string, unknown>) =>
      request.patch(`${API}/food-service/customers/${state.customerId}`, {
        headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': scope(state) },
        data,
      });
    try {
      const initial = await customerRow(db, state.customerId);
      const omitted = await patch({ isVip: true });
      expect(omitted.status()).toBe(200);
      expect((await omitted.json()).birthDate).toBe('1990-05-01');
      const afterOmitted = { ...initial, isVip: true };
      expect(await customerRow(db, state.customerId)).toEqual(afterOmitted);

      const cleared = await patch({ birthDate: null });
      expect(cleared.status()).toBe(200);
      expect((await cleared.json()).birthDate).toBeNull();
      expect(await customerRow(db, state.customerId)).toEqual({
        ...afterOmitted,
        birthDate: null,
      });

      const changed = await patch({ birthDate: '1991-06-02' });
      expect(changed.status()).toBe(200);
      expect((await changed.json()).birthDate).toBe('1991-06-02');
      const afterChanged = { ...afterOmitted, birthDate: '1991-06-02' };
      expect(await customerRow(db, state.customerId)).toEqual(afterChanged);

      const invalid = await patch({ birthDate: '1991-02-30' });
      expect(invalid.status()).toBe(400);
      expect(await customerRow(db, state.customerId)).toEqual(afterChanged);

      const foreignBefore = await customerRow(db, state.foreignCustomerId);
      const foreign = await request.patch(
        `${API}/food-service/customers/${state.foreignCustomerId}`,
        {
          headers: { authorization: `Bearer ${token}`, 'x-wetop-scope': scope(state) },
          data: { isVip: true, birthDate: null },
        },
      );
      expect(foreign.status()).toBe(404);
      expect(await customerRow(db, state.foreignCustomerId)).toEqual(foreignBefore);

      await db.organization.update({
        where: { id: state.organizationId },
        data: { status: 'READ_ONLY' },
      });
      try {
        const readOnlyBefore = await customerRow(db, state.customerId);
        const readOnly = await patch({ isVip: false, birthDate: null });
        expect(readOnly.status()).toBe(403);
        expect(await customerRow(db, state.customerId)).toEqual(readOnlyBefore);
      } finally {
        await db.organization.update({
          where: { id: state.organizationId },
          data: { status: 'ACTIVE' },
        });
      }

      await page.goto('/customers');
      const row = page.getByRole('row').filter({ hasText: state.customerName });
      await row.getByRole('button', { name: 'Изменить' }).click();
      const form = page.getByTestId('customer-marks');
      await screenshotMatrix(page, state, 'd01', 'before');
      await form.getByLabel('Дата рождения').fill('');
      await form.getByRole('button', { name: 'Сохранить' }).click();
      await expect(form).toBeHidden();
      await page.reload();
      await expect(
        page
          .getByRole('row')
          .filter({ hasText: state.customerName })
          .getByTestId('customer-birthday'),
      ).toHaveText('\u2014');
      await screenshotMatrix(page, state, 'd01', 'after');
      expect(await customerRow(db, state.customerId)).toEqual({
        ...afterChanged,
        birthDate: null,
      });
    } finally {
      await db.organization
        .update({ where: { id: state.organizationId }, data: { status: 'ACTIVE' } })
        .catch(() => undefined);
      await db.$disconnect();
    }
  });

  test('Hospitality creates ROOM and BED through guarded API and readonly attempts leave the DB unchanged', async ({
    page,
    request,
  }) => {
    const db = createPrismaClient(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA);
    const createRoom = (data: Record<string, unknown>) =>
      request.post(`${API}/inventory/rooms`, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-wetop-scope': hospitalityScope(state),
        },
        data,
      });
    try {
      const roomCode = `ROOM-${state.run}`;
      const bedCodes = [`BED-A-${state.run}`, `BED-B-${state.run}`];
      const room = await createRoom({
        categoryCode: state.privateCategoryCode,
        building: `Корпус ${state.run}`,
        floor: '1',
        roomNumber: `R-${state.run}`,
        codes: [roomCode],
      });
      expect(room.status()).toBe(201);
      const beds = await createRoom({
        categoryCode: state.dormCategoryCode,
        building: `Корпус ${state.run}`,
        floor: '1',
        roomNumber: `B-${state.run}`,
        codes: bedCodes,
      });
      expect(beds.status()).toBe(201);
      expect(
        await db.inventoryUnit.findMany({
          where: { propertyId: state.propertyId },
          select: { code: true, kind: true },
          orderBy: { code: 'asc' },
        }),
      ).toEqual(
        [
          { code: roomCode, kind: 'ROOM' },
          ...bedCodes.map((code) => ({ code, kind: 'BED' as const })),
        ].sort((a, b) => a.code.localeCompare(b.code)),
      );

      await page.context().addCookies([
        {
          name: 'wetop_scope',
          value: encodeURIComponent(hospitalityScope(state)),
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      await page.goto('/inventory');
      await page.getByRole('button', { name: 'Добавить номер', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Номер', exact: true }).click();
      const lateForm = page.locator('form.fund-form');
      await expect(lateForm).toBeVisible();
      await lateForm.getByLabel('Категория').selectOption(state.privateCategoryCode);
      await lateForm.getByLabel('Корпус').fill(`Поздний корпус ${state.run}`);
      await lateForm.getByLabel('Этаж').fill('9');
      await lateForm.getByLabel('Обозначение комнаты').fill(`LATE-R-${state.run}`);
      await lateForm.getByLabel('Обозначение номера в календаре').fill(`LATE-ROOM-${state.run}`);

      await db.organization.update({
        where: { id: state.organizationId },
        data: { status: 'READ_ONLY' },
      });
      const snapshot = async () => ({
        rooms: await db.physicalRoom.count({
          where: { floor: { building: { propertyId: state.propertyId } } },
        }),
        units: await db.inventoryUnit.count({ where: { propertyId: state.propertyId } }),
        categories: await db.accommodationType.count({ where: { propertyId: state.propertyId } }),
        reservations: await db.reservation.count({ where: { propertyId: state.propertyId } }),
        blocks: await db.inventoryBlock.count({
          where: { inventoryUnit: { propertyId: state.propertyId } },
        }),
        housekeeping: await db.housekeepingEvent.count({
          where: { inventoryUnit: { propertyId: state.propertyId } },
        }),
        barProducts: await db.barProduct.count({ where: { propertyId: state.propertyId } }),
        barReceipts: await db.barReceipt.count({ where: { propertyId: state.propertyId } }),
        barMovements: await db.barStockMovement.count({ where: { propertyId: state.propertyId } }),
        barSales: await db.barSale.count({ where: { propertyId: state.propertyId } }),
        cashOperations: await db.cashOperation.count({ where: { propertyId: state.propertyId } }),
        channelEvents: await db.externalEvent.count({ where: { propertyId: state.propertyId } }),
        channelOutbox: await db.channelOutbox.count({ where: { propertyId: state.propertyId } }),
      });
      const before = await snapshot();

      await lateForm.getByRole('button', { name: 'Создать', exact: true }).click();
      await expect(lateForm.getByRole('alert')).toHaveText(READ_ONLY_MESSAGE);
      await expect(lateForm).toBeVisible();
      expect(await snapshot()).toEqual(before);

      for (const denied of [
        {
          categoryCode: state.privateCategoryCode,
          building: `Корпус ${state.run}`,
          floor: '2',
          roomNumber: `DENIED-R-${state.run}`,
          codes: [`DENIED-ROOM-${state.run}`],
        },
        {
          categoryCode: state.dormCategoryCode,
          building: `Корпус ${state.run}`,
          floor: '2',
          roomNumber: `DENIED-B-${state.run}`,
          codes: [`DENIED-BED-${state.run}`],
        },
      ]) {
        const response = await createRoom(denied);
        expect(response.status()).toBe(403);
      }

      const guardedHeaders = {
        authorization: `Bearer ${token}`,
        'x-wetop-scope': hospitalityScope(state),
      };
      const guardedWrites: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
        ['/reservations', { source: 'SYNTHETIC_INVALID_READONLY' }],
        [`/units/${encodeURIComponent(roomCode)}/housekeeping`, { status: 'CLEAN' }],
        [
          `/units/${encodeURIComponent(roomCode)}/blocks`,
          { dateFrom: '2026-10-20', dateTo: '2026-10-21', type: 'OTHER', reason: 'synthetic' },
        ],
        ['/inventory/categories', { name: '', kind: 'SYNTHETIC_INVALID_READONLY' }],
        ['/bar/products', { code: `READONLY-${state.run}`, salePrice: 'invalid' }],
        ['/bar/receipts', { documentNumber: `READONLY-${state.run}`, lines: [] }],
        ['/bar/write-offs', { productId: 'synthetic-invalid', quantityUnits: '0' }],
        ['/bar/inventory-counts', { productId: 'synthetic-invalid', actualUnits: '-1' }],
        ['/channels/channex/outbox/flush', { probe: 'synthetic-readonly' }],
        ['/channels/channex/pull', { probe: 'synthetic-readonly' }],
        [
          '/channels/channex/events/synthetic-readonly-revision/retry',
          { probe: 'synthetic-readonly' },
        ],
        ['/channels/channex/setup', { ratePlanCode: 'SYNTHETIC_INVALID_READONLY' }],
      ];
      for (const [path, data] of guardedWrites) {
        const response = await request.post(`${API}${path}`, { headers: guardedHeaders, data });
        expect(response.status(), `${path} must be denied before controller validation`).toBe(403);
        expect((await response.json()).message).toBe(READ_ONLY_MESSAGE);
      }
      expect(await snapshot()).toEqual(before);
    } finally {
      await db.organization
        .update({ where: { id: state.organizationId }, data: { status: 'ACTIVE' } })
        .catch(() => undefined);
      await db.$disconnect();
    }
  });

  test('L02 switches genuine Food, Beauty and Hospitality UI contexts with independent API proof', async ({
    page,
    request,
  }) => {
    await expectApiContext(request, token, scope(state), {
      businessId: state.businessId,
      locationId: state.locationId,
      vertical: 'FOOD_SERVICE',
    });
    await page.goto('/today');
    await expect(page).toHaveURL(/\/today$/);
    await expect(
      page.getByRole('heading', {
        name: 'Главная', level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('food-today')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбрать филиал' })).toContainText(
      `Филиал Runtime ${state.run}`,
    );
    await expectHelp(
      page,
      'Начало работы',
      [
        // слова ресторана в меню (аудит 22.10.2026): «Меню» и «Сотрудники»
        ['«Услуги → Меню»', '/menu'],
        ['«Персонал → Сотрудники»', '/employees'],
        ['«Журнал»', '/floor-plan'],
      ],
      ['/services', '/calendar', '/rooms/categories', '/inventory'],
    );

    await switchBranch(page, state.beautyLocationName);
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible();
    await expect(page.getByTestId('beauty-today')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбрать филиал' })).toContainText(
      state.beautyLocationName,
    );
    await expectApiContext(request, token, beautyScope(state), {
      businessId: state.beautyBusinessId,
      locationId: state.beautyLocationId,
      vertical: 'BEAUTY',
    });
    await expectHelp(
      page,
      'Начало работы',
      [
        ['«Услуги → Каталог»', '/services'],
        ['«Персонал → Специалисты»', '/employees'],
        ['«Журнал»', '/calendar'],
      ],
      ['/dining-areas', '/menu', '/floor-plan', '/rooms/categories', '/inventory'],
    );

    await switchBranch(page, state.hospitalityLocationName);
    await expect(page).toHaveURL(/\/finance(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Обзор бизнеса', exact: true })).toBeVisible();
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбрать филиал' })).toContainText(
      state.hospitalityLocationName,
    );
    await expectApiContext(request, token, hospitalityScope(state), {
      businessId: state.hospitalityBusinessId,
      locationId: state.hospitalityLocationId,
      vertical: 'HOSPITALITY',
    });
    await expectHelp(
      page,
      'Начало работы',
      [
        ['«Услуги → Каталог»', '/inventory'],
        ['«Журнал»', '/chessboard'],
      ],
      ['/dining-areas', '/menu', '/floor-plan', '/services', '/employees', '/calendar'],
    );

    await switchBranch(page, `Филиал Runtime ${state.run}`);
    await expect(page).toHaveURL(/\/today$/);
    await expect(
      page.getByRole('heading', {
        name: 'Главная', level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('food-today')).toBeVisible();
  });

  test('KB web saves B as version 2 and publishes it through local fake-embedding storage', async ({
    page,
  }) => {
    await page.goto('/platform/support/base?new=1');
    const editor = page.getByTestId('kb-entry');
    await expect(editor).toBeVisible();
    await editor.getByLabel('Название').fill(`UI-FIX-01 KB ${state.run}`);
    await editor.getByLabel('Текст знания').fill('A, сохранённый исходный текст.');
    await screenshotMatrix(page, state, 'kb', 'before');
    await editor.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page).toHaveURL(/\/platform\/support\/base\?.*id=/);

    const savedEditor = page.getByTestId('kb-entry');
    await savedEditor.getByLabel('Текст знания').fill('B, сохранённый новый текст.');
    await savedEditor.getByRole('button', { name: 'Сохранить' }).click();
    await expect(savedEditor.getByTestId('kb-result')).toHaveText('Сохранено.');
    await savedEditor.getByRole('button', { name: 'Опубликовать' }).click();
    const confirm = page.getByTestId('confirm-dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(savedEditor.getByTestId('kb-result')).toContainText('Опубликовано');
    await page.reload();
    await expect(page.getByTestId('kb-entry').getByText('Версия 2', { exact: true })).toBeVisible();
    await expect(page.getByTestId('kb-entry').getByText('Отвечает')).toBeVisible();
    await expect(page.getByTestId('kb-entry').getByLabel('Текст знания')).toHaveValue(
      'B, сохранённый новый текст.',
    );
    await screenshotMatrix(page, state, 'kb', 'after');
  });
});
