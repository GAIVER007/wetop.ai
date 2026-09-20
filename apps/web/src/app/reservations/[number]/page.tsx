import Link from 'next/link';
import { RecordTabs } from '../../../components/record-tabs';
import { Icon } from '../../../components/icon';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, chessboardApi, financeApi, messengerLinks, reservationsApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { nightsBetween } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { Alert, SectionTitle, StatusBadge, Table } from '../../../components/ui';
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
  const r = await chessboardApi.reservation(decodeURIComponent(number)).catch(notFoundOn404);
  // Одна группа может иметь 36 проживаний на одни даты: запрашиваем период один раз.
  const periods = new Map(r.items.map((it) => [`${it.arrivalDate}/${it.departureDate}`, it]));
  // Доступность считается не дальше 62 ночей (ADR: предел шахматки). У долгих проживаний — а это
  // рабочий случай, на объекте живут по три месяца — запрос заведомо отклоняется, и карточка писала
  // «не загрузилась. Обновите карточку»: совет бесполезный, обновление ничего не изменит.
  // Такие периоды не запрашиваем вовсе и говорим, что делать (найдено обходом стойки 17.09.2026).
  const tooLong = (it: { arrivalDate: string; departureDate: string }) =>
    nightsBetween(it.arrivalDate, it.departureDate) > MAX_CHESSBOARD_DAYS;
  const longPeriods = [...periods.values()].filter(tooLong).length;
  // Справочники тарифов и фонда нужны только формам действий: без них карточка остаётся, а формы
  // предупреждают (волна 3: раньше сбой справочника заменял всю карточку экраном ошибки)
  const [ratePlans, finance, services, summary, periodResults] = await Promise.all([
    reservationsApi.ratePlans().catch(() => null),
    financeApi.reservation(r.confirmationNumber).catch(() => null),
    financeApi.services().catch(() => null),
    api.inventorySummary().catch(() => null),
    Promise.all(
      [...periods.values()].map((it) =>
        tooLong(it)
          ? Promise.resolve(null)
          : reservationsApi.availability(it.arrivalDate, it.departureDate).catch(() => null),
      ),
    ),
  ]);
  const availabilityByPeriod = new Map(
    [...periods.keys()].map((key, i) => [key, periodResults[i]]),
  );
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
      {/*
       * Даты, гости и заказчик — факты, а не показатели: строка «подпись — значение» вместо плиток.
       * Плитками остаются только числа, которые требуют действия (см. экран «Сегодня»).
       */}
      <div className="booking-person">
        <span className="guest-initials">
          {r.primaryGuest?.label
            .split(' ')
            .slice(0, 2)
            .map((n) => n[0])
            .join('') || 'Г'}
        </span>
        <div>
          <h2>{r.primaryGuest?.label ?? 'Гость без имени'}</h2>
          <span>{r.primaryGuest?.phone ?? r.channel ?? 'Прямое бронирование'}</span>
        </div>
      </div>
      <RecordTabs
        label="Разделы карточки брони"
        tabs={[
          {
            id: 'booking-overview',
            label: 'Обзор',
            content: (
              <>
                {r.status === 'TENTATIVE' && (
                  // срез 7.3, Д4: «не подтверждена» словом и цветом внимания, не только бейджем
                  <Alert boxed tone="warning" data-testid="tentative-callout">
                    Бронь не подтверждена: пришла предварительной из канала или Exely, и
                    подтверждение приходит оттуда же. Место за ней держится и второй раз не
                    продаётся.
                  </Alert>
                )}
                <div className="facts facts--card" id="booking-overview">
                  <div>
                    <div className="fact__label">Заезд</div>
                    <div className="fact__value">
                      <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate, 'numeric')}</time>
                    </div>
                  </div>
                  <div>
                    <div className="fact__label">Выезд</div>
                    <div className="fact__value">
                      <time dateTime={r.departureDate}>
                        {displayDate(r.departureDate, 'numeric')}
                      </time>
                    </div>
                  </div>
                  <div>
                    <div className="fact__label">Гостей</div>
                    <div className="fact__value">
                      {r.adults}
                      {r.children ? ` + ${r.children} дет.` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="fact__label">Сумма</div>
                    <div className="fact__value">{formatMoney(r.totalAmountMinor, r.currency)}</div>
                  </div>
                  <div>
                    <div className="fact__label">Заказчик</div>
                    <div className="fact__value">
                      {r.primaryGuest ? (
                        <Link href={`/guests/${r.primaryGuest.id}`} data-testid="guest-link">
                          {r.primaryGuest.label}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </div>
                    {r.primaryGuest && (
                      <div
                        className={r.primaryGuest.citizenship ? 'cell-sub' : 'cell-sub warn-text'}
                      >
                        {r.primaryGuest.citizenship
                          ? `гражданство ${r.primaryGuest.citizenship}`
                          : 'гражданство не указано'}
                        {guestMessengers && (
                          <>
                            {' · '}
                            <a href={guestMessengers.whatsapp} target="_blank" rel="noreferrer">
                              WhatsApp
                            </a>
                            {' · '}
                            <a href={guestMessengers.telegram} target="_blank" rel="noreferrer">
                              Telegram
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <SectionTitle first id="booking-stays">
                  Проживания
                </SectionTitle>
                <Table>
                  <thead>
                    <tr>
                      {['Ячейка', 'Категория', 'Заезд', 'Выезд', 'Статус', 'Цена', 'Гости'].map(
                        (h) => (
                          <th key={h} className={h === 'Цена' ? 'num' : undefined}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((it) => (
                      <tr key={it.id} data-testid="stay-row">
                        <td className="mono">
                          {it.unitCode ?? <span className="warn-text">—</span>}
                        </td>
                        <td>{it.accommodationTypeName}</td>
                        {/* §14: сырую дату видят тесты в datetime, человек — «20 сент.» */}
                        <td className="nowrap">
                          <time dateTime={it.arrivalDate}>{displayDate(it.arrivalDate)}</time>
                        </td>
                        <td className="nowrap">
                          <time dateTime={it.departureDate}>{displayDate(it.departureDate)}</time>
                        </td>
                        <td>
                          <StatusBadge
                            status={it.status}
                            label={STATUS_RU[it.status] ?? it.status}
                          />
                        </td>
                        <td className="num">{formatMoney(it.priceMinor, r.currency)}</td>
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
                <div className="booking-payment-summary">
                  <div>
                    <span>Стоимость</span>
                    <strong>{formatMoney(r.totalAmountMinor, r.currency)}</strong>
                  </div>
                  <div>
                    <span>Оплачено</span>
                    <strong>{finance ? formatMoney(finance.paidMinor, r.currency) : '—'}</strong>
                  </div>
                  <div>
                    <span>К оплате</span>
                    <strong className="danger-text">
                      {finance ? formatMoney(finance.balanceMinor, r.currency) : '—'}
                    </strong>
                  </div>
                </div>
                <div className="booking-shortcuts">
                  <a href="#booking-finance" className="btn">
                    <Icon name="money" />
                    Принять оплату
                  </a>
                  <a href="#booking-actions" className="btn btn--secondary">
                    <Icon name="clock" />
                    Продлить / переселить
                  </a>
                  <Link href={print('/invoice?lang=ru')} className="btn btn--secondary">
                    <Icon name="receipt" />
                    Создать счёт
                  </Link>
                </div>
              </>
            ),
          },
          {
            id: 'booking-finance',
            label: 'Счета',
            content: (
              <>
                <SectionTitle id="booking-finance">Счета</SectionTitle>
                {finance && services ? (
                  <FinancePanel
                    number={r.confirmationNumber}
                    finance={finance}
                    services={services}
                    today={new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10)}
                  />
                ) : (
                  <Alert boxed>
                    Не удалось загрузить счета или каталог услуг. Финансовые действия недоступны до
                    обновления.{' '}
                    <Link href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>
                      Повторить загрузку
                    </Link>
                  </Alert>
                )}
              </>
            ),
          },
          {
            id: 'booking-actions',
            label: 'Действия',
            content: (
              <>
                <SectionTitle id="booking-actions">Действия с бронированием</SectionTitle>
                {longPeriods > 0 && (
                  <Alert boxed tone="warning" data-testid="stay-too-long">
                    Проживание длиннее {MAX_CHESSBOARD_DAYS} ночей: список свободных ячеек на весь
                    срок не строится. Назначайте и переселяйте с шахматки на нужные даты.
                  </Alert>
                )}
                {periodResults.filter((v, i) => v === null && !tooLong([...periods.values()][i]!))
                  .length > 0 && (
                  <Alert boxed tone="warning">
                    Доступность части периодов не загрузилась. Обновите карточку перед назначением
                    ячейки.
                  </Alert>
                )}
                {ratePlans === null && (
                  <Alert boxed tone="warning" data-testid="rate-plans-missing">
                    Справочник тарифов не загрузился: смена тарифа, «+1 ночь» и смена дат ждут
                    обновления страницы.
                  </Alert>
                )}
                {summary === null && (
                  <Alert boxed tone="warning">
                    Сводка фонда не загрузилась: категории в переселении показаны кодами.
                  </Alert>
                )}
                <ReservationActions
                  number={r.confirmationNumber}
                  status={r.status}
                  source={r.source}
                  notes={r.notes}
                  arrivalDate={r.arrivalDate}
                  departureDate={r.departureDate}
                  currency={r.currency}
                  ratePlans={ratePlans ?? []}
                  items={r.items.map((it) => {
                    const byCategory =
                      availabilityByPeriod.get(`${it.arrivalDate}/${it.departureDate}`)
                        ?.byCategory ?? {};
                    const names = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
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
                      arrivalDate: it.arrivalDate,
                      departureDate: it.departureDate,
                      unitCode: it.unitCode,
                      ratePlanCode: it.ratePlanCode ?? null,
                      // остаток по счёту проживания — для окна «Выселить с долгом» (срез 7.3)
                      debtMinor:
                        finance?.folios.find((f) => f.reservationItemId === it.id)?.balanceMinor ??
                        null,
                      ratePlanName: it.ratePlanName ?? null,
                      adults: it.adults,
                      children: it.children,
                      availableGroups: groups,
                    };
                  })}
                />
              </>
            ),
          },
          {
            id: 'booking-history',
            label: 'История',
            content: (
              <section className="panel">
                <h2 className="section-title">Журнал бронирования</h2>
                <p className="muted">
                  Операции и изменения по бронированию {r.confirmationNumber}.
                </p>
                <Link
                  className="btn btn--secondary"
                  href={`/journal?q=${encodeURIComponent(r.confirmationNumber)}`}
                >
                  <Icon name="journal" />
                  Открыть журнал
                </Link>
              </section>
            ),
          },
        ]}
      />
    </Page>
  );
}
