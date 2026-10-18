/** Test-only serialization adapter. It never prices, schedules, authorizes, or persists an appointment. */
export function previewBeautySingleSelection(body: Record<string, unknown>):
  | { ok: true; employeeId: string; serviceId: string }
  | { ok: false; error: string } {
  if (!Object.hasOwn(body, 'items')) {
    // Preserve the old fixture's resource lookups and their existing rejection messages.
    return { ok: true, employeeId: String(body.employeeId ?? ''), serviceId: String(body.serviceId ?? '') };
  }
  const reject = { ok: false as const, error: 'Generic synthetic fixture supports one unadjusted item only; use the real Beauty suite for advanced lines.' };
  if (Object.hasOwn(body, 'employeeId') || Object.hasOwn(body, 'serviceId')) return reject;
  if (!Array.isArray(body.items) || body.items.length !== 1) return reject;
  const item: unknown = body.items[0];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return reject;
  const row = item as Record<string, unknown>;
  if (Object.keys(row).some(key => key !== 'employeeId' && key !== 'serviceId')) return reject;
  if (typeof row.employeeId !== 'string' || !row.employeeId.trim() || typeof row.serviceId !== 'string' || !row.serviceId.trim()) return reject;
  return { ok: true, employeeId: row.employeeId, serviceId: row.serviceId };
}
