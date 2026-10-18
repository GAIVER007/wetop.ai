import Link from 'next/link';
import { requireFeature } from '../../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { beautyApi } from '../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { isIsoDate, todayAt } from '@pms/domain';
import { ScheduleBoard, type WeekGridData } from './board';
import { mondayOf } from './week';
import '../beauty.css';

/**
 * «График» мастеров (срез B4, Q-251; сетка недели по поручению владельца 17.10.2026): все мастера филиала
 * строками, дни выбранной недели колонками. Неделя в адресе `?week=YYYY-MM-DD`, по умолчанию текущая.
 *
 * График на филиал: одна и та же рука в двух салонах работает в разные часы. Отсутствие на всю сеть.
 * Право на правку это `property`, как сам мастер в срезе B3 (решение Q-253).
 */
export default async function BeautySchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/beauty/schedule');
  const { week } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const loaded = await loadGrid(typeof week === 'string' ? week : undefined).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="График работы">
        <LoadError testId="beauty-schedule-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );

  const canEdit = mayAccess(shell.access, 'property') && !shell.readOnly;
  return (
    <Page
      className="beauty-page"
      title="График работы"
      subtitle={
        loaded.value.location
          ? `Кто работает в филиале «${loaded.value.location.name ?? 'без имени'}» по дням недели.`
          : 'График мастеров. Филиал пока не выбран.'
      }
    >
      <p>
        <Link href="/register/setup">Вернуться к настройке салона</Link>
      </p>
      <ScheduleBoard
        key={loaded.value.location?.id ?? 'none'}
        data={loaded.value}
        canEdit={canEdit}
      />
    </Page>
  );
}

/**
 * Список мастеров и неделя каждого. ponytail: запрос на мастера (в салоне их единицы); общий запрос сетки
 * в API, если мастеров станут десятки.
 */
async function loadGrid(week: string | undefined): Promise<WeekGridData> {
  const first = await beautyApi.schedule();
  const today = todayAt(first.location?.timezone ?? 'UTC');
  const here = first.employees.filter((e) => e.active && e.worksHere);
  const masters = await Promise.all(
    here.map(async (e) => {
      const one = e.id === first.employee?.id ? first : await beautyApi.schedule(e.id);
      return {
        id: e.id,
        name: e.name,
        week: one.week,
        weekRevision: one.weekRevision ?? null,
        timeOffs: one.timeOffs,
      };
    }),
  );
  return {
    location: first.location,
    monday: mondayOf(week && isIsoDate(week) ? week : today),
    masters,
    elsewhere: first.employees.filter((e) => e.active && !e.worksHere).length,
  };
}
