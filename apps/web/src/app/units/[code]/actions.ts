'use server';
import { formValues } from '../../../lib/form-values';
import { revalidatePath } from 'next/cache';
import { ApiError, unitsApi } from '../../../lib/api';

export interface UnitActionResult {
  error: string | null;
  values?: Record<string, string>;
  attempt?: number;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const done = (code: string) => {
  revalidatePath(`/units/${code}`);
  for (const path of [
    '/chessboard',
    '/inventory',
    '/rooms/availability',
    '/management/analytics',
    '/management/analytics/occupancy',
    '/finance',
  ])
    revalidatePath(path);
  return { error: null };
};

export async function blockUnitAction(
  code: string,
  _prev: UnitActionResult,
  fd: FormData,
): Promise<UnitActionResult> {
  try {
    await unitsApi.block(code, {
      dateFrom: s(fd, 'dateFrom'),
      dateTo: s(fd, 'dateTo'),
      type: s(fd, 'type'),
      reason: s(fd, 'reason') ?? null,
    });
  } catch (e) {
    return {
      error: describe(e),
      values: formValues(fd, ['dateFrom', 'dateTo', 'type', 'reason']),
      attempt: (_prev?.attempt ?? 0) + 1,
    };
  }
  return done(code);
}
export async function unblockUnitAction(code: string, blockId: string): Promise<UnitActionResult> {
  try {
    await unitsApi.unblock(code, blockId);
  } catch (e) {
    return { error: describe(e) };
  }
  return done(code);
}
export async function housekeepingAction(code: string, status: string): Promise<UnitActionResult> {
  try {
    await unitsApi.housekeeping(code, status);
  } catch (e) {
    return { error: describe(e) };
  }
  return done(code);
}
