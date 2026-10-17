import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { MastersBoard } from './board';
import '../beauty.css';

/**
 * «Мастера» салона (срез B3, ADR-141): сотрудники сети, их филиалы и умения.
 * Право на правку это `property`: в гостинице оно закрывает то, чем объект работает (решение Q-253).
 */
export default async function BeautyMastersPage({
  searchParams,
}: { searchParams?: Promise<{ employee?: string | string[] }> } = {}) {
  await requireFeature('/beauty/masters');
  const params = await searchParams;
  const requested = typeof params?.employee === 'string' ? params.employee : '';
  const employeeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    requested,
  )
    ? requested
    : '';
  const shell = await deskShell();
  const loaded = await Promise.all([
    beautyApi.employees(),
    beautyApi.services(),
    beautyApi.day(),
    beautyApi.schedule(),
  ]).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="Мастера">
        <LoadError testId="beauty-masters-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const [employees, services, today, schedule] = loaded.value;
  const canEdit = mayAccess(shell.access, 'property') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="Мастера"
      subtitle="Мастер работает в сети: его можно поставить в несколько филиалов."
    >
      <p>
        <Link href="/register/setup">Вернуться к настройке салона</Link>
      </p>
      <MastersBoard
        key={employees.locationId ?? 'business'}
        {...(schedule.businessName !== undefined ? { businessName: schedule.businessName } : {})}
        {...(typeof schedule.location?.name === 'string' ? { locationName: schedule.location.name } : {})}
        scopeKey={employees.locationId ?? ''}
        items={employees.items}
        services={services.items}
        today={today}
        locations={schedule.locations}
        canEdit={canEdit}
        initialEmployeeId={employeeId}
        unavailable={Boolean(requested) && !employees.items.some((row) => row.id === employeeId)}
      />
    </Page>
  );
}
