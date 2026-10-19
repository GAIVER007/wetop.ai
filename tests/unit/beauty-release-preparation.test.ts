import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { approvedBeautyPreparationNames, BEAUTY_PREPARATION_NAMES } from '../tools/beauty-release-preparation';

const prisma = resolve(import.meta.dirname, '../../packages/database/prisma');
const original = JSON.parse(readFileSync(resolve(prisma, 'beauty-release-preparation.json'), 'utf8'));
const fresh = () => structuredClone(original);

describe('owner-approved Beauty preparation is not a production application claim', () => {
  it('admits only the complete five-file block with all ten exact SQL hashes', () => {
    expect([...approvedBeautyPreparationNames(prisma, fresh())]).toEqual([...BEAUTY_PREPARATION_NAMES]);
    expect(original.productionApplied).toBe(false);
  });

  it.each([
    'applied status', 'production applied', 'missing approval', 'gate bypass', 'missing pinned approval',
    'missing restore', 'missing cutover runner', 'automatic apply', 'missing migration', 'extra migration',
    'duplicate migration', 'unrelated held migration', 'changed forward hash', 'changed rollback hash',
    'unexpected property', 'extra requirement', 'extra row property', 'null requirements', 'null migration',
    'nonarray migrations', 'wrong hash type', 'short hash', 'uppercase hash', 'nonboolean gate', 'nonboolean production flag',
  ])('rejects %s rather than widening the ordinary-chain exception', (change) => {
    const m = fresh();
    if (change === 'applied status') m.status = 'APPLIED';
    if (change === 'production applied') m.productionApplied = true;
    if (change === 'missing approval') m.approval = '';
    if (change === 'gate bypass') m.requirements.fullReleaseGate = false;
    if (change === 'missing pinned approval') m.requirements.pinnedProductionApproval = false;
    if (change === 'missing restore') m.requirements.backupAndRestoreCheck = false;
    if (change === 'missing cutover runner') m.requirements.trustedCutoverRunner = false;
    if (change === 'automatic apply') m.requirements.automaticApplyAllowed = true;
    if (change === 'missing migration') m.migrations.pop();
    if (change === 'extra migration') m.migrations.push(m.migrations[0]);
    if (change === 'duplicate migration') m.migrations[1] = m.migrations[0];
    if (change === 'unrelated held migration') m.migrations[0].name = '20261016000114_expense_links';
    if (change === 'changed forward hash') m.migrations[0].migrationSha256 = '0'.repeat(64);
    if (change === 'changed rollback hash') m.migrations[0].downSha256 = '0'.repeat(64);
    if (change === 'unexpected property') m.allowAllMigrations = true;
    if (change === 'extra requirement') m.requirements.allowAll = true;
    if (change === 'extra row property') m.migrations[0].allowAll = true;
    if (change === 'null requirements') m.requirements = null;
    if (change === 'null migration') m.migrations[0] = null;
    if (change === 'nonarray migrations') m.migrations = {};
    if (change === 'wrong hash type') m.migrations[0].migrationSha256 = 42;
    if (change === 'short hash') m.migrations[0].migrationSha256 = 'abc';
    if (change === 'uppercase hash') m.migrations[0].migrationSha256 = 'A'.repeat(64);
    if (change === 'nonboolean gate') m.requirements.fullReleaseGate = 1;
    if (change === 'nonboolean production flag') m.productionApplied = 0;
    expect(() => approvedBeautyPreparationNames(prisma, m)).toThrow();
  });

  it.each([null, [], 1, 'invalid'])('rejects a non-object manifest %s', (value) => {
    expect(() => approvedBeautyPreparationNames(prisma, value)).toThrow();
  });

  it('rejects changed canonical SQL even if all manifest requirements are present', () => {
    expect(() => approvedBeautyPreparationNames(prisma, fresh(), (path) =>
      Buffer.concat([readFileSync(path), Buffer.from('\n-- changed SQL')]),
    )).toThrow(/hash/);
  });

  it('rejects a missing forward or rollback file', () => {
    expect(() => approvedBeautyPreparationNames(prisma, fresh(), () => {
      throw new Error('missing canonical file');
    })).toThrow(/missing canonical file/);
  });
});
