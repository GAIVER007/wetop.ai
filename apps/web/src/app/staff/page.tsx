import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { publicAuthUrl } from '../../lib/auth-entry';
import { TeamSection } from '../login/team-section';
import './staff.css';

export default async function StaffPage() {
  const token = await sessionToken();
  if (!token) redirect(publicAuthUrl('login', '/staff'));
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  if (!me.user) redirect(publicAuthUrl('login', '/staff'));
  const role = me.user.role ? parseMembershipRole(me.user.role) : null;
  const allowed = !!me.user.organization && !!role && canManageStaff(role);
  const info = await clientInfo();
  const [invites, members] = allowed
    ? await Promise.all([authApi.invites(token, info), authApi.members(token, info)])
    : [[], []];
  return (
    <main className="page staff-page" id="main-content">
      <header className="page__head">
        <div>
          <h1 className="page__title">Сотрудники</h1>
          <p className="page__subtitle">
            Команда организации · {me.user.organization?.name ?? 'Организация не выбрана'}
          </p>
        </div>
      </header>
      {allowed && role ? (
        <TeamSection role={role} invites={invites} members={members} workspace />
      ) : (
        <p role="alert">Приглашать сотрудников могут владелец и управляющий.</p>
      )}
    </main>
  );
}
