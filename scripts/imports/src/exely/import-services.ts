import type { DbTx } from '@pms/database';
import type { ExelyService } from './parse-services';

export interface ServicesImportReport {
  created: number;
  updated: number;
  unchanged: number;
}

/** Идемпотентно: ключ (property, code = название). Цена и группа обновляются, услуга остаётся активной. */
export async function importServices(
  tx: DbTx,
  services: ExelyService[],
  propertyId: string,
): Promise<ServicesImportReport> {
  const report: ServicesImportReport = { created: 0, updated: 0, unchanged: 0 };
  for (const s of services) {
    const existing = await tx.service.findUnique({
      where: { propertyId_code: { propertyId, code: s.name } },
    });
    if (!existing) {
      await tx.service.create({
        data: { propertyId, code: s.name, nameRu: s.name, price: s.priceMinor, group: s.group },
      });
      report.created += 1;
    } else if (existing.price !== s.priceMinor || existing.group !== s.group || !existing.active) {
      await tx.service.update({
        where: { id: existing.id },
        data: { price: s.priceMinor, group: s.group, active: true },
      });
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }
  return report;
}
