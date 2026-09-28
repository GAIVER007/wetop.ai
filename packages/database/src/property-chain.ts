import type { Prisma } from './generated/prisma/client';

/**
 * Новый объект — сразу в цепочке Organization → Business → Location → Property (DATA_MODEL §18,
 * v2.6: `properties.location_id` NOT NULL). Правила те же, что у backfill миграции
 * 20260927000030: бизнес организации — самый ранний её Business направления HOSPITALITY, а если его
 * нет, заводится один с именем организации; филиал — копия полей объекта (имя, адрес, контакты,
 * часовой пояс, валюта), по одному на объект.
 *
 * Вызывать внутри транзакции: объект без филиала база не примет, а филиал без объекта — мусор.
 * `organization_id` у объекта остаётся (замок ADR-061) и всегда совпадает с организацией Business.
 */
type ChainTx = Pick<Prisma.TransactionClient, 'organization' | 'business' | 'location' | 'property'>;

export type PropertyInChainData = Omit<Prisma.PropertyUncheckedCreateInput, 'organizationId' | 'locationId'>;

/**
 * Умолчания нового объекта — у регистрации и у онбординга организации без объекта (после сброса ADR-118) одни и те
 * же: казахстанские часы и валюта, заезд с 14:00, выезд до 12:00. Реквизиты человек заполнит в настройках.
 */
export const NEW_PROPERTY_DEFAULTS = {
  timezone: 'Asia/Almaty', // tz-allow: значение по умолчанию новой гостиницы, не вычисление времени
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
} as const;

export async function createPropertyInChain(
  tx: ChainTx,
  organizationId: string,
  data: PropertyInChainData,
) {
  const business =
    (await tx.business.findFirst({
      where: { organizationId, vertical: 'HOSPITALITY' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) ??
    (await tx.business.create({
      data: {
        organizationId,
        name: (await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } }))
          .name,
        vertical: 'HOSPITALITY',
      },
      select: { id: true },
    }));
  const location = await tx.location.create({
    data: {
      businessId: business.id,
      name: data.name,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      timezone: data.timezone,
      currency: data.currency,
    },
    select: { id: true },
  });
  return tx.property.create({ data: { ...data, organizationId, locationId: location.id } });
}
