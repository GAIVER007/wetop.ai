import { unstable_rethrow } from 'next/navigation';
import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { authApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { clientInfo, sessionToken } from '../../lib/session';
import { validAccessStructure } from './scope-model';
import type { TeamBoardData } from './people';

/**
 * Входы организации для общего экрана «Сотрудники» (plans/unified-team-screen-2026-10-25.md, U2). Только владельцу и
 * управляющему (право `staff`, В2): остальным `null`, и доска остаётся доской карточек. Сбой списка входов тоже `null`:
 * карточки, графики и записи не должны пропадать из-за соседнего запроса.
 */
export async function loadTeamBoard(): Promise<(TeamBoardData & { organizationId: string }) | null> {
  try {
    const [token, me] = await Promise.all([sessionToken(), currentMe()]);
    const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
    const businessId = 'context' in me ? me.context?.businessId : undefined;
    const organizationId = me.user?.organizationId;
    if (!token || !role || !canManageStaff(role) || !businessId || !organizationId) return null;
    const info = await clientInfo();
    const [members, invites, structure] = await Promise.all([
      authApi.members(token, info),
      authApi.invites(token, info),
      authApi.accessStructure(token, info).then(
        (value) => (validAccessStructure(value) ? value : null),
        (error: unknown) => {
          unstable_rethrow(error);
          return null;
        },
      ),
    ]);
    return { businessId, organizationId, members, invites, structure, actorRole: role };
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
