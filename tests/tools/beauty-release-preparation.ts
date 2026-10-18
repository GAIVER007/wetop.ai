import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const BEAUTY_PREPARATION_NAMES = [
  '20261018000133_beauty_appointment_lines',
  '20261018000134_beauty_reviews',
  '20261018000135_beauty_materials',
  '20261018000136_beauty_positions',
  '20261018000137_beauty_location_hours',
] as const;
const allowedNames: ReadonlySet<string> = new Set(BEAUTY_PREPARATION_NAMES);
const ownerApproval = 'Подготовить отдельный релиз пяти Beauty-миграций и согласовать схему с SQL. Production-БД не менять до зелёного гейта, проверенного бэкапа и точного допуска.';

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Beauty preparation requires an object');
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
    throw new Error('Beauty preparation object keys differ from the approved contract');
  return value as Record<string, unknown>;
}

/** A narrowly approved source preparation, never proof of production application. */
export function approvedBeautyPreparationNames(
  prismaRoot: string,
  manifest: unknown = JSON.parse(readFileSync(resolve(prismaRoot, 'beauty-release-preparation.json'), 'utf8')),
  read: (path: string) => Uint8Array = (path) => readFileSync(path),
): ReadonlySet<string> {
  const checked = exactRecord(manifest, ['status', 'approval', 'productionApplied', 'requirements', 'migrations']);
  if (checked.status !== 'PREPARED_NOT_APPLIED' || checked.approval !== ownerApproval || checked.productionApplied !== false)
    throw new Error('Beauty preparation is not the approved unapplied package');
  const requirements = exactRecord(checked.requirements, [
    'fullReleaseGate', 'pinnedProductionApproval', 'backupAndRestoreCheck', 'trustedCutoverRunner', 'automaticApplyAllowed',
  ]);
  for (const key of ['fullReleaseGate', 'pinnedProductionApproval', 'backupAndRestoreCheck', 'trustedCutoverRunner']) {
    if (requirements[key] !== true) throw new Error(`Beauty preparation requires ${key}`);
  }
  if (requirements.automaticApplyAllowed !== false)
    throw new Error('Beauty preparation never authorizes automatic application');
  if (!Array.isArray(checked.migrations) || checked.migrations.length !== BEAUTY_PREPARATION_NAMES.length)
    throw new Error('Beauty preparation requires the complete five-migration block');
  const names = new Set<string>();
  for (const value of checked.migrations) {
    const row = exactRecord(value, ['name', 'migrationSha256', 'downSha256']);
    const name = row.name;
    if (typeof name !== 'string' || !allowedNames.has(name))
      throw new Error('Unapproved Beauty preparation migration');
    if (names.has(name)) throw new Error('Duplicate Beauty preparation migration');
    for (const [file, expected] of [['migration.sql', row.migrationSha256], ['down.sql', row.downSha256]] as const) {
      if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(expected))
        throw new Error(`Invalid Beauty preparation SQL hash: ${name}/${file}`);
      const bytes = read(resolve(prismaRoot, 'migrations', name, file));
      if (createHash('sha256').update(bytes).digest('hex') !== expected)
        throw new Error(`Beauty preparation SQL hash mismatch: ${name}/${file}`);
    }
    names.add(name);
  }
  return names;
}
