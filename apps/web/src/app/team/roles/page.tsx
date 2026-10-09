import {
  MEMBERSHIP_ROLES,
  PERMISSIONS,
  canManageStaff,
  can,
  parseMembershipRole,
  type MembershipRole,
  type Permission,
} from '@pms/domain';
import { TeamNavigation } from '../../../components/team-navigation';
import { Page } from '../../../components/page';
import { Notice, Table } from '../../../components/ui';
import { currentMe } from '../../../lib/desk-shell';
import { sessionToken } from '../../../lib/session';
import '../team.css';

/**
 * «Роли и права» (STAFF2.3a): что разрешено каждой роли, только на чтение. Таблица — та же, по которой отвечает API
 * (`ROLE_PERMISSIONS`, ADR-107): права отдельному человеку не выдаются, роль — готовый набор. Видят те же, кто ведает
 * командой (право `staff`).
 */
const ROLES: readonly MembershipRole[] = ['OWNER', 'MANAGER', 'STAFF'];

export default async function TeamRolesPage() {
  const token = await sessionToken();
  const me = await currentMe().catch(() => ({ user: null }));
  const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
  const allowed = !!token && !!role && canManageStaff(role);
  return (
    <Page title="Сотрудники и доступ" subtitle="Роли и права: что разрешено каждой должности">
      {allowed ? (
        <>
          <TeamNavigation current="roles" owner={role === 'OWNER'} />
          <p className="muted">
            Права даёт должность, отдельному человеку их не выдают. Менять набор прав ролей здесь
            нельзя.
          </p>
          <Table data-testid="roles-table" className="settings-table">
            <thead>
              <tr>
                <th>Раздел</th>
                {ROLES.map((r) => (
                  <th key={r}>{capital(MEMBERSHIP_ROLES[r])}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p} data-testid="roles-row">
                  <td>{PERMISSIONS[p].label}</td>
                  {ROLES.map((r) => (
                    <td key={r}>
                      {can(r, p) ? (
                        <span aria-label="разрешено">Да</span>
                      ) : (
                        <span className="muted" aria-label="не разрешено">
                          Нет
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <Notice tone="muted">Роли и права видят владелец и управляющий.</Notice>
      )}
    </Page>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
