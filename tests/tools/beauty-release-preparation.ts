import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const BEAUTY_PREPARATION_NAMES = [
  '20261018000133_beauty_appointment_lines',
  '20261018000134_beauty_reviews',
  '20261018000135_beauty_materials',
  '20261018000136_beauty_positions',
  '20261018000137_beauty_location_hours',
] as const;

const preparation = z.object({
  status: z.literal('PREPARED_NOT_APPLIED'),
  approval: z.literal('Подготовить отдельный релиз пяти Beauty-миграций и согласовать схему с SQL. Production-БД не менять до зелёного гейта, проверенного бэкапа и точного допуска.'),
  productionApplied: z.literal(false),
  requirements: z.object({
    fullReleaseGate: z.literal(true),
    pinnedProductionApproval: z.literal(true),
    backupAndRestoreCheck: z.literal(true),
    trustedCutoverRunner: z.literal(true),
    automaticApplyAllowed: z.literal(false),
  }).strict(),
  migrations: z.array(z.object({
    name: z.enum(BEAUTY_PREPARATION_NAMES),
    migrationSha256: z.string().regex(/^[0-9a-f]{64}$/),
    downSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }).strict()).length(BEAUTY_PREPARATION_NAMES.length),
}).strict();

/** A narrowly approved source preparation, never proof of production application. */
export function approvedBeautyPreparationNames(
  prismaRoot: string,
  manifest: unknown = JSON.parse(readFileSync(resolve(prismaRoot, 'beauty-release-preparation.json'), 'utf8')),
  read: (path: string) => Uint8Array = (path) => readFileSync(path),
): ReadonlySet<string> {
  const checked = preparation.parse(manifest);
  const names = new Set<string>();
  for (const row of checked.migrations) {
    if (names.has(row.name)) throw new Error('Duplicate Beauty preparation migration');
    for (const [file, expected] of [['migration.sql', row.migrationSha256], ['down.sql', row.downSha256]] as const) {
      const bytes = read(resolve(prismaRoot, 'migrations', row.name, file));
      if (createHash('sha256').update(bytes).digest('hex') !== expected)
        throw new Error(`Beauty preparation SQL hash mismatch: ${row.name}/${file}`);
    }
    names.add(row.name);
  }
  return names;
}
