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
import { Alert, Notice, Table } from '../../../components/ui';
import { currentMe, deskShell } from '../../../lib/desk-shell';
import { beautyApi, type BeautyPositionsWorkspace } from '../../../lib/api';
import { deskAccessOf, mayBeautyAccess } from '../../../lib/navigation';
import { sessionToken } from '../../../lib/session';
import { PositionsBoard } from './positions-board';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';
import '../team.css';

/**
 * «Роли и права» (STAFF2.3a): что разрешено каждой роли, только на чтение. Таблица — та же, по которой отвечает API
 * (`ROLE_PERMISSIONS`, ADR-107): права отдельному человеку не выдаются, роль — готовый набор. Видят те же, кто ведает
 * командой (право `staff`).
 */
const ROLES: readonly MembershipRole[] = ['OWNER', 'MANAGER', 'STAFF'];

/**
 * Салон и ресторан видят права своими словами (мастер-проход UI 11.10.2026): права и их проверка те же
 * (`ROLE_PERMISSIONS`), меняется только подпись строки; строки гостиничных разделов (тарифы, каналы, ИИ-продавец)
 * у них не показываются, этих разделов в их меню нет.
 */
const VERTICAL_LABELS: Partial<Record<'BEAUTY' | 'FOOD_SERVICE', Partial<Record<Permission, string>>>> = {
  BEAUTY: {
    desk: msg('Записи и клиенты'),
    property: msg('Мастера, услуги и график'),
    reports: msg('Аналитика и оплаты'),
    settings: msg('Настройки филиала'),
  },
  FOOD_SERVICE: {
    desk: msg('Зал, брони и заказы'),
    property: msg('Меню, залы и столы'),
    reports: msg('Аналитика и касса'),
    settings: msg('Настройки филиала'),
  },
};
const HOTEL_ONLY: readonly Permission[] = ['dialogs', 'rates', 'channels', 'seller'];

export default async function TeamRolesPage() {
  const t = await serverT();
  const token = await sessionToken();
  const me = await currentMe().catch(() => null);
  const role = me?.user?.role ? parseMembershipRole(me.user.role) : null;
  const shell = me?.user ? await deskShell() : null;
  const vertical = shell?.vertical ?? 'HOSPITALITY';
  const routeAccess = me ? deskAccessOf(me) : shell?.access;
  const roleAllowed = !!token && !!role && canManageStaff(role);
  const allowed = roleAllowed && (
    vertical !== 'BEAUTY' ||
    !!routeAccess && mayBeautyAccess(routeAccess, 'employees', 'view', { legacy: 'staff' })
  );
  const labels = vertical === 'HOSPITALITY' ? {} : (VERTICAL_LABELS[vertical] ?? {});
  const rows = (Object.keys(PERMISSIONS) as Permission[]).filter(
    (p) => vertical === 'HOSPITALITY' || !HOTEL_ONLY.includes(p),
  );
  let beautyWorkspace: BeautyPositionsWorkspace | null = null;
  let beautyScopeKey = '';
  let canEditBeauty = false;
  let canCreateBeauty = false;
  let canArchiveBeauty = false;
  if (
    allowed &&
    vertical === 'BEAUTY' &&
    shell &&
    me?.user?.organizationId &&
    me.context?.businessId
  ) {
    beautyScopeKey = JSON.stringify({
      organizationId: me.user.organizationId,
      businessId: me.context.businessId,
      locationId: me.context.locationId ?? null,
    });
    beautyWorkspace = await beautyApi.positions().catch(() => null);
    canCreateBeauty = !shell.readOnly &&
      !!routeAccess && mayBeautyAccess(routeAccess, 'employees', 'create', { legacy: 'staff' });
    canEditBeauty = !shell.readOnly &&
      !!routeAccess && mayBeautyAccess(routeAccess, 'employees', 'update', { legacy: 'staff' });
    canArchiveBeauty = !shell.readOnly &&
      !!routeAccess && mayBeautyAccess(routeAccess, 'employees', 'delete', { legacy: 'staff' });
  }
  return (
    <Page title={t('Сотрудники')} subtitle={t('Роли и права: что разрешено каждой должности')}>
      {allowed ? (
        <>
          <TeamNavigation current="roles" owner={role === 'OWNER'} />
          {vertical === 'BEAUTY' ? (
            beautyWorkspace && beautyScopeKey ? (
              <PositionsBoard
                initial={beautyWorkspace}
                scopeKey={beautyScopeKey}
                canEdit={canEditBeauty}
                canCreate={canCreateBeauty}
                canUpdate={canEditBeauty}
                canArchive={canArchiveBeauty}
              />
            ) : (
              <Alert boxed>{t('Не удалось загрузить должности выбранного салона.')}</Alert>
            )
          ) : (
            <>
              <p className="muted">
                {t('Права даёт должность, отдельному человеку их не выдают. Менять набор прав ролей здесь нельзя.')}
              </p>
              <Table data-testid="roles-table" className="settings-table">
                <thead>
                  <tr>
                    <th>{t('Раздел')}</th>
                    {ROLES.map((r) => (
                      <th key={r}>{t(capital(MEMBERSHIP_ROLES[r]))}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p} data-testid="roles-row">
                      <td>{t(labels[p] ?? PERMISSIONS[p].label)}</td>
                      {ROLES.map((r) => (
                        <td key={r}>
                          {can(r, p) ? (
                            <span aria-label={t('разрешено')}>{t('Да')}</span>
                          ) : (
                            <span className="muted" aria-label={t('не разрешено')}>
                              {t('Нет')}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </>
      ) : (
        <Notice tone="muted">{t('Роли и права видят владелец и управляющий.')}</Notice>
      )}
    </Page>
  );
}

const capital = (text: string) => text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
