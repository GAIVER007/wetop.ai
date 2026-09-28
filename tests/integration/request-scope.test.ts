import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { resolveScope } from '../../apps/api/src/auth/scope';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef, propertyIdRef } from '../../apps/api/src/database/property-ref';
import { deleteOrganizationChain } from '../tools/property-owner';

config({ quiet: true });

/**
 * Platform P2, К1 на настоящей базе (план P2 §4–§5, ADR-120): у организации один Business и два филиала с объектами,
 * у соседней — свой. Указатель своего филиала открывает объект этого филиала; чужой или архивный указатель тихо даёт
 * организацию целиком — самый ранний её объект; объект соседа не открывается никаким указателем.
 */
describe.skipIf(!process.env.DATABASE_URL)('scope запроса: указатель → объект (integration)', () => {
  it('свой филиал — его объект; чужой и архивный указатель — организация целиком', async () => {
    const db = createPrismaClient();
    const marker = randomUUID();
    const own = await db.organization.create({ data: { name: `TEST scope ${marker}` } });
    const foreign = await db.organization.create({ data: { name: `TEST scope foreign ${marker}` } });
    const base = { timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' };
    const first = await createPropertyInChain(db, own.id, { name: `TEST scope A ${marker}`, ...base });
    const second = await createPropertyInChain(db, own.id, { name: `TEST scope B ${marker}`, ...base });
    const alien = await createPropertyInChain(db, foreign.id, { name: `TEST scope X ${marker}`, ...base });
    const locationOf = (propertyId: string) =>
      db.location.findFirstOrThrow({ where: { property: { id: propertyId } }, select: { id: true, businessId: true } });
    const [l1, l2, lx] = [await locationOf(first.id), await locationOf(second.id), await locationOf(alien.id)];
    const open = async (pointer: { businessId?: string; locationId?: string }) => {
      const scope = await resolveScope(db, own.id, pointer);
      return {
        scope: scope.scope,
        property: await withSignedInUser({ userId: randomUUID(), organizationId: own.id, ...scope }, () =>
          propertyIdRef(db, 'не важно'),
        ),
      };
    };
    try {
      // оба филиала — у одного Business организации (createPropertyInChain берёт её ранний Business)
      expect(l2.businessId).toBe(l1.businessId);
      expect(await open({})).toEqual({ scope: 'ORGANIZATION', property: first.id });
      expect(await open({ businessId: l2.businessId, locationId: l2.id })).toEqual({
        scope: 'LOCATION',
        property: second.id,
      });
      // соседский Business и филиал — не право: организация целиком, объект соседа не открывается
      expect(await open({ businessId: lx.businessId, locationId: lx.id })).toEqual({
        scope: 'ORGANIZATION',
        property: first.id,
      });
      // свой Business с филиалом соседа — весь указатель отброшен
      expect((await open({ businessId: l1.businessId, locationId: lx.id })).scope).toBe('ORGANIZATION');
      // архивный филиал больше не выбирается
      await db.location.update({ where: { id: l2.id }, data: { status: 'ARCHIVED' } });
      expect(await open({ businessId: l2.businessId, locationId: l2.id })).toEqual({
        scope: 'ORGANIZATION',
        property: first.id,
      });
    } finally {
      await db.property.deleteMany({ where: { id: { in: [first.id, second.id, alien.id] } } });
      await deleteOrganizationChain(db, [own.id, foreign.id]);
      await db.organization.deleteMany({ where: { id: { in: [own.id, foreign.id] } } });
      forgetPropertyRef();
      await db.$disconnect();
    }
  }, 60000);
});
