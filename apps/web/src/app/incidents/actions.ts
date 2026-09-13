'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, guardApi } from '../../lib/api';

export interface IncidentActionResult {
  error: string | null;
  message: string | null;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

/** «Принято» — человек в курсе, сторож перестаёт будить. «Решено» — закрыть то, что проверка сама не перепроверит. */
export async function incidentAction(
  kind: 'acknowledge' | 'resolve',
  id: string,
): Promise<IncidentActionResult> {
  try {
    if (kind === 'acknowledge') await guardApi.acknowledge(id);
    else await guardApi.resolve(id);
    revalidatePath('/incidents');
    return { error: null, message: kind === 'acknowledge' ? 'Принято' : 'Закрыто' };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}

/** Проход сторожа прямо сейчас — не ждать минуту после починки */
export async function guardTickAction(): Promise<IncidentActionResult> {
  try {
    const r = await guardApi.tick();
    revalidatePath('/incidents');
    return {
      error: null,
      message: `Проверено: неисправностей сейчас ${r.observed.length}, закрыто ${r.resolved}`,
    };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
