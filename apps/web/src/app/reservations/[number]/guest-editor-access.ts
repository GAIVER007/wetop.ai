import type { DeskShell } from '../../../lib/desk-person';
import { mayAccess } from '../../../lib/navigation';
/** Guests are organization-level: branch reservation visibility never grants profile access. */
export function bookingGuestEditable(desk: Pick<DeskShell, 'access' | 'readOnly' | 'scopeKey'>): boolean {
  return mayAccess(desk.access, 'desk') && !desk.readOnly && !!desk.scopeKey &&
    !desk.access.restricted && !desk.access.unknown && desk.access.role !== null;
}
