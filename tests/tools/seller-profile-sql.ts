import type { Db } from '@pms/database';

/**
 * Профиль «как вставлял прежний код»: без `agent_id`. Триггер базы (`seller_profiles_link`, миграция 034) сам заводит агента
 * с `id = organization_id` и ставит `agent_id`. Клиент Prisma после сужения (036) требует `agentId` в типе, поэтому такая
 * вставка идёт сырым SQL. Организация без участников агента не получит, и вставка падает (NOT NULL): некому быть автором.
 */
export async function insertLegacyProfile(
  db: Db,
  organizationId: string,
  opts: { botName?: string | null; applied?: boolean } = {},
): Promise<void> {
  await db.$executeRaw`
    INSERT INTO seller_profiles (organization_id, bot_name, address_form, reply_length, languages, updated_at, profile_applied_at)
    VALUES (${organizationId}::uuid, ${opts.botName ?? null}, 'FORMAL'::"SellerAddressForm", 'SHORT'::"SellerReplyLength",
            ARRAY['ru']::text[], now(), ${opts.applied ? new Date() : null}::timestamptz)`;
}
