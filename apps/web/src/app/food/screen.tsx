import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { loadFood } from './load';
import { WorkspaceBoard } from './workspace-board';
import { CatalogBoard } from './catalog-board';
import { FoodRemindersToday } from './reminders-today';
import { foodApi, type FoodReminderItem } from '../../lib/food-api';
import { serverT } from '../../i18n/server';
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
  const title = kind === 'floor' ? t('План зала') : kind === 'list' ? t('Бронирования') : t('Залы и столы');
  try {
    const data = await loadFood(date, time, kind !== 'floor', kind === 'floor');
    // «Напомнить сегодня» (§61): только «Вручную» и «Ошибка»; сбой загрузки не ломает экран, блока просто нет
    const manual =
      kind === 'catalog'
        ? null
        : await foodApi
            .reminders()
            .then((d) => ({ timezone: d.timezone, items: d.items.filter((i: FoodReminderItem) => i.state === 'MANUAL' || i.state === 'FAILED') }))
            .catch(() => null);
    return (
      <Page
        title={title}
        // эталон владельца 13.10.2026 (зал ресторана): подпись под заголовком плана
        subtitle={kind === 'floor' ? t('Бронирования столов и загрузка зала') : undefined}
      >
        <div key={data.scopeKey}>
          {manual && manual.items.length > 0 && (
            <FoodRemindersToday items={manual.items} timezone={manual.timezone} canUpdate={data.canDesk && !data.readOnly} />
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
