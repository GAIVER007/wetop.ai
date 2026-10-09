import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { authApi } from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { TeamNavigation } from '../../components/team-navigation';
import { Page } from '../../components/page';
import { Notice } from '../../components/ui';
import { currentMe } from '../../lib/desk-shell';
import { InviteButton, MembersTable, PendingInvites, TeamProvider, TeamStats } from './team-board';
import './team.css';

/**
 * «Сотрудники и доступ» (TEAM1, STAFF2.2): люди организации с ролями, датой входа в организацию и «Был в системе»;
 * приглашения — панелью из шапки, ожидающие — ниже списком. Данные и права — прежние API команды
 * (ADR-107, ADR-131): раздел виден владельцу и управляющему (право `staff`, гейт — по реестру меню).
 * На вход страница не уводит (ADR-107: роль не узнали — страница открыта, решает API; в стойке с
 * замком сюда без сессии не попасть); без права — строка, кто ведает командой. Личные сеансы
 * остались в «Профиль → Доступ». Ошибка загрузки — границей ошибок, не пустой командой.
 */
export default async function TeamPage() {
  const token = await sessionToken();
  const me = await currentMe().catch(() => ({ user: null }));
  const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
  const team = !!token && !!me.user?.organization && !!role && canManageStaff(role);
  const info = await clientInfo();
  const [invites, members] =
    token && team
      ? await Promise.all([authApi.invites(token, info), authApi.members(token, info)])
      : [[], []];
  return (
    <TeamProvider role={team && role ? role : null}>
      <Page
        title="Сотрудники и доступ"
        subtitle={
          me.user?.organization?.name
            ? `${me.user.organization.name}: команда, должности и приглашения`
            : 'Команда, должности и приглашения'
        }
        actions={team ? <InviteButton /> : undefined}
      >
        {team ? (
          <>
            <TeamNavigation current="team" owner={role === 'OWNER'} />
            <TeamStats members={members} invites={invites} />
            <MembersTable members={members} />
            <PendingInvites invites={invites} />
          </>
        ) : (
          <Notice tone="muted">
            Приглашать и отключать сотрудников могут владелец и управляющий.
          </Notice>
        )}
      </Page>
    </TeamProvider>
  );
}
