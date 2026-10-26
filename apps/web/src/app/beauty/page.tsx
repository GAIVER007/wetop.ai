import { requireFeature } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { Tabs } from '../../components/tabs';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi } from '../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { mayBeautyAccess } from '../../lib/navigation';
import { JournalBoard } from './journal';
import { MonthCalendar } from './month-calendar';
import { monthGrid } from './month-grid';
import { serverT } from '../../i18n/server';
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
  const t = await serverT();
  const { date, view: rawView, appointment, employee, service, status, new: requestedNew } = normalizeSearchParams(
    await searchParams,
  );
  // «Неделю» заменил «Месяц» (владелец 26.10.2026); старые закладки view=week открывают месяц
  const view = rawView === 'week' || rawView === 'month' ? 'month' : undefined;
  const filters = new URLSearchParams();
  if (employee) filters.set('employee', employee);
  if (service) filters.set('service', service);
  if (status) filters.set('status', status);
  const shell = await deskShell();
  const me = await currentMe();
  const may = (
    section: Parameters<typeof mayBeautyAccess>[1],
    action: Parameters<typeof mayBeautyAccess>[2],
    legacy: Parameters<typeof mayBeautyAccess>[3]['legacy'],
  ) => !shell.readOnly && mayBeautyAccess(shell.access, section, action, { legacy });
  const canReadCustomers = mayBeautyAccess(shell.access, 'customers', 'view', { legacy: 'desk' });
  const canReadEmployees = mayBeautyAccess(shell.access, 'employees', 'view', { legacy: 'desk' });
  const requestedCreate = may('appointments', 'create', 'desk');
  const canCreate = requestedCreate && canReadCustomers;
  const scopeKey = JSON.stringify({
    organizationId: me.user?.organizationId,
    businessId: me.context?.businessId,
    locationId: me.context?.locationId,
  });
  const loaded = await Promise.all([
    beautyApi.day(date),
    canCreate ? beautyApi.customers() : Promise.resolve({ items: [] }),
    canReadEmployees ? beautyApi.employees() : Promise.resolve({ items: [] }),
  ])
    .then(async (value) => {
      // месяц одним запросом за всю сетку (с понедельника недели 1-го по воскресенье недели последнего числа)
      const grid = view === 'month' ? monthGrid(value[0].date).days : null;
      const month = grid ? (await beautyApi.period(grid[0], grid.at(-1))).appointments : null;
      return {
        ok: true as const,
        value: value[0],
        customers: value[1].items,
        employees: value[2].items,
        month,
      };
    })
    .catch((error: unknown) => {
      // управление самого Next (переход на вход) пропускаем дальше, иначе страница его проглотит
      unstable_rethrow(error);
      return { ok: false as const, error };
    });
  if (!loaded.ok)
    return (
      <Page title={t('Салон')}>
        <LoadError testId="beauty-journal-error" {...loadErrorProps(loaded.error)} />
      </Page>
    );

  // «День / Месяц» (до 26.10.2026 «День / Неделя»): в дне стоят в строке инструментов рядом с датой (аудит 21.10.2026, п. 34). Без предзагрузки:
  // предзагрузка этих двух адресов на живом сайте висела открытым запросом, и страница не затихала (п. 3)
  // переключатель тот же, что «План зала / Расписание» ресторана (`Tabs`, без предзагрузки), владелец 24.10.2026:
  // «в каждой вертикали всё по-разному выглядит»
  const views = (
    <Tabs
      label={t('Вид журнала')}
      items={[
        { href: `/calendar?date=${loaded.value.date}&${filters}`, label: t('День'), current: view !== 'month' },
        { href: `/calendar?date=${loaded.value.date}&view=month&${filters}`, label: t('Месяц'), current: view === 'month' },
      ]}
    />
  );
  return (
    <Page
      // день журнала на ПК в один экран (п. 9): страница не прокручивается, сетка и панель дня листаются внутри
      className={`beauty-page journal-page${loaded.month ? ' journal-month' : ' journal-screen'}`}
      title={t('Журнал')}
      subtitle={
        loaded.value.location.name
          ? t('Расписание специалистов и услуг салона, {name}', { name: loaded.value.location.name })
          : t('Расписание специалистов и услуг салона')
      }
    >
      {loaded.month ? (
        <MonthCalendar
          views={views}
          canCreate={canCreate && !shell.readOnly}
          day={loaded.value}
          rows={loaded.month}
          employees={loaded.employees}
          selectedDate={loaded.value.date}
        />
      ) : (
        <JournalBoard
          key={`${scopeKey}:${loaded.value.date}:${appointment ?? ''}`}
          day={loaded.value}
          customers={loaded.customers}
          employees={loaded.employees}
          readOnly={shell.readOnly}
          canCreate={canCreate}
          canUpdate={may('appointments', 'update', 'desk')}
          canPay={may('finance', 'create', 'desk')}
          canRefund={may('finance', 'refund', 'refunds')}
          canIssueReview={may('reviews', 'create', 'staff')}
          canAdjustPrice={may('services', 'update', 'rates')}
          {...(requestedCreate && !canReadCustomers
            ? { creationUnavailableReason: t('Для создания записи нужен доступ к списку клиентов.') }
            : {})}
          appointmentId={appointment}
          newFor={requestedNew === '1' ? employee : undefined}
          scopeKey={scopeKey}
          views={views}
        />
      )}
    </Page>
  );
}
