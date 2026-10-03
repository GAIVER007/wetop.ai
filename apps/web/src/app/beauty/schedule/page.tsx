import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { ScheduleBoard } from './board';
import '../beauty.css';

/**
 * «График» мастера (срез B4, Q-251): недельный шаблон в этом филиале, отсутствия и филиалы мастера.
 *
 * График на филиал: одна и та же рука в двух салонах работает в разные часы. Отсутствие на всю сеть.
 * Право на правку это `property`, как сам мастер в срезе B3 (решение Q-253).
 */
export default async function BeautySchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { employee } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const loaded = await beautyApi.schedule(employee).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="График">
        <LoadError testId="beauty-schedule-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );

  const canEdit = mayAccess(shell.access, 'property') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="График"
      subtitle={
        loaded.value.location
          ? `Недельный график мастера в филиале «${loaded.value.location.name ?? 'без имени'}».`
          : 'Недельный график мастера. Филиал пока не выбран.'
      }
    >
      <ScheduleBoard data={loaded.value} canEdit={canEdit} />
    </Page>
  );
}
