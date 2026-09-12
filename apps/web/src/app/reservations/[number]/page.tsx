import Link from 'next/link';
import {
  api,
  chessboardApi,
  financeApi,
  formatMinor,
  messengerLinks,
  reservationsApi,
} from '../../../lib/api';
import { Page } from '../../../components/page';
import { SectionTitle, Stat, Stats, StatusBadge, Table } from '../../../components/ui';
import { ReservationActions } from './actions-panel';
import { FinancePanel } from './finance-panel';

const STATUS_RU: Record<string, string> = {
  TENTATIVE: 'предварительная',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};
const SOURCE_RU: Record<string, string> = {
  DESK: 'стойка',
  PHONE: 'телефон',
  WHATSAPP: 'WhatsApp',
  WALK_IN: 'с улицы',
  INSTAGRAM: 'Instagram',
  OTA: 'OTA',
  WEBSITE: 'сайт',
};

/** Карточка брони + действия стойки (шаг 3.5): даты, отмена, назначение/переселение. */
export default async function ReservationPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const r = await chessboardApi.reservation(decodeURIComponent(number));
  const [ratePlans, finance, services, summary, availabilities] = await Promise.all([
    reservationsApi.ratePlans(),
    financeApi.reservation(r.confirmationNumber),
    financeApi.services(),
    api.inventorySummary(),
    Promise.all(
      r.items.map((it) =>
        reservationsApi.availability(it.arrivalDate, it.departureDate).catch(() => null),
      ),
    ),
  ]);
  const print = (path: string) =>
    `/reservations/${encodeURIComponent(r.confirmationNumber)}/print${path}`;
  const guestMessengers = messengerLinks(r.primaryGuest?.phone);
  return (
    <Page
      width="medium"
      crumbs={
        <>
          <Link href="/chessboard">← шахматка</Link>
          <span className="ml-auto">
            печать:{' '}
            <Link href={print('?lang=ru')} data-testid="print-ru">
              регистрационная карта RU
            </Link>{' '}
            ·{' '}
            <Link href={print('?lang=kz')} data-testid="print-kz">
              KZ
            </Link>
            {/* заготовки печатных форм — содержание заменит образец владельца */} · договор{' '}
            <Link href={print('/contract?lang=ru')} data-testid="print-contract-ru">
              RU
            </Link>{' '}
            ·{' '}
            <Link href={print('/contract?lang=kz')} data-testid="print-contract-kz">
              KZ
            </Link>{' '}
            · счёт{' '}
            <Link href={print('/invoice?lang=ru')} data-testid="print-invoice-ru">
              RU
            </Link>{' '}
            ·{' '}
            <Link href={print('/invoice?lang=kz')} data-testid="print-invoice-kz">
              KZ
            </Link>
          </span>
        </>
      }
      title={`Бронь ${r.confirmationNumber}`}
      subtitle={
        <>
          <StatusBadge status={r.status} label={STATUS_RU[r.status] ?? r.status} /> ·{' '}
          {SOURCE_RU[r.source] ?? r.source}
          {r.channel ? ` · ${r.channel}` : ''}
        </>
      }
    >
      <Stats min={160}>
        <Stat label="Заезд" size="compact" value={r.arrivalDate} />
        <Stat label="Выезд" size="compact" value={r.departureDate} />
        <Stat
          label="Гостей"
          size="compact"
          value={`${r.adults}${r.children ? ` + ${r.children} дет.` : ''}`}
        />
        <Stat label="Сумма" size="compact" value={formatMinor(r.totalAmountMinor, r.currency)} />
        <Stat
          label="Заказчик"
          size="compact"
          value={
            r.primaryGuest ? (
              <Link href={`/guests/${r.primaryGuest.id}`} data-testid="guest-link">
                {r.primaryGuest.label}
              </Link>
            ) : (
              '—'
            )
          }
          hint={
            r.primaryGuest
              ? r.primaryGuest.citizenship
                ? `гражданство ${r.primaryGuest.citizenship}`
                : 'гражданство не указано'
              : undefined
          }
          hintTone={r.primaryGuest && !r.primaryGuest.citizenship ? 'warn' : undefined}
        >
          {guestMessengers && (
            <div className="stat__extra">
              <a
                href={guestMessengers.whatsapp}
                target="_blank"
                rel="noreferrer"
                data-testid="guest-whatsapp"
              >
                WhatsApp
              </a>
              <a
                href={guestMessengers.telegram}
                target="_blank"
                rel="noreferrer"
                data-testid="guest-telegram"
              >
                Telegram
              </a>
            </div>
          )}
        </Stat>
      </Stats>
      <SectionTitle first>Проживания</SectionTitle>
      <Table>
        <thead>
          <tr>
            {['Ячейка', 'Категория', 'Заезд', 'Выезд', 'Статус', 'Цена', 'Гости'].map((h) => (
              <th key={h} className={h === 'Цена' ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.items.map((it) => (
            <tr key={it.id} data-testid="stay-row">
              <td className="mono">
                {it.unitCode ?? <span className="warn-text">не назначена</span>}
              </td>
              <td>{it.accommodationTypeName}</td>
              <td>{it.arrivalDate}</td>
              <td>{it.departureDate}</td>
              <td>
                <StatusBadge status={it.status} label={STATUS_RU[it.status] ?? it.status} />
              </td>
              <td className="num">{formatMinor(it.priceMinor, r.currency)}</td>
              <td>
                {it.guests.map((g) => g.label).join(', ') || '—'}
                <span className="hint" data-testid="stay-guests-count">
                  {' '}
                  · {it.adults}
                  {it.children ? ` + ${it.children} дет.` : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {r.notes && (
        <p className="note note--lg" data-testid="reservation-notes">
          <b>Заметки:</b> {r.notes}
        </p>
      )}
      <SectionTitle>Счета</SectionTitle>
      <FinancePanel
        number={r.confirmationNumber}
        finance={finance}
        services={services}
        today={new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10)}
      />
      <ReservationActions
        number={r.confirmationNumber}
        status={r.status}
        source={r.source}
        notes={r.notes}
        arrivalDate={r.arrivalDate}
        departureDate={r.departureDate}
        ratePlans={ratePlans}
        items={r.items.map((it, i) => {
          const byCategory = availabilities[i]?.byCategory ?? {};
          const names = new Map(summary.byCategory.map((c) => [c.code, c.name]));
          // Переселять можно и в другую категорию (T1): предлагаем свободные ячейки всех категорий,
          // своя — первой; цену система пересчитает по календарю выбранной категории
          const groups = Object.entries(byCategory)
            .map(([code, v]) => ({
              code,
              name: names.get(code) ?? code,
              units: v.availableUnitCodes,
            }))
            .filter((g) => g.units.length > 0)
            .sort((a, b) =>
              a.code === it.accommodationTypeCode
                ? -1
                : b.code === it.accommodationTypeCode
                  ? 1
                  : 0,
            );
          return {
            id: it.id,
            status: it.status,
            accommodationTypeCode: it.accommodationTypeCode,
            accommodationTypeName: it.accommodationTypeName,
            unitCode: it.unitCode,
            adults: it.adults,
            availableGroups: groups,
          };
        })}
      />
    </Page>
  );
}
