import Link from 'next/link';
import { RecordTabs } from '../../../components/record-tabs';
import { hotelToday } from '../../../lib/hotel-api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { Icon } from '../../../components/icon';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, chessboardApi, financeApi, messengerLinks, reservationsApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { nightsBetween, pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { Alert, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { ReservationActions } from './actions-panel';
import { FinancePanel } from './finance-panel';
import { PaymentRequestsPanel } from './payment-requests';
import { maskPhone } from './phone-mask';
import { OpenFullCard } from './open-full-card';
import { FinanceLine } from '../finance-line';
import '../../directory.css';

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

/**
 * Карточка брони + действия стойки (шаг 3.5): даты, отмена, назначение/переселение.
 * B3 (план владельца 19.09): сверху — гость, даты, место, гостей, стоимость и остаток к оплате одной
 * полосой над вкладками; в «Обзоре» первыми — следующие действия смены; печатные формы — внизу обзора.
 */
export default async function ReservationPage({
  params,
  preview = false,
}: {
  params: Promise<{ number: string }>;
  /**
   * Быстрый просмотр в панели над списком (ADR-106, R3): телефон скрытыми цифрами, «Финансы» в «Обзоре»,
   * «Открыть бронь» — на полную страницу. Полная страница — без этого флага, как была.
   */
  preview?: boolean;
}) {
  const { number } = await params;
  const r = await chessboardApi.reservation(decodeURIComponent(number)).catch(notFoundOn404);
  const today = await hotelToday();
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
  // журнал — владельцу и управляющему (ADR-107): администратору ссылки туда не даём; тот же `/auth/me`, что у меню
  const access = deskShell();
  const [ratePlans, finance, services, summary, periodResults, piiStorage, paymentRequests] =
    await Promise.all([
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
      // Q-169: подсказка у заметки зависит от того, где лежит база (ADR-072)
      api.piiStorage(),
      // запросы оплаты (DATA_MODEL §24, ADR-144): отказ гасит только свой блок
      financeApi.paymentRequests(r.confirmationNumber).catch(() => null),
    ]);
  const desk = await access;
  const availabilityByPeriod = new Map(
    [...periods.keys()].map((key, i) => [key, periodResults[i]]),
  );
  const print = (path: string) =>
    `/reservations/${encodeURIComponent(r.confirmationNumber)}/print${path}`;
  const guestMessengers = messengerLinks(r.primaryGuest?.phone);
  // Полоса сверху: место — по живым проживаниям (отменённые и незаезд места не занимают)
  const nights = nightsBetween(r.arrivalDate, r.departureDate);
  const liveItems = r.items.filter((it) => it.status !== 'CANCELLED' && it.status !== 'NO_SHOW');
  const unitCodes = [...new Set(liveItems.map((it) => it.unitCode).filter(Boolean))] as string[];
  const unassigned = liveItems.filter((it) => !it.unitCode).length;
  const due = finance ? BigInt(finance.balanceMinor) : null;
  const printLinks: Array<[string, string, string]> = [
    ['print-ru', '?lang=ru', 'Регистрационная карта RU'],
    ['print-kz', '?lang=kz', 'Регистрационная карта KZ'],
    ['print-contract-ru', '/contract?lang=ru', 'Договор RU'],
    ['print-contract-kz', '/contract?lang=kz', 'Договор KZ'],
    ['print-invoice-ru', '/invoice?lang=ru', 'Счёт RU'],
    ['print-invoice-kz', '/invoice?lang=kz', 'Счёт KZ'],
  ];
  return (
    <Page
      width="medium"
      crumbs={<Link href="/chessboard">← календарь</Link>}
      title={`Бронь ${r.confirmationNumber}`}
      actions={
        preview ? (
          <OpenFullCard href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`} />
        ) : undefined
      }
      subtitle={
        <>
          <StatusBadge status={r.status} label={STATUS_RU[r.status] ?? r.status} />{' '}
          <span>
            {SOURCE_RU[r.source] ?? r.source}
            {r.channel ? `, ${r.channel}` : ''}
          </span>
        </>
      }
    >
      {/*
       * Гость, даты, место, гостей, стоимость и остаток — то, что смена ищет первым, поэтому полоса стоит
       * над вкладками и видна из любой из них. Факты, а не показатели: «подпись — значение» (§14).
       */}
      <dl className="booking-head" data-testid="booking-head">
        <div className="booking-head__guest">
          <dt>Гость</dt>
          <dd>
            {r.primaryGuest ? (
              <Link href={`/guests/${r.primaryGuest.id}`} data-testid="guest-link">
                {r.primaryGuest.label}
              </Link>
            ) : (
              'Гость без имени'
            )}
            {r.primaryGuest && (
              <span
                className={
                  r.primaryGuest.citizenship ? 'booking-head__sub' : 'booking-head__sub warn-text'
                }
              >
                {r.primaryGuest.citizenship
                  ? `гражданство ${r.primaryGuest.citizenship}`
                  : 'гражданство не указано'}
              </span>
            )}
            {(r.primaryGuest?.phone || guestMessengers) && (
              <span className="booking-head__contacts">
                {/* в просмотре номер скрыт (§11, §19): позвонить и написать — кнопками */}
                {r.primaryGuest?.phone &&
                  (preview ? (
                    <>
                      <span className="mono" data-testid="guest-phone">
                        {maskPhone(r.primaryGuest.phone)}
                      </span>
                      <a href={`tel:${r.primaryGuest.phone}`}>Позвонить</a>
                    </>
                  ) : (
                    <a href={`tel:${r.primaryGuest.phone}`}>{r.primaryGuest.phone}</a>
                  ))}
                {guestMessengers && (
                  <>
                    <a href={guestMessengers.whatsapp} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                    <a href={guestMessengers.telegram} target="_blank" rel="noreferrer">
                      Telegram
                    </a>
                  </>
                )}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Даты</dt>
          <dd>
            <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate, 'numeric')}</time>
            {' → '}
            <time dateTime={r.departureDate}>{displayDate(r.departureDate, 'numeric')}</time>
            {nights > 0 && <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>}
          </dd>
        </div>
        <div>
          <dt>Место</dt>
          <dd className="mono" data-testid="booking-place">
            {unitCodes.length ? unitCodes.join(', ') : <span className="warn-text">—</span>}
            {/* у группы — числом, как в списке (формулировка владельца 27.09) */}
            {unassigned > 0 && liveItems.length > 1 && (
              <small className="warn-text">⚠ {unassigned} без размещения</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Гостей</dt>
          <dd>
            {r.adults}
            {r.children ? ` + ${r.children} дет.` : ''}
          </dd>
        </div>
        <div>
          <dt>Стоимость</dt>
          <dd>{formatMoney(r.totalAmountMinor, r.currency)}</dd>
        </div>
        <div>
          {/* слова колонки «Финансы» списка: у отменённой брони с деньгами к возврату нет «оплачено» */}
          <dt>Оплата</dt>
          <dd data-testid="booking-due">
            {finance ? (
              <FinanceLine
                row={{
                  hasFolios: finance.folios.length > 0,
                  chargedMinor: finance.chargedMinor,
                  paidMinor: finance.paidMinor,
                  refundedMinor: finance.refundedMinor,
                  balanceMinor: finance.balanceMinor,
                  currency: r.currency,
                }}
              />
            ) : (
              <span className="muted">Финансы временно недоступны</span>
            )}
          </dd>
        </div>
      </dl>
      <RecordTabs
        label="Разделы карточки брони"
        tabs={[
          {
            id: 'booking-overview',
            label: 'Обзор',
            content: (
              <div id="booking-overview">
                {r.status === 'TENTATIVE' && (
                  // срез 7.3, Д4: «не подтверждена» словом и цветом внимания, не только бейджем
                  <Alert boxed tone="warning" data-testid="tentative-callout">
                    Бронь не подтверждена: канал прислал предварительный статус, и подтверждение
                    приходит оттуда же. Место за ней держится и второй раз не продаётся.
                  </Alert>
                )}
                {/* Следующее действие смены — первым; ссылки на вкладки ловит RecordTabs (без записи в историю) */}
                <div className="booking-next" data-testid="booking-next">
                  <a
                    href="#booking-finance"
                    className={due !== null && due > 0n ? 'btn' : 'btn btn--secondary'}
                  >
                    <Icon name="money" />
                    Принять оплату
                  </a>
                  <a href="#booking-actions" className="btn btn--secondary">
                    <Icon name="clock" />
                    Продлить или переселить
                  </a>
                </div>
                <SectionTitle first id="booking-stays">
                  Проживания
                </SectionTitle>
                {/* В панели 480 px и на телефоне строка складывается в карточку (CSS .dir-table--stays), разметка та же */}
                <Table className="dir-table dir-table--stays" data-testid="stays-table">
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
                {preview && (
                  // §19: итог по счетам в первом экране панели; подробности — вкладка «Счета»
                  <>
                    <SectionTitle id="booking-money">Финансы</SectionTitle>
                    <dl className="booking-money" data-testid="preview-finance">
                      {finance ? (
                        <>
                          <div>
                            <dt>Итого</dt>
                            <dd className="num">{formatMoney(finance.chargedMinor, r.currency)}</dd>
                          </div>
                          <div>
                            <dt>Оплачено</dt>
                            <dd className="num">{formatMoney(finance.paidMinor, r.currency)}</dd>
                          </div>
                          <div>
                            <dt>Возвращено</dt>
                            <dd className="num">
                              {formatMoney(finance.refundedMinor, r.currency)}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <div>
                          <dt>Финансы</dt>
                          <dd className="muted">временно недоступны</dd>
                        </div>
                      )}
                    </dl>
                  </>
                )}
                <nav className="booking-print" aria-label="Печатные формы">
                  <span className="booking-print__label">Печать</span>
                  {printLinks.map(([id, path, label]) => (
                    <Link
                      key={id}
                      className="btn btn--secondary btn--sm"
                      href={print(path)}
                      data-testid={id}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            ),
          },
          {
            id: 'booking-finance',
            label: 'Счета',
            content: (
              <>
                <SectionTitle id="booking-finance">Счета</SectionTitle>
                {finance && services ? (
                  <>
                    {/* оплата одним шагом первой; запросы оплаты (§24) ниже, свёрнутыми (план 07.10.2026, У8) */}
                    <FinancePanel
                      number={r.confirmationNumber}
                      finance={finance}
                      services={services}
                      today={today}
                    />
                    <PaymentRequestsPanel
                      number={r.confirmationNumber}
                      propertyName={paymentRequests?.propertyName ?? ''}
                      requests={paymentRequests?.requests ?? null}
                      folios={finance.folios}
                    />
                  </>
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
                    срок не строится. Назначайте и переселяйте из календаря на нужные даты.
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
                  piiStorage={piiStorage}
                  channel={r.channel}
                  externalId={r.externalId ?? null}
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
                      unitHousekeepingStatus: it.unitHousekeepingStatus ?? null,
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
                {mayAccess(desk.access, 'journal') ? (
                  <Link
                    className="btn btn--secondary"
                    href={`/journal?q=${encodeURIComponent(r.confirmationNumber)}`}
                  >
                    <Icon name="journal" />
                    Открыть журнал
                  </Link>
                ) : (
                  <p className="muted" data-testid="journal-closed">
                    Журнал действий открыт владельцу и управляющему.
                  </p>
                )}
              </section>
            ),
          },
        ]}
      />
    </Page>
  );
}
