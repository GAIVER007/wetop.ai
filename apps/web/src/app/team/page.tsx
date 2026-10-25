import { unstable_rethrow } from 'next/navigation';
import { canManageStaff, parseMembershipRole } from '@pms/domain';
import { authApi } from '../../lib/api';
import { clientInfo, sessionToken } from '../../lib/session';
import { TeamNavigation } from '../../components/team-navigation';
import { Page } from '../../components/page';
import { Notice } from '../../components/ui';
import { RefreshButton } from '../../components/refresh-button';
import { validAccessStructure } from './scope-model';
import { currentMe } from '../../lib/desk-shell';
import { InviteButton, MembersTable, PendingInvites, TeamProvider } from './team-board';
import { loadStaffRevenue, StaffRevenuePeriodNav } from '../../lib/staff-revenue-load';
import { revenuePeriodParam } from '../../lib/staff-revenue';
import { serverT } from '../../i18n/server';
import { translator } from '../../i18n';
import { verticalCopy } from '../../lib/vertical-copy';
import './team.css';

/**
 * «Сотрудники и доступ» (TEAM1, STAFF2.2): люди организации с ролями, датой входа в организацию и «Был в системе»;
 * приглашения — панелью из шапки, ожидающие — ниже списком. Данные и права — прежние API команды
 * (ADR-107, ADR-131): раздел виден владельцу и управляющему (право `staff`, гейт — по реестру меню).
 * На вход страница не уводит (ADR-107: роль не узнали — страница открыта, решает API; в стойке с
 * замком сюда без сессии не попасть); без права — строка, кто ведает командой. Личные сеансы
 * остались в «Профиль → Доступ». Ошибка загрузки — границей ошибок, не пустой командой.
 */
export default async function TeamPage({
  searchParams,
}: { searchParams?: Promise<{ period?: string | string[] }> } = {}) {
  // язык не прочитался (вне запроса Next): страница русская, как до перевода; переходы Next идут дальше
  const t = await serverT().catch((error: unknown) => {
    unstable_rethrow(error);
    return translator('ru');
  });
  const token = await sessionToken();
  const me = await currentMe().catch((error: unknown) => {
    unstable_rethrow(error);
    return { user: null };
  });
  const role = me.user?.role ? parseMembershipRole(me.user.role) : null;
  const team = !!token && !!me.user?.organization && !!role && canManageStaff(role);
  const info = await clientInfo();
  const [invites, members, structure] =
    token && team
      ? await Promise.all([
          authApi.invites(token, info),
          authApi.members(token, info),
          // Отказ и невалидный ответ не означают доступ ко всей организации.
          authApi
            .accessStructure(token, info)
            .then((value) => (validAccessStructure(value) ? value : null))
            .catch((error: unknown) => {
              unstable_rethrow(error);
              return null;
            }),
        ])
      : [[], [], null];
  // «сколько принёс» гостиницы (решение 20.10.2026): по создавшему бронь; у салона и ресторана свод на своих экранах
  const period = revenuePeriodParam((await searchParams)?.period);
  const revenue =
    team && 'context' in me && me.context?.vertical === 'HOSPITALITY' ? await loadStaffRevenue('hotel', period) : null;
  return (
    <TeamProvider
      key={me.user?.organizationId ?? 'unknown'}
      role={team && role ? role : null}
      structure={structure}
      expectedOrganizationId={me.user?.organizationId ?? null}
      vertical={'context' in me && typeof me.context?.vertical === 'string' ? me.context.vertical : 'HOSPITALITY'}
    >
      <Page
        // заголовок равен пункту меню своего направления («Доступ и роли» у ресторана), эталон салона 25.10.2026
        title={t(verticalCopy('context' in me ? me.context?.vertical : null).menu.team)}
        subtitle={
          me.user?.organization?.name
            ? t('{name}: команда, должности и приглашения', { name: me.user.organization.name })
            : t('Команда, должности и приглашения')
        }
        actions={team ? <InviteButton /> : undefined}
      >
        {team ? (
          <>
            <TeamNavigation current="team" owner={role === 'OWNER'} />
            {!structure && (
              <Notice role="alert">
                {t('Не удалось загрузить структуру доступа. Приглашения и изменение области доступа недоступны.')}
                <RefreshButton label={t('Повторить загрузку')} />
              </Notice>
            )}
            <MembersTable
              members={members}
              structure={structure}
              actorRole={role}
              revenue={revenue}
              revenueNav={<StaffRevenuePeriodNav path="/team" period={period} />}
            />
            <PendingInvites invites={invites} />
          </>
        ) : (
          <Notice tone="muted">
            {t('Приглашать и отключать сотрудников могут владелец и управляющий.')}
          </Notice>
        )}
      </Page>
    </TeamProvider>
  );
}
