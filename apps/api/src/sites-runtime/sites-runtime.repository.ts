import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pms/database';
import { PrismaService } from '../database/prisma.provider';

/** Опубликованная версия сайта с его цепочкой: ровно то, что видит рантайм */
export interface PublishedSiteRow {
  siteId: string;
  versionId: string;
  schemaVersion: string;
  specHash: string;
  spec: Record<string, unknown>;
  propertyId: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** Ключ связанного `TrackedSite` в `ACTIVE`; иначе null */
  publicKey: string | null;
  bookingEnabled: boolean;
  /** MKT7: основной ACTIVE домен сайта; null у превью и у сайта без домена (карта dev) */
  primaryHost: string | null;
}

export interface CategoryFact {
  code: string;
  active: boolean;
  capacityAdults: number;
}

export interface SitesRuntimeRepository {
  /**
   * Сайт в `PUBLISHED` и версия **только по `published_version_id`**, одним запросом с цепочкой филиал `ACTIVE` →
   * Business `ACTIVE` `HOSPITALITY` → объект этого филиала той же организации. `latest_version_id` не читается.
   */
  publishedSite(siteId: string): Promise<PublishedSiteRow | null>;
  categories(propertyId: string, codes: string[]): Promise<CategoryFact[]>;
  /** MKT7: сайт по живому хосту: только домен в `ACTIVE`; остальное (снятый, ждущий, чужой) это null */
  siteIdByHost(host: string): Promise<string | null>;
  /**
   * MKT7, превью: ровно версия `versionId` сайта `siteId` (версия своего сайта, сайт не в архиве, та же цепочка
   * филиала, что у опубликованной). Без ключа сайта и брони: превью ничего не продаёт и не считает
   */
  previewSite(siteId: string, versionId: string): Promise<PublishedSiteRow | null>;
}
export const SITES_RUNTIME_REPOSITORY = Symbol('SITES_RUNTIME_REPOSITORY');

@Injectable()
export class PrismaSitesRuntimeRepository implements SitesRuntimeRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async publishedSite(siteId: string): Promise<PublishedSiteRow | null> {
    const rows = await this.prisma.db.$queryRaw<PublishedSiteRow[]>(Prisma.sql`
      SELECT s."id"::text AS "siteId",
        v."id"::text AS "versionId",
        v."schema_version" AS "schemaVersion",
        v."spec_hash" AS "specHash",
        v."spec" AS "spec",
        p."id"::text AS "propertyId",
        p."check_in_time" AS "checkInTime",
        p."check_out_time" AS "checkOutTime",
        CASE WHEN t."status" = 'ACTIVE' THEN t."public_key" END AS "publicKey",
        COALESCE(t."status" = 'ACTIVE' AND t."booking_enabled" AND t."booking_rate_plan_id" IS NOT NULL, false)
          AS "bookingEnabled",
        (SELECT d."host" FROM "site_domains" d
          WHERE d."site_id" = s."id" AND d."status" = 'ACTIVE' AND d."is_primary" LIMIT 1) AS "primaryHost"
      FROM "marketing_sites" s
      JOIN "marketing_site_versions" v ON v."id" = s."published_version_id" AND v."site_id" = s."id"
      JOIN "locations" l ON l."id" = s."location_id" AND l."status" = 'ACTIVE'
      JOIN "businesses" b ON b."id" = l."business_id" AND b."status" = 'ACTIVE' AND b."vertical" = 'HOSPITALITY'
      JOIN "properties" p ON p."location_id" = l."id" AND p."organization_id" = b."organization_id"
      LEFT JOIN "tracked_sites" t ON t."id" = s."tracked_site_id" AND t."property_id" = p."id"
      WHERE s."id" = ${siteId}::uuid AND s."state" = 'PUBLISHED'`);
    return rows[0] ?? null;
  }

  async siteIdByHost(host: string): Promise<string | null> {
    const rows = await this.prisma.db.$queryRaw<Array<{ siteId: string }>>(Prisma.sql`
      SELECT "site_id"::text AS "siteId" FROM "site_domains" WHERE "host" = ${host} AND "status" = 'ACTIVE' LIMIT 1`);
    return rows[0]?.siteId ?? null;
  }

  async previewSite(siteId: string, versionId: string): Promise<PublishedSiteRow | null> {
    const rows = await this.prisma.db.$queryRaw<PublishedSiteRow[]>(Prisma.sql`
      SELECT s."id"::text AS "siteId",
        v."id"::text AS "versionId",
        v."schema_version" AS "schemaVersion",
        v."spec_hash" AS "specHash",
        v."spec" AS "spec",
        p."id"::text AS "propertyId",
        p."check_in_time" AS "checkInTime",
        p."check_out_time" AS "checkOutTime",
        NULL::text AS "publicKey",
        false AS "bookingEnabled",
        NULL::text AS "primaryHost"
      FROM "marketing_sites" s
      JOIN "marketing_site_versions" v ON v."id" = ${versionId}::uuid AND v."site_id" = s."id"
      JOIN "locations" l ON l."id" = s."location_id" AND l."status" = 'ACTIVE'
      JOIN "businesses" b ON b."id" = l."business_id" AND b."status" = 'ACTIVE' AND b."vertical" = 'HOSPITALITY'
      JOIN "properties" p ON p."location_id" = l."id" AND p."organization_id" = b."organization_id"
      WHERE s."id" = ${siteId}::uuid AND s."state" <> 'ARCHIVED'`);
    return rows[0] ?? null;
  }

  async categories(propertyId: string, codes: string[]): Promise<CategoryFact[]> {
    if (codes.length === 0) return [];
    return this.prisma.db.$queryRaw<CategoryFact[]>(Prisma.sql`
      SELECT "code", "active", "capacity_adults" AS "capacityAdults"
      FROM "accommodation_types"
      WHERE "property_id" = ${propertyId}::uuid AND "code" = ANY(${codes}::text[])`);
  }
}
