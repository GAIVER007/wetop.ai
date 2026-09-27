import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { DEFAULT_SELLER_PROFILE } from '@pms/domain';
import {
  PrismaSellerFactsRepository,
  PrismaSellerProfilesRepository,
} from '../../apps/api/src/ai-seller/seller.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { purgeAuditRows } from '../tools/audit-purge';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Профиль ИИ-продавца и факты объекта (DATA_MODEL §15 v1.8, миграция 20260924000019, ТЗ ред. 1 П5, П8; ADR-081).
 * Проверяется сама база: одна строка на организацию, правка пишет журнал действий; перечисления и пределы — модели бота
 * `SellerProfile`: эмодзи тремя значениями, длина двумя, языков от одного до шести, запретов и «когда звать человека»
 * не больше 30 строк. Факты берут только активные категории и номера, тариф виджета сайта с его валютой и его цены в
 * окне. Всё вымышленное (ADR-010), убирается за собой.
 */
describe.skipIf(!url)('seller_profiles и факты объекта (integration, DATABASE_URL required)', () => {
  let db: Db;
  let profiles: PrismaSellerProfilesRepository;
  let factsRepo: PrismaSellerFactsRepository;
  const mark = Date.now().toString(36);
  const org = randomUUID();
  const emptyOrg = randomUUID();
  const now = new Date('2026-09-24T09:00:00.000Z');
  let propertyId = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as PrismaService;
    profiles = new PrismaSellerProfilesRepository(prisma);
    factsRepo = new PrismaSellerFactsRepository(prisma);

    await db.organization.createMany({
      data: [
        { id: org, name: `Тест продавца ${mark}` },
        { id: emptyOrg, name: `Тест продавца без объекта ${mark}` },
      ],
    });
    const property = await db.property.create({
      data: {
        organizationId: org,
        name: `Хостел продавца ${mark}`,
        address: 'Алматы, ул. Вымышленная, 1',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    propertyId = property.id;
    const building = await db.building.create({ data: { propertyId, name: 'Корпус' } });
    const floor = await db.floor.create({ data: { buildingId: building.id, name: '1' } });
    const dbl = await db.accommodationType.create({
      data: { propertyId, code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
    });
    const dorm = await db.accommodationType.create({
      data: { propertyId, code: 'DORM', name: 'Место в общем', kind: 'DORM_BED', capacityAdults: 1 },
    });
    const old = await db.accommodationType.create({
      data: { propertyId, code: 'OLD', name: 'Снятая', kind: 'PRIVATE_ROOM', capacityAdults: 2, active: false },
    });
    Object.assign(ids, { dbl: dbl.id, dorm: dorm.id, old: old.id });
    const room = await db.physicalRoom.create({
      data: { floorId: floor.id, roomNumber: `S-${mark}`, capacity: 4 },
    });
    await db.inventoryUnit.createMany({
      data: [
        { propertyId, physicalRoomId: room.id, accommodationTypeId: dbl.id, kind: 'ROOM', code: `S-${mark}-1` },
        { propertyId, physicalRoomId: room.id, accommodationTypeId: dbl.id, kind: 'ROOM', code: `S-${mark}-2` },
        { propertyId, physicalRoomId: room.id, accommodationTypeId: dbl.id, kind: 'ROOM', code: `S-${mark}-3`, active: false },
        { propertyId, physicalRoomId: room.id, accommodationTypeId: dorm.id, kind: 'BED', code: `S-${mark}-4` },
      ],
    });
    const site = await db.ratePlan.create({
      data: { propertyId, code: `SITE-${mark}`, name: 'Базовый тариф', currency: 'KZT' },
    });
    const ota = await db.ratePlan.create({
      data: { propertyId, code: `OTA-${mark}`, name: 'Тариф ОТА', currency: 'KZT' },
    });
    Object.assign(ids, { site: site.id, ota: ota.id });
    await db.trackedSite.create({
      data: {
        propertyId,
        name: 'Сайт хостела',
        hosts: ['hostel.example.invalid'],
        publicKey: `pms_${mark.padStart(12, '0').slice(-12)}`,
        bookingEnabled: true,
        bookingRatePlanId: site.id,
      },
    });
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    await db.dailyRate.createMany({
      data: [
        { date: day('2026-09-23'), accommodationTypeId: dbl.id, ratePlanId: site.id, occupancy: 2, price: 1_400_000n },
        { date: day('2026-09-24'), accommodationTypeId: dbl.id, ratePlanId: site.id, occupancy: 2, price: 1_500_000n },
        { date: day('2026-09-24'), accommodationTypeId: dbl.id, ratePlanId: site.id, occupancy: 1, price: 1_250_050n },
        { date: day('2026-11-22'), accommodationTypeId: dorm.id, ratePlanId: site.id, occupancy: 1, price: 450_000n },
        { date: day('2026-11-23'), accommodationTypeId: dorm.id, ratePlanId: site.id, occupancy: 1, price: 460_000n },
        { date: day('2026-09-24'), accommodationTypeId: dbl.id, ratePlanId: ota.id, occupancy: 2, price: 2_100_000n },
        { date: day('2026-09-24'), accommodationTypeId: old.id, ratePlanId: site.id, occupancy: 1, price: 999_900n },
      ],
    });
  });

  afterAll(async () => {
    await purgeAuditRows(db, { entityType: 'SellerProfile', entityId: org });
    await purgeAuditRows(db, { entityType: 'SellerProfile', entityId: emptyOrg });
    await db.sellerProfile.deleteMany({ where: { organizationId: { in: [org, emptyOrg] } } });
    await db.dailyRate.deleteMany({ where: { ratePlanId: { in: [ids.site!, ids.ota!] } } });
    await db.trackedSite.deleteMany({ where: { propertyId } });
    await db.ratePlan.deleteMany({ where: { propertyId } });
    await db.inventoryUnit.deleteMany({ where: { code: { startsWith: `S-${mark}-` } } });
    await db.physicalRoom.deleteMany({ where: { roomNumber: `S-${mark}` } });
    await db.accommodationType.deleteMany({ where: { propertyId } });
    await db.floor.deleteMany({ where: { building: { propertyId } } });
    await db.building.deleteMany({ where: { propertyId } });
    await db.property.deleteMany({ where: { id: propertyId } });
    await db.organization.deleteMany({ where: { id: { in: [org, emptyOrg] } } });
    await db.$disconnect();
  });

  it('первая правка заводит строку организации и пишет журнал: до — пусто, после — поля', async () => {
    expect(await profiles.get(org)).toBeNull();
    const saved = await profiles.save(org, { ...DEFAULT_SELLER_PROFILE, botName: 'Айгерим' }, null, now);
    expect(saved).toMatchObject({ organizationId: org, botName: 'Айгерим', profileAppliedAt: null });
    const again = await profiles.save(
      org,
      {
        ...DEFAULT_SELLER_PROFILE,
        botName: 'Айгерим',
        emoji: 'GREETING_ONLY',
        replyLength: 'DETAILED',
        extraCharges: 'Трансфер',
        prohibitions: ['Не курить в номерах', 'Без животных'],
        callHumanWhen: ['Группа от 6 человек'],
        faq: [{ question: 'Завтрак?', answer: 'Нет' }],
      },
      null,
      new Date(now.getTime() + 1_000),
    );
    expect(again).toMatchObject({
      emoji: 'GREETING_ONLY',
      replyLength: 'DETAILED',
      extraCharges: 'Трансфер',
      prohibitions: ['Не курить в номерах', 'Без животных'],
      callHumanWhen: ['Группа от 6 человек'],
    });
    expect(again.faq).toEqual([{ question: 'Завтрак?', answer: 'Нет' }]);
    // списки читаются из базы теми же, что записаны: порядок строк — порядок правил
    expect((await profiles.get(org))!.prohibitions).toEqual(['Не курить в номерах', 'Без животных']);
    expect(await db.sellerProfile.count({ where: { organizationId: org } })).toBe(1);

    const log = await db.auditLog.findMany({
      where: { entityType: 'SellerProfile', entityId: org },
      orderBy: { createdAt: 'asc' },
    });
    expect(log.map((l) => l.action)).toEqual(['seller.profile.updated', 'seller.profile.updated']);
    expect(log[0]!.before).toBeNull();
    expect(log[1]!.before).toMatchObject({ emoji: 'NEVER', prohibitions: [] });
    expect(log[1]!.after).toMatchObject({ emoji: 'GREETING_ONLY', prohibitions: ['Не курить в номерах', 'Без животных'] });
  });

  it('отметки доставки и ошибки продавца', async () => {
    const version = (await profiles.get(org))!.updatedAt;
    await profiles.markProfileApplied(org, version);
    await profiles.markFactsApplied(org, 'a'.repeat(64), now);
    await profiles.markError(org, 'ИИ-продавец недоступен (HTTP 502)', now);
    let row = (await profiles.get(org))!;
    expect(row.profileAppliedAt?.getTime()).toBe(version.getTime());
    expect(row.factsHash).toBe('a'.repeat(64));
    expect(row.lastError).toBe('ИИ-продавец недоступен (HTTP 502)');
    await profiles.clearError(org);
    row = (await profiles.get(org))!;
    expect(row.lastError).toBeNull();
    expect(row.lastErrorAt).toBeNull();
  });

  it('языков от одного до шести — правило самой базы', async () => {
    const insert = (languages: string[]) =>
      db.$executeRawUnsafe(
        `INSERT INTO seller_profiles (organization_id, address_form, reply_length, languages, updated_at)
         VALUES ($1::uuid, 'FORMAL', 'SHORT', $2::text[], now())`,
        emptyOrg,
        languages,
      );
    await expect(insert([])).rejects.toThrow(/seller_profiles_languages_check|check constraint/i);
    await expect(insert(['ru', 'kk', 'en', 'zh', 'uz', 'ky', 'tr'])).rejects.toThrow(
      /seller_profiles_languages_check|check constraint/i,
    );
  });

  it('запретов и «когда звать человека» — не больше 30 строк; перечисления — только значения бота', async () => {
    const insert = (column: 'prohibitions' | 'call_human_when', items: string[]) =>
      db.$executeRawUnsafe(
        `INSERT INTO seller_profiles (organization_id, address_form, reply_length, languages, ${column}, updated_at)
         VALUES ($1::uuid, 'FORMAL', 'SHORT', ARRAY['ru'], $2::text[], now())`,
        emptyOrg,
        items,
      );
    const many = Array.from({ length: 31 }, (_, i) => `Правило ${i + 1}`);
    await expect(insert('prohibitions', many)).rejects.toThrow(
      /seller_profiles_prohibitions_check|check constraint/i,
    );
    await expect(insert('call_human_when', many)).rejects.toThrow(
      /seller_profiles_call_human_when_check|check constraint/i,
    );
    const withLength = (length: string) =>
      db.$executeRawUnsafe(
        `INSERT INTO seller_profiles (organization_id, address_form, reply_length, languages, updated_at)
         VALUES ($1::uuid, 'FORMAL', $2::"SellerReplyLength", ARRAY['ru'], now())`,
        emptyOrg,
        length,
      );
    // «средне» и «подробно» первой редакции у бота нет — у базы тоже
    await expect(withLength('MEDIUM')).rejects.toThrow(/invalid input value for enum/i);
    const withEmoji = (emoji: string) =>
      db.$executeRawUnsafe(
        `INSERT INTO seller_profiles (organization_id, address_form, emoji, reply_length, languages, updated_at)
         VALUES ($1::uuid, 'FORMAL', $2::"SellerEmoji", 'SHORT', ARRAY['ru'], now())`,
        emptyOrg,
        emoji,
      );
    await expect(withEmoji('ALWAYS')).rejects.toThrow(/invalid input value for enum/i);
    // пустые списки по умолчанию — годятся
    await withEmoji('GREETING_ONLY');
    expect((await profiles.get(emptyOrg))!).toMatchObject({
      emoji: 'GREETING_ONLY',
      prohibitions: [],
      callHumanWhen: [],
    });
    await db.sellerProfile.deleteMany({ where: { organizationId: emptyOrg } });
  });

  it('факты: активные категории с числом активных мест, тариф сайта, его цены в окне', async () => {
    const source = await factsRepo.load(org, now);
    expect(source).not.toBeNull();
    expect(source!.property).toEqual({
      name: `Хостел продавца ${mark}`,
      address: 'Алматы, ул. Вымышленная, 1',
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    expect(source!.categories).toEqual([
      { code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 2 },
      { code: 'DORM', name: 'Место в общем', kind: 'DORM_BED', capacityAdults: 1, units: 1 },
    ]);
    expect(source!.ratePlan).toEqual({ code: `SITE-${mark}`, name: 'Базовый тариф', currency: 'KZT' });
    expect(source!.window).toEqual({ from: '2026-09-24', to: '2026-11-22' });
    const rates = source!.rates
      .map((r) => `${r.categoryCode} ${r.date} ${r.occupancy} ${r.priceMinor}`)
      .sort();
    expect(rates).toEqual([
      'DBL 2026-09-24 1 1250050',
      'DBL 2026-09-24 2 1500000',
      'DORM 2026-11-22 1 450000',
    ]);
  });

  it('у организации нет объекта — фактов нет', async () => {
    expect(await factsRepo.load(emptyOrg, now)).toBeNull();
  });

  it('инструкция одним текстом (ADR-097): в строку организации, поля прежних шагов целы, в журнал — только длина', async () => {
    const text = 'Отвечай на «вы», коротко. Парковки нет, рядом городская.';
    const at = new Date(now.getTime() + 2_000);
    const row = await profiles.savePrompt(org, text, null, at);
    expect(row).toMatchObject({ promptText: text, botName: 'Айгерим' });
    expect(row.updatedAt.getTime()).toBe(at.getTime());
    const log = await db.auditLog.findFirst({
      where: { entityType: 'SellerProfile', entityId: org, action: 'seller.prompt.updated' },
    });
    expect(log!.after).toEqual({ length: text.length });
    // первая правка организации — сразу инструкцией: строка заводится с настройками по умолчанию
    const fresh = await profiles.savePrompt(emptyOrg, text, null, at);
    expect(fresh).toMatchObject({
      organizationId: emptyOrg,
      promptText: text,
      languages: DEFAULT_SELLER_PROFILE.languages,
      profileAppliedAt: null,
    });
  });
});
