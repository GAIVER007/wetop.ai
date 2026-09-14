import { expect, test } from '@playwright/test';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import type { Chessboard, ReservationCard, StayAvailability } from '../../apps/web/src/lib/api';
import { cleanupAudit } from './cleanup';

config({ path: '.env', quiet: true });
const API = 'http://127.0.0.1:4320';
const iso = (date: Date) => date.toISOString().slice(0, 10);
const plus = (date: string, days: number) => iso(new Date(Date.parse(date) + days * 86_400_000));

test('UI → Nest → Supabase → связанные экраны, с уборкой только своих записей', async ({
  page,
  request,
}) => {
  test.setTimeout(300_000);
  const marker = `E2E-АВТОТЕСТ audit-${randomUUID()}`;
  const surname = `Аудит-${marker.slice(-12)}`;
  const db = createPrismaClient(); // independent pool: assertions see committed rows only
  const read = async <T>(path: string): Promise<T> => {
    const response = await request.get(`${API}${path}`);
    expect(response.ok(), `GET ${path.split('?')[0]} status`).toBe(true);
    return response.json() as Promise<T>;
  };
  let number = '';
  const failures: unknown[] = [];
  try {
    await test.step('настоящая база готова, провайдерские команды недоступны', async () => {
      const status = await read<{
        source: string;
        state: string;
        database: { connected: boolean };
      }>('/system/connection');
      expect(status.source).toBe('database');
      expect(status.state).toBe('READY');
      expect(status.database.connected).toBe(true);
      expect((await request.post(`${API}/channels/channex/sync`)).status()).toBe(403);
    });
    const earliest = plus(iso(new Date()), 110);
    const rate = await db.dailyRate.findFirst({
      where: {
        date: { gte: new Date(earliest) },
        occupancy: 1,
        ratePlan: { active: true },
        accommodationType: { active: true },
      },
      orderBy: { date: 'asc' },
      include: {
        ratePlan: { select: { code: true } },
        accommodationType: { select: { code: true } },
      },
    });
    if (!rate) throw new Error('Audit requires existing future rates; no rates were changed');
    const arrival = iso(rate.date);
    let departure = plus(arrival, 2);
    const category = rate.accommodationType.code;
    const before = await read<StayAvailability>(
      `/availability?arrival=${arrival}&departure=${departure}`,
    );
    const unit = before.byCategory[category]?.availableUnitCodes[0];
    if (!unit) throw new Error('No free audit unit; existing stays were not changed');
    let guestId = '';
    let itemId = '';

    await test.step('создание в форме сохраняет бронь, гостя и размещение отдельным коммитом', async () => {
      await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
      const form = page.getByTestId('new-reservation-form');
      await form.locator('[name="source"]').selectOption('PHONE');
      await form.locator('[name="accommodationTypeCode"]').selectOption(category);
      await form.locator('[name="ratePlanCode"]').selectOption(rate.ratePlan.code);
      await form.locator('[name="unitCode"]').selectOption(unit);
      await form.locator('[name="firstName"]').fill('Синтетический');
      await form.locator('[name="lastName"]').fill(surname);
      await form.locator('[name="notes"]').fill(marker);
      await form.getByRole('button', { name: 'Создать бронь', exact: true }).click();
      await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
      number = page.url().split('/').pop()!;
      const saved = await db.reservation.findFirstOrThrow({
        where: { notes: marker },
        include: { items: { include: { allocations: true } } },
      });
      expect(saved.confirmationNumber).toBe(number);
      expect(saved.items).toHaveLength(1);
      expect(saved.items[0]!.allocations).toHaveLength(1);
      guestId = saved.primaryGuestId!;
      itemId = saved.items[0]!.id;
      await page.reload();
      await expect(page.getByTestId('guest-link')).toContainText(surname);
      // Normal application API uses the same database, independent of the audit instance.
      const normal = await request.get(`http://127.0.0.1:3001/reservations/${number}`);
      expect(normal.ok()).toBe(true);
      expect(((await normal.json()) as ReservationCard).primaryGuest?.id).toBe(guestId);
    });

    await test.step('редактирование гостя обновляет Supabase, бронь, историю и шахматку', async () => {
      await page.getByTestId('guest-link').click();
      const form = page.getByTestId('guest-form');
      await form.locator('[name="firstName"]').fill('Проверено');
      await form.locator('[name="notes"]').fill(marker);
      await form.locator('[name="citizenship"]').fill('KAZ');
      await form.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect
        .poll(async () => (await db.guest.findUniqueOrThrow({ where: { id: guestId } })).firstName)
        .toBe('Проверено');
      await page.reload();
      await expect(form.locator('[name="firstName"]')).toHaveValue('Проверено');
      const document = page.getByTestId('document-form');
      const syntheticDocument = `TEST-${marker.slice(-12)}`;
      await document.locator('[name="number"]').fill(syntheticDocument);
      await document.locator('[name="issueCountry"]').fill('KAZ');
      await document.getByRole('button', { name: 'Добавить', exact: true }).click();
      await expect.poll(() => db.guestDocument.count({ where: { guestId } })).toBe(1);
      const encrypted = await db.guestDocument.findFirstOrThrow({ where: { guestId } });
      expect(encrypted.numberEncrypted.includes(syntheticDocument)).toBe(false);
      await page.reload();
      await expect(page.getByTestId('document-row')).toContainText(syntheticDocument.slice(-4));
      await page
        .getByTestId('document-row')
        .getByRole('button', { name: 'удалить', exact: true })
        .click();
      await expect.poll(() => db.guestDocument.count({ where: { guestId } })).toBe(0);
      await page.getByRole('tab', { name: 'Проживания', exact: true }).click();
      await page.getByRole('link', { name: number, exact: true }).click();
      await expect(page.getByTestId('guest-link')).toContainText('Проверено');
      await page.goto(`/chessboard?from=${arrival}&to=${plus(departure, -1)}`);
      await expect(
        page.locator(`[data-testid="stay-cell"][data-number="${number}"]`).first(),
      ).toContainText('Проверено');
      const board = await read<Chessboard>(`/chessboard?from=${arrival}&to=${plus(departure, -1)}`);
      const own = board.rows.find((row) => row.unit.code === unit)!;
      expect(own.cells.filter((cell) => cell.confirmationNumber === number)).toHaveLength(2);
      const available = await read<StayAvailability>(
        `/availability?arrival=${arrival}&departure=${departure}`,
      );
      expect(available.byCategory[category]!.availableUnitCodes.includes(unit)).toBe(false);
    });

    await test.step('переполнение вместимости отклоняется без изменения сохранённой брони', async () => {
      const invalid = await request.patch(`${API}/reservations/${number}/items/${itemId}`, {
        data: { adults: 999 },
      });
      expect(invalid.status()).toBe(422);
      expect((await db.reservationItem.findUniqueOrThrow({ where: { id: itemId } })).adults).toBe(
        1,
      );
    });

    await test.step('правка источника и дат обновляет бронь, размещение, список и карточку гостя', async () => {
      await page.goto(`/reservations/${number}`);
      await page.getByRole('tab', { name: 'Действия', exact: true }).click();
      const edit = page.getByTestId('edit-reservation-form');
      await edit.locator('[name="source"]').selectOption('WHATSAPP');
      await edit.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect
        .poll(
          async () => (await db.reservation.findFirstOrThrow({ where: { notes: marker } })).source,
        )
        .toBe('WHATSAPP');
      const dates = page
        .getByTestId('reservation-actions')
        .locator('form')
        .filter({ has: page.locator('[name="departureDate"]') });
      const extended = plus(departure, 1);
      await dates.locator('[name="departureDate"]').fill(extended);
      await dates.getByRole('button', { name: 'Пересчитать и сохранить' }).click();
      await expect
        .poll(async () =>
          iso(
            (await db.reservationItem.findUniqueOrThrow({ where: { id: itemId } })).departureDate,
          ),
        )
        .toBe(extended);
      departure = extended;
      const allocation = await db.allocation.findFirstOrThrow({
        where: { reservationItemId: itemId },
      });
      expect(iso(allocation.endDate)).toBe(extended);
      await page.goto(`/reservations?from=${arrival}&to=${departure}&q=${number}`);
      const row = page.locator('tbody tr').filter({ hasText: number });
      await expect(row).toContainText('Проверено');
      await expect(row).toContainText('WhatsApp');
      await page.goto(`/guests?q=${encodeURIComponent(surname)}`);
      await expect(page.getByTestId('guests-table').locator('tbody tr')).toHaveCount(1);
      await expect(page.getByTestId('guests-table')).toContainText('Проверено');
    });

    await test.step('счёт: начисление, платёж и возврат из UI сохраняются в Supabase', async () => {
      await page.goto(`/reservations/${number}`);
      await page.getByRole('tab', { name: 'Счета', exact: true }).click();
      const panel = page.getByTestId('folio-panel');
      const charge = panel.getByTestId('charge-form');
      await charge.locator('[name="kind"]').selectOption('ADJUSTMENT');
      await charge.locator('[name="description"]').fill(marker);
      await charge.locator('[name="unitPrice"]').fill('1.25');
      await charge.getByRole('button', { name: 'Начислить' }).click();
      await expect
        .poll(() => db.charge.count({ where: { description: marker, amount: 125n } }))
        .toBe(1);
      const payment = panel.getByTestId('payment-form');
      await payment.locator('[name="amount"]').fill('1.25');
      await payment.locator('[name="note"]').fill(marker);
      await payment.getByRole('button', { name: 'Принять оплату' }).click();
      await expect.poll(() => db.payment.count({ where: { note: marker, amount: 125n } })).toBe(1);
      await expect(panel.getByTestId('payment-row')).toHaveCount(1);
      const refund = panel.getByTestId('refund-form');
      await refund.locator('[name="amount"]').fill('1.25');
      await refund.locator('[name="reason"]').fill(marker);
      await refund.getByRole('button', { name: 'вернуть', exact: true }).click();
      await expect.poll(() => db.refund.count({ where: { reason: marker, amount: 125n } })).toBe(1);
      await page.reload();
      await page.getByRole('tab', { name: 'Счета', exact: true }).click();
      await expect(panel.getByTestId('payment-row')).toContainText('1,25');
      const saved = await db.folio.findUniqueOrThrow({
        where: { reservationItemId: itemId },
        include: { charges: true, allocations: true, refunds: true },
      });
      expect(
        saved.allocations.reduce((sum, p) => sum + p.amount, 0n) -
          saved.refunds.reduce((sum, r) => sum + r.amount, 0n),
      ).toBe(0n);
      await page.goto(`/guests/${guestId}`);
      await page.getByRole('tab', { name: 'Счета и услуги', exact: true }).click();
      await page.locator('.guest-account-links a').filter({ hasText: number }).click();
      await expect(page.getByRole('tab', { name: 'Счета', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('payment-row')).toContainText('1,25');
    });

    await test.step('отмена освобождает шахматку и доступность; статус виден в карточке', async () => {
      await page.getByRole('tab', { name: 'Действия', exact: true }).click();
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByTestId('cancel-reservation').click();
      await expect
        .poll(
          async () =>
            (await db.reservationItem.findUniqueOrThrow({ where: { id: itemId } })).status,
        )
        .toBe('CANCELLED');
      await page.reload();
      await expect(page.getByTestId('stay-row')).toContainText('отменена');
      const after = await read<Chessboard>(`/chessboard?from=${arrival}&to=${plus(departure, -1)}`);
      expect(
        after.rows.flatMap((row) => row.cells).some((cell) => cell.confirmationNumber === number),
      ).toBe(false);
      const available = await read<StayAvailability>(
        `/availability?arrival=${arrival}&departure=${departure}`,
      );
      expect(available.byCategory[category]!.availableUnitCodes.includes(unit)).toBe(true);
    });

    await test.step('блокировка номера сохраняется, видна после reload и снимается из UI', async () => {
      await page.goto(`/units/${encodeURIComponent(unit)}`);
      const form = page.getByTestId('block-form');
      await form.locator('[name="dateFrom"]').fill(arrival);
      await form.locator('[name="dateTo"]').fill(departure);
      await form.locator('[name="reason"]').fill(marker);
      await form.getByRole('button', { name: 'Заблокировать', exact: true }).click();
      await expect.poll(() => db.inventoryBlock.count({ where: { reason: marker } })).toBe(1);
      await page.reload();
      const block = page.getByTestId('block-row').filter({ hasText: marker });
      await expect(block).toBeVisible();
      const available = await read<StayAvailability>(
        `/availability?arrival=${arrival}&departure=${departure}`,
      );
      expect(available.byCategory[category]!.availableUnitCodes.includes(unit)).toBe(false);
      await block.getByRole('button', { name: 'снять', exact: true }).click();
      await expect.poll(() => db.inventoryBlock.count({ where: { reason: marker } })).toBe(0);
      const restored = await read<StayAvailability>(
        `/availability?arrival=${arrival}&departure=${departure}`,
      );
      expect(restored.byCategory[category]!.availableUnitCodes.includes(unit)).toBe(true);
    });

    await test.step('сайт аналитики: создание, пауза, повторное чтение и удаление', async () => {
      await page.goto('/analytics/setup');
      await page.getByTestId('site-name').fill(marker);
      await page.getByTestId('site-hosts').fill(`audit-${marker.slice(-12)}.example.invalid`);
      await page.getByTestId('site-create').click();
      await expect.poll(() => db.trackedSite.count({ where: { name: marker } })).toBe(1);
      const card = page.getByTestId('site-card').filter({ hasText: marker });
      await card.getByTestId('site-toggle').click();
      await expect
        .poll(
          async () => (await db.trackedSite.findFirstOrThrow({ where: { name: marker } })).status,
        )
        .toBe('PAUSED');
      await page.reload();
      await expect(card.getByTestId('site-card-status')).toHaveText('на паузе');
      page.once('dialog', (dialog) => void dialog.accept());
      await card.getByTestId('site-delete').click();
      await expect.poll(() => db.trackedSite.count({ where: { name: marker } })).toBe(0);
      await expect(card).toHaveCount(0);
    });
  } catch (error) {
    failures.push(error);
  }
  try {
    await cleanupAudit(db, marker);
    expect(await db.reservation.count({ where: { notes: { startsWith: marker } } })).toBe(0);
    expect(await db.payment.count({ where: { note: marker } })).toBe(0);
    expect(await db.guest.count({ where: { notes: marker } })).toBe(0);
    expect(await db.inventoryBlock.count({ where: { reason: marker } })).toBe(0);
    expect(await db.trackedSite.count({ where: { name: marker } })).toBe(0);
  } catch (error) {
    failures.push(error);
  } finally {
    await db.$disconnect();
  }
  if (failures.length)
    throw new AggregateError(failures, `System audit failed: ${marker}`, { cause: failures[0] });
});
