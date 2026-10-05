import { requireVertical } from '../../../lib/vertical-guard';
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
export default async function BeautyMastersPage() {
  await requireVertical(['BEAUTY']);
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
      <Page title="Сотрудники">
        <LoadError testId="beauty-masters-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );
  const [employees, services, today, schedule] = loaded.value;
  const canEdit = mayAccess(shell.access, 'property') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="Сотрудники"
      subtitle="Мастер работает в сети: его можно поставить в несколько филиалов."
    >
      <MastersBoard
        items={employees.items}
        services={services.items}
        today={today}
        locations={schedule.locations}
        canEdit={canEdit}
      />
    </Page>
  );
}
