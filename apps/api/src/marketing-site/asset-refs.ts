import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { siteSpecAssetRefs, type SiteAssetKind, type SiteSpecAssetRef } from '@pms/domain';
import { Prisma, type DbTx } from '@pms/database';
import type { SiteAssetStorage } from './asset-storage';

/**
 * Ссылки версии SiteSpec на библиотеку изображений (MKT8, план §8–§9). Одно место для сохранения версии, публикации,
 * превью и рантайма:
 * - ассет только этого филиала, ожидаемого вида; чужой и несуществующий неотличимы (один код, без владельца);
 * - обычная (ни разу не опубликованная) версия берёт только `READY`;
 * - «историческая» версия (есть запись журнала `PUBLISH`, `ROLLBACK` или `RESUME`) берёт и `DELETED`: его объект
 *   удержан ради отката, удалённый из библиотеки не ломает уже опубликованный сайт.
 */
export const HISTORY_ACTIONS = ['PUBLISH', 'ROLLBACK', 'RESUME'] as const;

export interface AssetRow {
  id: string;
  kind: SiteAssetKind;
  status: string;
  storageRef: string;
}

export interface AssetProblem {
  path: string;
  code: 'unavailable' | 'wrong_kind' | 'missing_object';
}

export const ASSET_STORAGE_UNAVAILABLE = { code: 'ASSET_STORAGE_UNAVAILABLE', message: 'Хранилище изображений не настроено' };

export function assetStorageUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException(ASSET_STORAGE_UNAVAILABLE);
}

export function assetUnavailable(problems: AssetProblem[]): ConflictException {
  return new ConflictException({
    code: 'ASSET_UNAVAILABLE',
    message: 'В версии есть изображения, которых нет в библиотеке филиала или они не подходят по назначению',
    paths: problems.slice(0, 20),
  });
}

/** Версия уже была опубликована (журнал публикаций этого сайта) */
export async function versionIsHistorical(tx: DbTx, siteId: string, versionId: string): Promise<boolean> {
  const row = await tx.marketingSitePublication.findFirst({
    where: { siteId, versionId, action: { in: [...HISTORY_ACTIONS] } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Встречается ли ассет хоть в одной когда-либо опубликованной версии сайтов этого филиала (в том числе архивных).
 * Документы разбираются приложением по схеме SiteSpec (`siteSpecAssetRefs`), а не поиском строки id в JSON
 */
export async function assetUsedByPublishedHistory(tx: DbTx, assetId: string, locationId: string): Promise<boolean> {
  const versions = await tx.marketingSiteVersion.findMany({
    where: { site: { locationId }, publicationsOf: { some: { action: { in: [...HISTORY_ACTIONS] } } } },
    select: { spec: true },
  });
  const id = assetId.toLowerCase();
  return versions.some((v) => siteSpecAssetRefs(v.spec).some((r) => r.assetId === id));
}

/** Строки ассетов филиала по id; `lock` берёт их `FOR SHARE`, чтобы удаление не проскочило между проверкой и записью */
export async function assetRows(tx: DbTx, locationId: string, ids: string[], lock: boolean): Promise<AssetRow[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  return tx.$queryRaw<AssetRow[]>(Prisma.sql`
    SELECT "id"::text AS "id", "kind"::text AS "kind", "status"::text AS "status", "storage_ref" AS "storageRef"
    FROM "site_assets"
    WHERE "location_id" = ${locationId}::uuid AND "id" = ANY(${unique}::uuid[])
    ${lock ? Prisma.sql`FOR SHARE` : Prisma.empty}`);
}

/** Годится ли строка для ссылки: тот же вид, `READY`, а у исторической версии и удержанный `DELETED` */
function usable(row: AssetRow | undefined, ref: SiteSpecAssetRef, historical: boolean): AssetProblem['code'] | null {
  if (!row) return 'unavailable';
  if (row.status !== 'READY' && !(historical && row.status === 'DELETED')) return 'unavailable';
  if (row.kind !== ref.expectedKind) return 'wrong_kind';
  return null;
}

export interface SpecAssetCheck {
  refs: SiteSpecAssetRef[];
  rows: AssetRow[];
  problems: AssetProblem[];
}

export async function checkSpecAssets(
  tx: DbTx,
  locationId: string,
  spec: unknown,
  opts: { historical: boolean; lock: boolean },
): Promise<SpecAssetCheck> {
  const refs = siteSpecAssetRefs(spec);
  const rows = await assetRows(tx, locationId, refs.map((r) => r.assetId), opts.lock);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const problems: AssetProblem[] = [];
  for (const ref of refs) {
    const code = usable(byId.get(ref.assetId), ref, opts.historical);
    if (code) problems.push({ path: ref.path, code });
  }
  return { refs, rows, problems };
}

/**
 * Для публикации, возобновления, отката и превью: ссылки годятся, хранилище настроено; у удержанных `DELETED` объект
 * действительно лежит в хранилище (`exists` только для них, у `READY` основной инвариант это база)
 */
export async function assertSpecAssetsPublishable(
  tx: DbTx,
  storage: SiteAssetStorage | null,
  locationId: string,
  spec: unknown,
  opts: { historical: boolean; lock: boolean },
): Promise<void> {
  const check = await checkSpecAssets(tx, locationId, spec, opts);
  if (!check.refs.length) return;
  if (check.problems.length) throw assetUnavailable(check.problems);
  if (!storage) throw assetStorageUnavailable();
  const deleted = new Map(check.rows.filter((r) => r.status === 'DELETED').map((r) => [r.id, r]));
  const missing: AssetProblem[] = [];
  for (const [id, row] of deleted)
    if (!(await storage.exists(row.storageRef)))
      for (const ref of check.refs) if (ref.assetId === id) missing.push({ path: ref.path, code: 'missing_object' });
  if (missing.length) throw assetUnavailable(missing);
}

/**
 * Карта `assetId → подписанный GET` для рантайма: только ссылки этой версии, только строки филиала сайта нужного вида и
 * допустимого состояния. Хранилища нет: пусто (картинки просто не выводятся, секции без них прячутся)
 */
export async function signedAssetMap(
  storage: SiteAssetStorage | null,
  refs: SiteSpecAssetRef[],
  rows: AssetRow[],
  historical: boolean,
  ttlSeconds: number,
): Promise<Record<string, string>> {
  if (!storage) return {};
  const byId = new Map(rows.map((r) => [r.id, r]));
  const map: Record<string, string> = {};
  for (const ref of refs) {
    const row = byId.get(ref.assetId);
    if (map[ref.assetId] || !row || usable(row, ref, historical)) continue;
    map[ref.assetId] = await storage.signedGet(row.storageRef, ttlSeconds);
  }
  return map;
}
