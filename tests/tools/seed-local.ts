/**
 * Данные для локальной базы: минимальный вымышленный объект, на котором идут интеграционные тесты.
 *
 * Интеграционные тесты писались под dev-БД, где схема `pms_test` получает копию рабочих данных
 * (ADR-042). На пустой локальной базе часть из них падает не по коду, а потому что нет ни объекта,
 * ни единицы «1». Здесь ровно это и создаётся — вымышленное (ADR-010), без единого настоящего гостя.
 *
 * Запускается только против локальной базы: проверка адреса ниже не даёт задеть dev или боевую.
 */
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';

/** Локальный стенд — только `localhost` и `127.0.0.1`: чужую базу этим скриптом не тронуть */
export function isLocalDatabase(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

export const LOCAL_PROPERTY = {
  // Имя — из константы: код ищет объект по нему (`findFirst({ where: { name } })`), и на dev-БД
  // схема `pms_test` получает копию настоящего объекта. Здесь это пустая коробка с тем же именем:
  // ни гостей, ни броней, ни денег — только объект, категория и пять единиц.
  name: LUXX_APARTS_PROPERTY.name,
  legalName: 'ИП «Локальный стенд»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};

/** Категория и пять единиц: номер «1» нужен сторожу овербукинга, остальные — запас на переселения */
const UNITS = ['1', '2', '3', '4', '5'];

export async function seedLocal(db: Db): Promise<{ propertyId: string; units: number }> {
  const property =
    (await db.property.findFirst({ where: { name: LOCAL_PROPERTY.name }, select: { id: true } })) ??
    (await db.property.create({ data: LOCAL_PROPERTY, select: { id: true } }));
  const type =
    (await db.accommodationType.findFirst({
      where: { propertyId: property.id, code: 'LOCAL-SINGLE' },
      select: { id: true },
    })) ??
    (await db.accommodationType.create({
      data: {
        propertyId: property.id,
        code: 'LOCAL-SINGLE',
        name: 'Одноместный (стенд)',
        kind: 'PRIVATE_ROOM',
        capacityAdults: 1,
        capacityChildren: 0,
      },
      select: { id: true },
    }));
  // Единица живёт в комнате, комната на этаже, этаж в корпусе (DATA_MODEL §1) — заводим всю цепочку
  const building =
    (await db.building.findFirst({
      where: { propertyId: property.id, name: 'Стенд' },
      select: { id: true },
    })) ??
    (await db.building.create({
      data: { propertyId: property.id, name: 'Стенд' },
      select: { id: true },
    }));
  const floor =
    (await db.floor.findFirst({
      where: { buildingId: building.id, name: '1' },
      select: { id: true },
    })) ??
    (await db.floor.create({ data: { buildingId: building.id, name: '1' }, select: { id: true } }));
  let created = 0;
  for (const code of UNITS) {
    const exists = await db.inventoryUnit.findFirst({
      where: { exelyRoomNumber: code },
      select: { id: true },
    });
    if (exists) continue;
    const room =
      (await db.physicalRoom.findFirst({
        where: { floorId: floor.id, roomNumber: code },
        select: { id: true },
      })) ??
      (await db.physicalRoom.create({
        data: { floorId: floor.id, roomNumber: code, capacity: 1 },
        select: { id: true },
      }));
    await db.inventoryUnit.create({
      data: {
        physicalRoomId: room.id,
        accommodationTypeId: type.id,
        code: `L${code}`,
        exelyRoomNumber: code,
        kind: 'ROOM',
        active: true,
      },
    });
    created += 1;
  }
  return { propertyId: property.id, units: created };
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) {
    console.error('seed-local: DATABASE_URL должен указывать на localhost — чужую базу не трогаем');
    process.exit(2);
  }
  const db = createPrismaClient(url, process.env.DATABASE_SCHEMA ?? '');
  const r = await seedLocal(db);
  console.log(`объект ${r.propertyId}, новых единиц ${r.units}`);
  await db.$disconnect();
}
