import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../../lib/api';
import { clientInfo, sessionToken } from '../../../lib/session';
import { publicAuthUrl } from '../../../lib/auth-entry';
import { AccessPanel } from './access-panel';
import { msg } from '../../../i18n';

/** Существующие права и API команды/сессий перенесены с публичного экрана входа. */
const ORGANIZATION_ERRORS: Record<string, string> = {
  denied: msg('Эта организация вам недоступна.'),
  signin: msg('Сеанс закончился. Войдите заново.'),
  failed: msg('Не удалось перейти. Попробуйте ещё раз.'),
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string | string[] }>;
}) {
  const org = (await searchParams).org;
  const organizationError = typeof org === 'string' ? (ORGANIZATION_ERRORS[org] ?? null) : null;
  const token = await sessionToken();
  if (!token) redirect(publicAuthUrl('login', '/profile/access'));
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  if (!me.user) redirect(publicAuthUrl('login', '/profile/access'));
  // Команда переехала на «Сотрудников» (TEAM1): здесь остались личные сеансы
  const info = await clientInfo();
  const sessions = await authApi.sessions(token, info);
  // список перехода: при сбое просто не показываем, личный доступ работает и без него
  const organizations = await authApi.organizations(token, info).catch(() => []);
  return (
    <AccessPanel
      user={me.user}
      sessions={sessions}
      organizations={organizations}
      organizationError={organizationError}
    />
  );
}
