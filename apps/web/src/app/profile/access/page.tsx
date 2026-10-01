import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../../lib/api';
import { clientInfo, sessionToken } from '../../../lib/session';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { AccessPanel } from './access-panel';

/** Существующие права и API команды/сессий перенесены с публичного экрана входа. */
export default async function AccessPage() {
  const token = await sessionToken();
  if (!token) redirect(publicAuthUrl('login', '/profile/access'));
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  if (!me.user) redirect(publicAuthUrl('login', '/profile/access'));
  const role = me.user.role ? parseMembershipRole(me.user.role) : null;
  const team = !!me.user.organization && !!role && canManageStaff(role);
  const info = await clientInfo();
  // Ошибку загрузки показываем границей ошибок, а не выдаём за пустую команду.
  const [invites, members, sessions] = await Promise.all([
    team ? authApi.invites(token, info) : [],
    team ? authApi.members(token, info) : [],
    authApi.sessions(token, info),
  ]);
  return <AccessPanel user={me.user} invites={invites} members={members} sessions={sessions} />;
}
