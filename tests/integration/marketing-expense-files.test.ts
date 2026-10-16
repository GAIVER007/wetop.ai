import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MemorySiteAssetStorage } from '../../apps/api/src/marketing-site/asset-storage';
import { EXPENSE_FILES_MAX, ExpenseFilesService } from '../../apps/api/src/marketing-budget/expense-files';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import { MarketingBudgetService } from '../../apps/api/src/marketing-budget/marketing-budget.service';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Чеки и файлы расходов маркетинга (DATA_MODEL §51, ADR-MKT-B7) на настоящей базе и хранилище в памяти: фото хранится
 * WebP без EXIF, PDF как есть, поддельный PDF и чужой формат отвергаются, тот же файл второй раз не ложится, чужой
 * филиал неотличим от несуществующего (404), удаление пишется в журнал, а расход уносит свои файлы (CASCADE), объект
 * в хранилище остаётся. Данные вымышленные (ADR-010).
 */
describe('чеки расходов маркетинга (integration)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Чеки проверяются только на локальной PostgreSQL');
  const prisma = new PrismaService();
  const db = prisma.db;
  const storage = new MemorySiteAssetStorage();
  const repo = new PrismaMarketingBudgetRepository(prisma);
  const files = new ExpenseFilesService(prisma, repo, storage);
  const budget = new MarketingBudgetService(repo, storage);
  const tag = randomUUID().slice(0, 8);
  const user = randomUUID();
  const org = randomUUID();
  const branch = { own: { business: randomUUID(), location: randomUUID() }, other: { business: randomUUID(), location: randomUUID() } };
  const as = <T>(b: keyof typeof branch, fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, scope: 'LOCATION', businessId: branch[b].business, locationId: branch[b].location, vertical: 'HOSPITALITY' },
      fn,
    );
  let expenseId = '';
  let otherExpenseId = '';
  const png = (seed: number) =>
    // цвета разнесены: соседние оттенки после WebP дают одинаковые байты, и это был бы честный повтор
    sharp({ create: { width: 120, height: 80, channels: 3, background: { r: (seed * 37) % 256, g: (seed * 71) % 256, b: (seed * 113) % 256 } } })
      .withMetadata({ exif: { IFD0: { Copyright: 'чек' } } })
      .png()
      .toBuffer();
  const pdf = Buffer.from('%PDF-1.4\n% вымышленный чек\n%%EOF\n');

  beforeAll(async () => {
    await db.user.create({ data: { id: user, email: `mkt-files-${tag}@example.invalid` } });
    await db.organization.create({ data: { id: org, name: `Чеки ${tag}`, status: 'ACTIVE' } });
    for (const b of ['own', 'other'] as const) {
      await db.business.create({ data: { id: branch[b].business, organizationId: org, name: `${b} ${tag}`, vertical: 'HOSPITALITY' } });
      await db.location.create({ data: { id: branch[b].location, businessId: branch[b].business, name: `${b} ${tag}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
    }
    const expense = (location: string) =>
      db.marketingExpense.create({
        data: {
          locationId: location,
          date: new Date('2026-10-08T00:00:00Z'),
          platform: 'META',
          category: 'Реклама',
          amount: 12000n,
          currency: 'KZT',
          fxRate: '1',
          baseAmount: 12000n,
        },
        select: { id: true },
      });
    expenseId = (await expense(branch.own.location)).id;
    otherExpenseId = (await expense(branch.other.location)).id;
  });

  afterAll(async () => {
    await purgeAuditRows(db, { entityType: 'marketing_expense', entityId: { in: [expenseId, otherExpenseId] } });
    await db.marketingExpense.deleteMany({ where: { locationId: { in: [branch.own.location, branch.other.location] } } });
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.user.deleteMany({ where: { id: user } });
    await prisma.onModuleDestroy();
  });

  it('фото WebP без EXIF и PDF как есть; повтор не дублирует; чужое и поддельное отвергается', async () => {
    const photo = await as('own', async () => files.upload(expenseId, { buffer: await png(10), originalname: 'чек-мета.png' }));
    expect(photo.created).toBe(true);
    expect(photo.file).toMatchObject({ fileName: 'чек-мета.png', mimeType: 'image/webp' });
    const row = await db.marketingExpenseFile.findUniqueOrThrow({ where: { id: photo.file.id } });
    expect(row.storageRef).toBe(`marketing-expense-files/${branch.own.location}/${row.id}/${row.sha256}.webp`);
    const stored = storage.objects.get(row.storageRef);
    expect((await sharp(stored!.body).metadata()).exif).toBeUndefined();

    const again = await as('own', async () => files.upload(expenseId, { buffer: await png(10), originalname: 'копия.png' }));
    expect(again).toMatchObject({ created: false, file: { id: photo.file.id } });

    const doc = await as('own', () => files.upload(expenseId, { buffer: pdf, originalname: '../../счёт.pdf' }));
    expect(doc.file).toMatchObject({ fileName: 'счёт.pdf', mimeType: 'application/pdf' });

    await expect(as('own', () => files.upload(expenseId, { buffer: Buffer.from('<svg/>'), originalname: 'x.svg' }))).rejects.toMatchObject({ status: 415 });
    // расход другого филиала из этого филиала не виден: как несуществующий
    await expect(as('own', () => files.upload(otherExpenseId, { buffer: pdf }))).rejects.toMatchObject({ status: 404 });
    await expect(as('own', () => files.upload(randomUUID(), { buffer: pdf }))).rejects.toMatchObject({ status: 404 });

    // ответ «Бюджета» несёт файлы расхода с подписанными адресами
    const view = await as('own', () => budget.view('2026-10'));
    const listed = view.expenses.find((e) => e.id === expenseId)!.files!;
    expect(listed.map((f) => f.fileName)).toEqual(['чек-мета.png', 'счёт.pdf']);
    expect(listed.every((f) => typeof f.url === 'string')).toBe(true);
  });

  it(`не больше ${EXPENSE_FILES_MAX} файлов; удаление в журнал; расход уносит файлы, объект в хранилище остаётся`, async () => {
    const live = await db.marketingExpenseFile.count({ where: { expenseId } });
    for (let i = live; i < EXPENSE_FILES_MAX; i += 1)
      await as('own', async () => files.upload(expenseId, { buffer: await png(100 + i) }));
    await expect(as('own', async () => files.upload(expenseId, { buffer: await png(250) }))).rejects.toMatchObject({ status: 400 });

    const one = await db.marketingExpenseFile.findFirstOrThrow({ where: { expenseId }, orderBy: { createdAt: 'asc' } });
    await expect(as('other', () => files.remove(expenseId, one.id))).rejects.toMatchObject({ status: 404 });
    await as('own', () => files.remove(expenseId, one.id));
    expect(await db.marketingExpenseFile.count({ where: { id: one.id } })).toBe(0);
    expect(storage.objects.has(one.storageRef)).toBe(true);
    expect(await db.auditLog.count({ where: { entityId: expenseId, action: 'marketing_expense.file_removed' } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: expenseId, action: 'marketing_expense.file_added' } })).toBe(EXPENSE_FILES_MAX);

    const left = await db.marketingExpenseFile.findMany({ where: { expenseId }, select: { storageRef: true } });
    await db.marketingExpense.delete({ where: { id: expenseId } });
    expect(await db.marketingExpenseFile.count({ where: { expenseId } })).toBe(0);
    expect(storage.objects.has(left[0]!.storageRef)).toBe(true);
  });
});
