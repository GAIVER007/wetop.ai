import { requireFeature } from '../../lib/vertical-guard';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../components/page';
import { LoadError } from '../../components/load-error';
import { loadErrorProps } from '../../lib/load-error';
import { beautyApi, type BeautyDay } from '../../lib/api';
import { currentMe, deskShell } from '../../lib/desk-shell';
import { mayBeautyAccess } from '../../lib/navigation';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import { calendarColumns } from '../beauty/calendar-columns';
import { AppointmentsList } from './list';
import { CustomerSectionTabs } from '../customers/section-tabs';
import { serverT } from '../../i18n/server';
import '../beauty/beauty.css';
import './appointments.css';

function readOnlyDay(
  data: Awaited<ReturnType<typeof beautyApi.period>>,
  unknownEmployee: string,
): BeautyDay {
  const columns = new Map<string, BeautyDay['columns'][number]>();
  const services = new Map<string, BeautyDay['services'][number]>();
  const starts: number[] = [];
  const ends: number[] = [];
  for (const appointment of data.appointments) {
    const lines = appointment.items?.length ? appointment.items : [appointment];
    for (const line of lines) {
      columns.set(line.employeeId, {
        id: line.employeeId,
        name: 'employeeName' in line ? line.employeeName : unknownEmployee,
        intervals: [],
        timeOff: false,
        timeOffReason: null,
        serviceIds: [],
      });
      services.set(line.serviceId, {
        id: line.serviceId,
        name: line.serviceName,
        category: null,
        sellable: false,
        durationMinutes: 'durationMinutes' in line
          ? line.durationMinutes
          : line.endMinutes - line.startMinutes,
        priceMinor: line.priceMinor,
        currency: line.currency,
      });
      starts.push(line.startMinutes);
      ends.push(line.endMinutes);
    }
  }
  return {
    location: data.location,
    date: data.period.from,
    columns: [...columns.values()],
    appointments: data.appointments,
    services: [...services.values()],
    bounds: {
      fromMinutes: starts.length ? Math.min(480, ...starts) : 480,
      toMinutes: ends.length ? Math.max(1200, ...ends) : 1200,
    },
  };
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFeature('/appointments');
  const t = await serverT();
  const { date, from, to, create, customer } = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const me = await currentMe();
  const may = (
    section: Parameters<typeof mayBeautyAccess>[1],
    action: Parameters<typeof mayBeautyAccess>[2],
    legacy: Parameters<typeof mayBeautyAccess>[3]['legacy'],
  ) => !shell.readOnly && mayBeautyAccess(shell.access, section, action, { legacy });
  const canReadJournal = mayBeautyAccess(shell.access, 'journal', 'view', { legacy: 'desk' });
  const canReadCustomers = mayBeautyAccess(shell.access, 'customers', 'view', { legacy: 'desk' });
  const canReadEmployees = mayBeautyAccess(shell.access, 'employees', 'view', { legacy: 'desk' });
  const requestedCreate = may('appointments', 'create', 'desk');
  const canCreate = requestedCreate && canReadJournal && canReadCustomers;
  const scopeKey = JSON.stringify({
    organizationId: me.user?.organizationId,
    businessId: me.context?.businessId,
    locationId: me.context?.locationId,
  });
  try {
    const [periodData, creationDay, employees, customers] = await Promise.all([
      beautyApi.period(from ?? date, to ?? date),
      canCreate ? beautyApi.day(from ?? date) : Promise.resolve(null),
      canReadEmployees ? beautyApi.employees() : Promise.resolve({ items: [] }),
      canCreate ? beautyApi.customers() : Promise.resolve({ items: [] }),
    ]);
    const periodDay = readOnlyDay(periodData, t('Специалист'));
    const listDay = creationDay
      ? { ...creationDay, appointments: periodData.appointments }
      : periodDay;
    return (
      <Page
        className="beauty-page"
        title={t('Записи')}
        subtitle={t('Все записи филиала за выбранный период: поиск, фильтры и оплата.')}
      >
        <CustomerSectionTabs access={shell.access} current="appointments" t={t} />
        <AppointmentsList
          key={scopeKey}
          scopeKey={scopeKey}
          day={{ ...listDay, columns: calendarColumns(listDay, employees.items) }}
          period={periodData.period}
          customers={customers.items}
          readOnly={shell.readOnly}
          canCreate={canCreate}
          canUpdate={may('appointments', 'update', 'desk')}
          canPay={may('finance', 'create', 'desk')}
          canRefund={may('finance', 'refund', 'refunds')}
          canIssueReview={may('reviews', 'create', 'staff')}
          canAdjustPrice={may('services', 'update', 'rates')}
          openCreate={create === '1' && canCreate}
          {...(create === '1' && customer ? { createFor: customer } : {})}
          {...(requestedCreate && !canCreate
            ? {
                creationUnavailableReason: t(
                  'Для создания записи нужен доступ к календарю и списку клиентов.',
                ),
              }
            : {})}
        />
      </Page>
    );
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page title={t('Записи')}>
        <LoadError testId="beauty-appointments-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
}
