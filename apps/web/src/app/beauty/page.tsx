import { requireFeature } from '../../lib/vertical-guard';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { deskShell } from '../../lib/desk-shell';
import { mayAccess } from '../../lib/navigation';
import { JournalBoard } from './journal';
import { WeekCalendar } from './week-calendar';
import './beauty.css';

/**
 * Главный экран салона: журнал записей за день (срез B5, DATA_MODEL §19.1).
 *
 * Это аналог шахматки по роли на экране, но своя таблица и свой экран: общей таблицы броней и общего
 * «ресурса» у вертикалей нет (ADR-104). Столбцы это мастера филиала, строки время, плитка это запись.
 */
export default async function BeautyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/beauty');
  const { date, view, appointment } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const loaded = await Promise.all([
    beautyApi.day(date),
    beautyApi.customers(),
    beautyApi.employees(),
  ]).then(async (value) => {
      const week = view === 'week'
        ? await Promise.all(Array.from({ length: 7 }, (_, index) => {
            const at = new Date(`${value[0].date}T12:00:00Z`);
            const weekday = (at.getUTCDay() + 6) % 7;
            at.setUTCDate(at.getUTCDate() - weekday + index);
            const day = at.toISOString().slice(0, 10);
            return day === value[0].date ? value[0] : beautyApi.day(day);
          }))
        : null;
      return {
        ok: true as const,
        value: value[0],
        customers: value[1].items,
        employees: value[2].items,
        week,
      };
    }).catch((error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  if (!loaded.ok)
    return (
      <Page title="Салон">
        <LoadError testId="beauty-journal-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );

  return (
    <Page
      className="beauty-page"
      title="Журнал"
      subtitle={`Расписание мастеров и услуг салона${loaded.value.location.name ? `, ${loaded.value.location.name}` : ''}`}
    >
      <nav className="beauty-calendar-views" aria-label="Вид календаря">
        <Link className="btn btn--secondary" aria-current={view !== 'week' ? 'page' : undefined} href={`/calendar?date=${loaded.value.date}`}>День</Link>
        <Link className="btn btn--secondary" aria-current={view === 'week' ? 'page' : undefined} href={`/calendar?date=${loaded.value.date}&view=week`}>Неделя</Link>
      </nav>
      {loaded.week ? <WeekCalendar days={loaded.week} employees={loaded.employees} /> : (
        <JournalBoard
          key={`${loaded.value.date}:${appointment ?? ''}`}
          day={loaded.value}
          customers={loaded.customers}
          employees={loaded.employees}
          readOnly={shell.readOnly}
          canRefund={!shell.readOnly && mayAccess(shell.access, 'refunds')}
          appointmentId={appointment}
        />
      )}
    </Page>
  );
}
