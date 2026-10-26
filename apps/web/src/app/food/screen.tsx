import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadFood } from './load';
import { WorkspaceBoard } from './workspace-board';
import { CatalogBoard } from './catalog-board';
import { serverT } from '../../i18n/server';
import { deskShell } from '../../lib/desk-shell';
import { CustomerSectionTabs } from '../customers/section-tabs';
import './food.css';
import './restaurant.css';
export async function FoodScreen({
  kind,
  date,
  time,
  startNew = false,
  listView = false,
}: {
  kind: 'floor' | 'list' | 'catalog';
  date?: string | undefined;
  time?: string | undefined;
  /** `?new=1`: форма новой брони открыта сразу (быстрое действие «Главной») */
  startNew?: boolean;
  listView?: boolean;
}) {
  const t = await serverT();
  const title = kind === 'floor' ? t('Журнал') : kind === 'list' ? t('Брони столов') : t('Залы и столы');
  try {
    const data = await loadFood(date, time, kind !== 'floor', kind === 'floor');
    return (
      <Page
        title={title}
        // эталон владельца 13.10.2026 (зал ресторана): подпись под заголовком плана
        subtitle={kind === 'floor' ? t('Бронирования столов и загрузка зала') : undefined}
        // журнал (план зала и расписание): видимая шапка общая `JournalHead` (23.10.2026); на ПК в один экран
        // (ТЗ 25.10.2026, п. 9): страница не прокручивается, план зала и шкала листаются внутри
        className={kind === 'catalog' ? '' : 'journal-page journal-screen'}
      >
        <div key={data.scopeKey} className={kind === 'catalog' ? undefined : 'journal-screen__pass'}>
          {/* «Брони столов» вторая вкладка раздела «Клиенты», как «Записи» салона (эталон 25.10.2026) */}
          {kind === 'list' && (
            <CustomerSectionTabs access={(await deskShell()).access} vertical="FOOD_SERVICE" current="/table-reservations" t={t} />
          )}
          {kind === 'catalog' ? (
            <CatalogBoard data={data} />
          ) : (
            <WorkspaceBoard data={data} floor={kind === 'floor'} startNew={startNew} listView={listView} />
          )}
        </div>
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={title}>
        <LoadError testId="food-load-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
