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
  // Команда переехала на «Сотрудников» (TEAM1): здесь остались личные сеансы
  const sessions = await authApi.sessions(token, await clientInfo());
  return <AccessPanel user={me.user} sessions={sessions} />;
}
