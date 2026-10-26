import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi, type BeautyDay } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess, mayBeautyAccess } from '../../../lib/navigation';
import { accessLevelsFor } from '@pms/domain';
import { MastersBoard, NewSpecialistButton } from './board';
import { SalonSetupLink, salonSetupPending } from './setup-link';
import { loadStaffRevenue, StaffRevenuePeriodNav } from '../../../lib/staff-revenue-load';
import { revenuePeriodParam } from '../../../lib/staff-revenue';
import { serverT } from '../../../i18n/server';
import { loadTeamBoard } from '../../team/people-load';
import { InviteButton, TeamProvider } from '../../team/team-board';
import { TeamNavigation } from '../../../components/team-navigation';
import '../beauty.css';

/**
 * «Мастера» салона (срез B3, ADR-141): сотрудники сети, их филиалы и умения.
 * Право на правку это `property`: в гостинице оно закрывает то, чем объект работает (решение Q-253).
 */
export default async function BeautyMastersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    employee?: string | string[];
    period?: string | string[];
    new?: string | string[];
    onboarding?: string | string[];
  }>;
} = {}) {
  await requireFeature('/beauty/masters');
  const t = await serverT();
  const params = await searchParams;
  const requested = typeof params?.employee === 'string' ? params.employee : '';
  const employeeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    requested,
  )
    ? requested
    : '';
  const period = revenuePeriodParam(params?.period);
  const shell = await deskShell();
  const canReadServices = mayBeautyAccess(shell.access, 'services', 'view', { legacy: 'rates' });
  const canReadJournal = mayBeautyAccess(shell.access, 'journal', 'view', { legacy: 'desk' });
  const teamLoad = loadTeamBoard();
  const loaded = await Promise.all([
    beautyApi.employees(),
    canReadServices
      ? beautyApi.services()
      : Promise.resolve({ locationId: null, locationCurrency: null, items: [] }),
    canReadJournal ? beautyApi.day() : Promise.resolve(null),
    canReadJournal ? beautyApi.schedule() : Promise.resolve(null),
    loadStaffRevenue('branch', period),
    salonSetupPending(params?.onboarding === '1'),
  ]).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title={t('Сотрудники')}>
        <LoadError testId="beauty-masters-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const [employees, services, loadedToday, loadedSchedule, revenue, setupPending] = loaded.value;
  const today: BeautyDay = loadedToday ?? {
    location: { id: employees.locationId ?? '', name: null, timezone: 'UTC', currency: '' },
    date: '', columns: [], appointments: [], services: [], bounds: { fromMinutes: 480, toMinutes: 1200 },
  };
  const may = (section: 'employees' | 'services', action: 'create' | 'update') =>
    !shell.readOnly &&
    mayBeautyAccess(shell.access, section, action, {
      legacy: section === 'services' ? 'rates' : 'property',
    });
  const canCreate = may('employees', 'create');
  const team = await teamLoad;
  const page = (
    <Page
      className="beauty-page"
      title={t('Сотрудники')}
      subtitle={t('Специалист работает в сети: его можно поставить в несколько филиалов.')}
      // кнопка добавления в шапке, как «Пригласить сотрудника» на /team (аудит 21.10.2026, п. 37)
      actions={
        canCreate || team ? (
          <>
            {canCreate && <NewSpecialistButton />}
            {team && <InviteButton />}
          </>
        ) : undefined
      }
    >
      {team && <TeamNavigation current="team" owner={team.actorRole === 'OWNER'} teamHref="/employees" />}
      {setupPending && <SalonSetupLink />}
      <MastersBoard
        headerAction
        openNew={params?.new === '1'}
        key={employees.locationId ?? 'business'}
        {...(loadedSchedule?.businessName !== undefined
          ? { businessName: loadedSchedule.businessName }
          : {})}
        {...(typeof loadedSchedule?.location?.name === 'string'
          ? { locationName: loadedSchedule.location.name }
          : {})}
        scopeKey={employees.locationId ?? ''}
        items={employees.items}
        services={services.items}
        today={today}
        scheduleAvailable={loadedToday !== null}
        locations={loadedSchedule?.locations ?? []}
        canCreate={canCreate}
        canUpdate={may('employees', 'update')}
        canManagePrices={may('services', 'update')}
        canAssignPersonnelKind={employees.canAssignPersonnelKind === true && !shell.readOnly}
        initialEmployeeId={employeeId}
        revenue={revenue}
        revenueNav={<StaffRevenuePeriodNav path="/employees" period={period} />}
        access={{
          levels: may('employees', 'create') && shell.access.role ? accessLevelsFor(shell.access.role) : [],
          canAllBranches:
            shell.access.role === 'OWNER' ||
            (mayAccess(shell.access, 'staff') && shell.access.restricted !== true),
          branchName: typeof loadedSchedule?.location?.name === 'string' ? loadedSchedule.location.name : null,
        }}
        unavailable={Boolean(requested) && !employees.items.some((row) => row.id === employeeId)}
        team={team}
      />
    </Page>
  );
  // общий экран «Сотрудники» (U2): приглашение и действия над входом живут в том же провайдере, что и на /team
  return team ? (
    <TeamProvider role={team.actorRole} structure={team.structure} expectedOrganizationId={team.organizationId} vertical="BEAUTY">
      {page}
    </TeamProvider>
  ) : (
    page
  );
}
