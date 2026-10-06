import { requireVertical } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { deskShell } from '../../lib/desk-shell';
import { JournalBoard } from './journal';
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
  await requireVertical(['BEAUTY']);
  const { date } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const loaded = await Promise.all([
    beautyApi.day(date),
    beautyApi.customers(),
    beautyApi.employees(),
  ]).then(
    (value) => ({
      ok: true as const,
      value: value[0],
      customers: value[1].items,
      employees: value[2].items,
    }),
    (error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );
  if (!loaded.ok)
    return (
      <Page title="Салон">
        <LoadError testId="beauty-journal-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );

  return (
    <Page
      className="beauty-page"
      title="Календарь"
      subtitle={loaded.value.location.name ?? 'Записи филиала'}
    >
      <JournalBoard
        day={loaded.value}
        customers={loaded.customers}
        employees={loaded.employees}
        readOnly={shell.readOnly}
      />
    </Page>
  );
}
