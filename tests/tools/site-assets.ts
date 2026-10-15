import { siteSpecAssetRefs } from '@pms/domain';
import type { Db } from '@pms/database';

/**
 * MKT8 для тестов: готовые (`READY`) строки библиотеки под ссылки документа SiteSpec в филиале, как будто картинки уже
 * загружены. Байтов в хранилище нет: подходит тестам, которым нужно сохранить или опубликовать версию с картинками,
 * но не проверять сами картинки. Ключ объекта по правилу CHECK `site_assets_storage_ref`.
 */
export async function seedSpecAssets(db: Db, locationId: string, spec: unknown): Promise<string[]> {
  const kinds = new Map<string, 'IMAGE' | 'LOGO' | 'FAVICON'>();
  for (const ref of siteSpecAssetRefs(spec)) if (!kinds.has(ref.assetId)) kinds.set(ref.assetId, ref.expectedKind);
  const sha = (id: string) => id.replace(/-/g, '').padEnd(64, '0').slice(0, 64);
  await db.siteAsset.createMany({
    data: [...kinds].map(([id, kind]) => ({
      id,
      locationId,
      kind,
      status: 'READY' as const,
      source: 'UPLOAD' as const,
      mimeType: kind === 'FAVICON' ? 'image/png' : 'image/webp',
      storageRef: `site-assets/${locationId}/${id}/${sha(id)}.${kind === 'FAVICON' ? 'png' : 'webp'}`,
      byteSize: 1000,
      width: kind === 'FAVICON' ? 512 : 800,
      height: kind === 'FAVICON' ? 512 : 600,
      sha256: sha(id),
    })),
  });
  return [...kinds.keys()];
}
