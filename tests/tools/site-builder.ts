import type { Db } from '@pms/database';
import type pg from 'pg';

/**
 * MKT9.2 в тестах: лицензия конструктора сайта филиала. Без неё запись сайта отвечает 403
 * `SITE_BUILDER_NOT_ENABLED`, поэтому наборы, которые проверяют запись, выдают её сами, как главный администратор.
 */
export async function grantSiteBuilder(
  db: Db,
  locationIds: string | string[],
  status: 'TRIAL' | 'ACTIVE' | 'OFF' = 'ACTIVE',
  activeUntil: Date | null = null,
): Promise<void> {
  for (const locationId of Array.isArray(locationIds) ? locationIds : [locationIds]) {
    const data = { status, activeUntil, updatedAt: new Date() };
    await db.siteBuilderEntitlement.upsert({ where: { locationId }, create: { locationId, ...data }, update: data });
  }
}

/**
 * Уборка строк MKT9.2 организаций набора до удаления сайтов и филиалов: разговоры ИИ, закладки и лицензии ссылаются на
 * сайты и филиалы. Удаление строк ни один сторож не держит (сторожа только на вставку и изменение)
 */
export async function purgeSiteBuilderRows(sql: pg.Client, organizationIds: string[]): Promise<void> {
  const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
    JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
  await sql.query(`DELETE FROM marketing_site_version_bookmarks WHERE site_id IN (${sites})`, [organizationIds]);
  await sql.query(`DELETE FROM site_ai_runs WHERE site_id IN (${sites})`, [organizationIds]);
  await sql.query(
    `DELETE FROM site_builder_entitlements WHERE location_id IN (
       SELECT l.id FROM locations l JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[]))`,
    [organizationIds],
  );
}
