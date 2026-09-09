import type { DbTx } from '@pms/database';
import type { EntityCounts } from './import-inventory';
import type { RatePlanImportPlan } from './rate-plans';

/** Идемпотентный импорт тарифов: ключ (property, code); связи с категориями — createMany skipDuplicates. */
export async function importRatePlans(
  tx: DbTx,
  plan: RatePlanImportPlan,
  propertyId: string,
): Promise<{ ratePlans: EntityCounts; links: number }> {
  const report = { ratePlans: { created: 0, updated: 0 }, links: 0 };
  const types = await tx.accommodationType.findMany({
    where: { propertyId },
    select: { id: true, code: true },
  });
  const typeId = new Map(types.map((t) => [t.code, t.id]));
  const planId = new Map<string, string>();
  for (const p of plan.ratePlans) {
    const where = { propertyId_code: { propertyId, code: p.code } };
    const data = {
      name: p.name,
      currency: p.currency,
      active: p.active,
      exelyId: p.exelyId,
      note: p.note,
    };
    const existing = await tx.ratePlan.findUnique({ where, select: { id: true } });
    const saved = existing
      ? await tx.ratePlan.update({ where, data, select: { id: true } })
      : await tx.ratePlan.create({
          data: { propertyId, code: p.code, ...data },
          select: { id: true },
        });
    if (existing) report.ratePlans.updated += 1;
    else report.ratePlans.created += 1;
    planId.set(p.code, saved.id);
  }
  const rows = plan.links.map((l) => {
    const rp = planId.get(l.ratePlanCode);
    const at = typeId.get(l.accommodationTypeCode);
    if (!rp || !at)
      throw new Error(
        `Связь тариф↔категория: ${l.ratePlanCode} / ${l.accommodationTypeCode} не найдены`,
      );
    return { ratePlanId: rp, accommodationTypeId: at };
  });
  const res = await tx.ratePlanAccommodationType.createMany({ data: rows, skipDuplicates: true });
  report.links = res.count;
  return report;
}
