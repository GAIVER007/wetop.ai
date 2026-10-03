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
export default async function BeautyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { date } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const loaded = await beautyApi.day(date).then(
    (value) => ({ ok: true as const, value }),
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
      title={loaded.value.location.name ?? 'Салон'}
      subtitle="Журнал записей: кто и когда придёт к мастерам этого филиала."
    >
      <JournalBoard day={loaded.value} readOnly={shell.readOnly} />
    </Page>
  );
}
