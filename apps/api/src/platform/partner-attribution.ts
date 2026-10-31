import { parseChannel, parsePartnerCode } from './partner-cabinet';

/** То, что нужно от транзакции: найти партнёра по коду, записать «чей клиент» и журнал */
export interface AttributionTx {
  platformPartner: { findUnique(args: { where: { code: string } }): PromiseLike<{ id: string; active: boolean } | null> };
  platformClientPartner: { create(args: { data: { organizationId: string; partnerId: string; source: string; channel: string | null; updatedBy: string | null } }): PromiseLike<unknown> };
  auditLog: { create(args: { data: { userId: string | null; entityType: string; entityId: string; action: string; after: { partnerId: string; source: string; channel: string | null } } }): PromiseLike<unknown> };
}

/**
 * Регистрация по ссылке партнёра (DATA_MODEL §63.3, ТЗ VTOP 01.11.2026): в той же транзакции, что новая организация,
 * клиент привязывается к действующему партнёру с источником `LINK` и каналом. Нет кода, чужая строка, неизвестный или
 * выключенный партнёр: регистрация идёт как прямая, ничего не пишется (код не секрет и не даёт прав).
 */
export async function attachPartnerByCode(
  tx: AttributionTx,
  input: { organizationId: string; userId: string | null; code: unknown; channel: unknown },
): Promise<string | null> {
  const code = parsePartnerCode(input.code);
  if (!code) return null;
  const partner = await tx.platformPartner.findUnique({ where: { code } });
  if (!partner || !partner.active) return null;
  const channel = parseChannel(input.channel);
  await tx.platformClientPartner.create({
    data: { organizationId: input.organizationId, partnerId: partner.id, source: 'LINK', channel, updatedBy: input.userId },
  });
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      entityType: 'organization',
      entityId: input.organizationId,
      action: 'platform.client.partner_set',
      after: { partnerId: partner.id, source: 'LINK', channel },
    },
  });
  return partner.id;
}
