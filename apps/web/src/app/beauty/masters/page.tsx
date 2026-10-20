import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi, type BeautyDay } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayBeautyAccess } from '../../../lib/navigation';
import { MastersBoard } from './board';
import { loadStaffRevenue, StaffRevenuePeriodNav } from '../../../components/staff-revenue';
import { revenuePeriodParam } from '../../../lib/staff-revenue';
import '../beauty.css';

/**
 * «Мастера» салона (срез B3, ADR-141): сотрудники сети, их филиалы и умения.
 * Право на правку это `property`: в гостинице оно закрывает то, чем объект работает (решение Q-253).
 */
export default async function BeautyMastersPage({
  searchParams,
}: { searchParams?: Promise<{ employee?: string | string[]; period?: string | string[] }> } = {}) {
  await requireFeature('/beauty/masters');
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
  const loaded = await Promise.all([
    beautyApi.employees(),
    canReadServices
      ? beautyApi.services()
      : Promise.resolve({ locationId: null, locationCurrency: null, items: [] }),
    canReadJournal ? beautyApi.day() : Promise.resolve(null),
    canReadJournal ? beautyApi.schedule() : Promise.resolve(null),
    loadStaffRevenue('branch', period),
  ]).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="Специалисты">
        <LoadError testId="beauty-masters-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const [employees, services, loadedToday, loadedSchedule, revenue] = loaded.value;
  const today: BeautyDay = loadedToday ?? {
    location: { id: employees.locationId ?? '', name: null, timezone: 'UTC', currency: '' },
    date: '', columns: [], appointments: [], services: [], bounds: { fromMinutes: 480, toMinutes: 1200 },
  };
  const may = (section: 'employees' | 'services', action: 'create' | 'update') =>
    !shell.readOnly &&
    mayBeautyAccess(shell.access, section, action, {
      legacy: section === 'services' ? 'rates' : 'property',
    });
  return (
    <Page
      className="beauty-page"
      title="Специалисты"
      subtitle="Специалист работает в сети: его можно поставить в несколько филиалов."
    >
      <p>
        <Link href="/register/setup">Вернуться к настройке салона</Link>
      </p>
      <MastersBoard
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
        canCreate={may('employees', 'create')}
        canUpdate={may('employees', 'update')}
        canManagePrices={may('services', 'update')}
        canAssignPersonnelKind={employees.canAssignPersonnelKind === true && !shell.readOnly}
        initialEmployeeId={employeeId}
        revenue={revenue}
        revenueNav={<StaffRevenuePeriodNav path="/employees" period={period} />}
        unavailable={Boolean(requested) && !employees.items.some((row) => row.id === employeeId)}
      />
    </Page>
  );
}
