import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { decryptPii, encryptPii } from '@pms/shared';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const KEY = 'test-pii-key-for-document-dates-only';

/**
 * v1.7 §3 (ADR-082): даты документа — особо чувствительные данные (`SECURITY.md` §1), в базе лежат шифрованными,
 * как номер. Проверяем саму базу после миграции 20260925000021: открытых колонок `issued_at`/`expires_at` больше нет,
 * в строке — шифртекст (не ISO-дата), расшифровка тем же ключом возвращает дату. Всё вымышленное (ADR-010),
 * убирается за собой.
 */
describe.skipIf(!url)('guest_documents dates encrypted (integration, DATABASE_URL required)', () => {
  let db: Db;
  let migrated = false;
  const guestId = randomUUID();
  const mark = Date.now().toString(36);

  let organizationId = '';
  beforeAll(async () => {
    db = createPrismaClient(url);
    // гость принадлежит организации (DATA_MODEL v1.13, RLS-1)
    organizationId = (await db.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })).id;
    const rows = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'guest_documents'
        AND column_name = 'issued_at_encrypted'`;
    migrated = rows.length > 0;
    if (!migrated)
      console.warn(
        'миграция 20260925000021_v17_document_dates_property_contacts не применена — проверки пропущены',
      );
  });

  afterAll(async () => {
    if (!db) return;
    await db.guestDocument.deleteMany({ where: { guestId } });
    await db.guest.deleteMany({ where: { id: guestId } });
    await db.$disconnect();
  });

  it('открытых колонок дат в таблице нет', async (ctx) => {
    if (!migrated) return ctx.skip();
    const open = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'guest_documents'
        AND column_name IN ('issued_at', 'expires_at')`;
    expect(open).toEqual([]);
  });

  it('в строке — шифртекст, не ISO-дата; расшифровка возвращает дату', async (ctx) => {
    if (!migrated) return ctx.skip();
    await db.guest.create({
      data: { id: guestId, organizationId, firstName: 'Вымышленный', lastName: `Гость-даты-${mark}` },
    });
    const issued = '2021-03-15';
    const expires = '2031-03-14';
    const row = await db.guestDocument.create({
      data: {
        guestId,
        type: 'passport',
        numberEncrypted: encryptPii('N0000000', KEY),
        issueCountry: 'KAZ',
        issuedAtEncrypted: encryptPii(issued, KEY),
        expiresAtEncrypted: encryptPii(expires, KEY),
      },
      select: { issuedAtEncrypted: true, expiresAtEncrypted: true },
    });
    // шифртекст: ISO-даты в значении нет, два шифрования одной даты не совпадают (случайный nonce GCM)
    expect(row.issuedAtEncrypted).not.toContain(issued);
    expect(row.expiresAtEncrypted).not.toContain(expires);
    expect(row.issuedAtEncrypted).not.toBe(encryptPii(issued, KEY));
    expect(decryptPii(row.issuedAtEncrypted!, KEY)).toBe(issued);
    expect(decryptPii(row.expiresAtEncrypted!, KEY)).toBe(expires);
  });

  it('контакты объекта: колонки phone и email у properties есть и допускают NULL', async (ctx) => {
    if (!migrated) return ctx.skip();
    const cols = await db.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'properties'
        AND column_name IN ('phone', 'email')
      ORDER BY column_name`;
    expect(cols).toEqual([
      { column_name: 'email', is_nullable: 'YES' },
      { column_name: 'phone', is_nullable: 'YES' },
    ]);
  });
});
