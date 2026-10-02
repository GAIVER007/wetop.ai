import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { redirect } from 'next/navigation';
import { ApiError, authApi } from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { publicAuthUrl } from '../../lib/auth-entry';
import { Page } from '../../components/page';
import { Notice } from '../../components/ui';
import { InviteButton, MembersTable, PendingInvites, TeamProvider } from './team-board';

/**
 * «Сотрудники» (TEAM1): люди организации с ролями, датой входа в организацию и «Был в системе»;
 * приглашения — панелью из шапки, ожидающие — ниже списком. Данные и права — прежние API команды
 * (ADR-107, ADR-131): раздел виден владельцу и управляющему (право `staff`, гейт — по реестру меню).
 * Личные сеансы остались в «Профиль → Доступ». Ошибка загрузки — границей ошибок, не пустой командой.
 */
export default async function TeamPage() {
  const token = await sessionToken();
  if (!token) redirect(publicAuthUrl('login', '/team'));
  const me = await authApi.me().catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return { user: null };
    throw error;
  });
  if (!me.user) redirect(publicAuthUrl('login', '/team'));
  const role = me.user.role ? parseMembershipRole(me.user.role) : null;
  const team = !!me.user.organization && !!role && canManageStaff(role);
  const info = await clientInfo();
  const [invites, members] = await Promise.all([
    team ? authApi.invites(token, info) : [],
    team ? authApi.members(token, info) : [],
  ]);
  return (
    <TeamProvider role={team && role ? role : null}>
      <Page
        title="Сотрудники"
        subtitle={me.user.organization?.name}
        actions={team ? <InviteButton /> : undefined}
      >
        {team ? (
          <>
            <MembersTable members={members} />
            <PendingInvites invites={invites} />
          </>
        ) : (
          <Notice tone="muted">Приглашать и отключать сотрудников могут владелец и управляющий.</Notice>
        )}
      </Page>
    </TeamProvider>
  );
}
