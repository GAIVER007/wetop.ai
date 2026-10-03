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
 * «Мастера» салона (срез B3, ADR-139): сотрудники сети, их филиалы и умения.
 * Право на правку это `property`: в гостинице оно закрывает то, чем объект работает (решение Q-253).
 */
export default async function BeautyMastersPage() {
  const shell = await deskShell();
  const loaded = await Promise.all([
    beautyApi.employees().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
    ),
    beautyApi.services().catch(() => null),
  ]);
  const [employees, services] = loaded;
  if (!employees.ok)
    return (
      <Page title="Мастера">
        <LoadError testId="beauty-masters-error" {...loadErrorProps(employees.error)} />
      </Page>
    );
  const canEdit = mayAccess(shell.access, 'property') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="Мастера"
      subtitle="Мастер работает в сети: его можно поставить в несколько филиалов."
    >
      <MastersBoard
        items={employees.value.items}
        services={services?.items ?? []}
        canEdit={canEdit}
      />
    </Page>
  );
}
