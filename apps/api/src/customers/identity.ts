import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { customerPhoneKey } from '@pms/domain';
import type { DbTx } from '@pms/database';

/** Customer принадлежит организации; DB trigger и UNIQUE защищают все каналы и гонки. */
export async function findOrCreateCustomer(
  tx: Pick<DbTx, 'customer'>,
  organizationId: string,
  customer: { firstName: string; lastName: string | null; phone: string | null },
  archivedMessage = 'Клиент в архиве',
): Promise<{ id: string; created: boolean }> {
  const key = customerPhoneKey(customer.phone);
  const known = customer.phone
    ? await tx.customer.findFirst({
        where: { organizationId, ...(key ? { phoneNormalized: key } : { phone: customer.phone }) },
        select: { id: true, status: true },
      })
    : null;
  if (known && known.status !== 'ACTIVE') throw new ConflictException(archivedMessage);
  if (known) return { id: known.id, created: false };
  const id = randomUUID();
  try {
    await tx.customer.create({ data: {
      id, organizationId, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone,
    } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002')
      throw new ConflictException('Клиент с таким телефоном уже добавляется. Обновите список и повторите действие.');
    throw error;
  }
  return { id, created: true };
}
