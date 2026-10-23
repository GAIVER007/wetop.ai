import { requireFeature } from '../../../../lib/vertical-guard';
import { EmployeePortalScreen } from '../../../../components/employee-portal/screen';
import { authApi, beautyApi } from '../../../../lib/api';
import { employeePortalApi } from '../../../../lib/employee-portal-api';
import { deskShell } from '../../../../lib/desk-shell';
import { mayAccess, mayBeautyAccess } from '../../../../lib/navigation';
import { beautyMasterDayStatus } from '../../../../lib/beauty-master-day-status';
import { unstable_rethrow } from 'next/navigation';
import { roleAt } from '@pms/domain';
import { clientInfo, sessionToken } from '../../../../lib/session';
export default async function EmployeeProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; month?: string; range?: string }> }) {
  // раздел направления по реестру функций (У1): по прямой ссылке чужое направление уходит на свою стартовую
  await requireFeature('/employees');
  const [{ id }, search, shell] = await Promise.all([params, searchParams, deskShell()]);
  const query = { ...(typeof search.date === 'string' ? { date: search.date } : {}), ...(typeof search.month === 'string' ? { month: search.month } : {}), ...(search.range === 'month' ? { range: 'month' as const } : {}) };
  const beautyLocationSelected = shell.vertical === 'BEAUTY' && Boolean(shell.scopeKey);
  const canManageLocations = shell.vertical === 'BEAUTY'
    ? mayBeautyAccess(shell.access, 'employees', 'update', { legacy: 'property' })
    : mayAccess(shell.access, 'property');
  const canManageServicePrices = shell.vertical === 'BEAUTY'
    ? mayBeautyAccess(shell.access, 'services', 'update', { legacy: 'rates' })
    : mayAccess(shell.access, 'rates');
  const canManageAccounts = shell.vertical === 'BEAUTY'
    ? mayBeautyAccess(shell.access, 'employees', 'update', { legacy: 'staff' })
    : mayAccess(shell.access, 'staff');
  const canReadJournal = shell.vertical === 'BEAUTY' &&
    mayBeautyAccess(shell.access, 'journal', 'view', { legacy: 'desk' });
  const [locationAssignments, servicePrices, accountOptions, dayStatus] = await Promise.all([
    beautyLocationSelected && canManageLocations && !shell.readOnly
      ? beautyApi.schedule(id).then(
          (schedule) => schedule.locations,
          (error) => {
            unstable_rethrow(error);
            return null;
          },
        )
      : undefined,
    beautyLocationSelected && canManageServicePrices && !shell.readOnly
      ? beautyApi.employeeServicePrices(id).catch((error) => {
          unstable_rethrow(error);
          return null;
        })
      : undefined,
    shell.scopeKey && canManageAccounts && !shell.readOnly
      ? (shell.vertical === 'BEAUTY'
          ? employeePortalApi.accountOptions(id).then((members) => members.map((member) => ({
              userId: member.userId,
              label: [member.name?.trim() || member.email, member.name ? member.email : null]
                .filter(Boolean)
                .join(', '),
            })))
          : Promise.all([sessionToken(), clientInfo()]).then(async ([token, info]) => {
              if (!token) return null;
              const [businessId, locationId] = shell.scopeKey!.split(':');
              if (!businessId || !locationId) return null;
              const members = await authApi.members(token, info);
              return members
                .filter((member) => !member.suspended && roleAt(member.role, member.scopes, { businessId, locationId }))
                .map((member) => ({
                  userId: member.userId,
                  label: [member.name?.trim() || member.email, member.name ? member.email : null, member.position]
                    .filter(Boolean)
                    .join(', '),
                }));
            })).catch((error) => {
          unstable_rethrow(error);
          return null;
        })
      : undefined,
    shell.vertical === 'BEAUTY'
      ? canReadJournal
        ? beautyApi.day().then(
            (day) => beautyMasterDayStatus(day, id),
            (error) => {
              unstable_rethrow(error);
              return beautyMasterDayStatus(null, id);
            },
          )
        : beautyMasterDayStatus(null, id)
      : undefined,
  ]);
  return <EmployeePortalScreen
    target={{ employeeId: id }}
    query={query}
    {...(locationAssignments !== undefined ? { locationAssignments } : {})}
    {...(servicePrices !== undefined ? { servicePrices } : {})}
    {...(accountOptions !== undefined ? { accountOptions } : {})}
    {...(dayStatus !== undefined ? { dayStatus } : {})}
  />;
}
