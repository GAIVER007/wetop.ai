import { requireFeature } from '../../../lib/vertical-guard';
import Link from 'next/link';
import { Tabs } from '../../../components/tabs';
import { hotelToday } from '../../../lib/hotel-api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { Icon } from '../../../components/icon';
import { notFoundOn404 } from '../../../lib/page-error';
import { api, chessboardApi, financeApi, messengerLinks, reservationsApi } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { displayDate } from '../../../lib/display-date';
import { MAX_CHESSBOARD_DAYS } from '@pms/domain';
import { nightsBetween } from '../../../lib/plural';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { currentLocale, serverT } from '../../../i18n/server';
import { Page, BackCrumb } from '../../../components/page';
import { Alert, SectionTitle, StatusBadge, Table } from '../../../components/ui';
import { ReservationActions } from './actions-panel';
import { FinancePanel } from './finance-panel';
import { PaymentRequestsPanel } from './payment-requests';
import { maskPhone } from './phone-mask';
import { OpenFullCard } from './open-full-card';
import { BookingGuestEditor } from './guest-editor';
import { bookingGuestEditable } from './guest-editor-access';
import { FinanceLine } from '../finance-line';
import '../../directory.css';
import { sourceStatus } from '../../../lib/status/source';
import { statusLabel } from '../../../lib/status/types';
import { formatPhone } from '../../../lib/phone';

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
  // раздел направления по реестру функций (У1): по прямой ссылке чужое направление уходит на свою стартовую
  await requireFeature('/reservations');
  const t = await serverT();
  const locale = await currentLocale();
  const il = intlLocale(locale);
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
  const canMutate = mayAccess(desk.access, 'desk') && !desk.readOnly;
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
    ['print-ru', '?lang=ru', msg('Регистрационная карта RU')],
    ['print-kz', '?lang=kz', msg('Регистрационная карта KZ')],
    ['print-contract-ru', '/contract?lang=ru', msg('Договор RU')],
    ['print-contract-kz', '/contract?lang=kz', msg('Договор KZ')],
    ['print-invoice-ru', '/invoice?lang=ru', msg('Счёт RU')],
    ['print-invoice-kz', '/invoice?lang=kz', msg('Счёт KZ')],
  ];
  return (
    <Page
      embedded={preview}
      width="medium"
      crumbs={<BackCrumb href="/reservations">{t('Брони')}</BackCrumb>}
      title={t('Бронь {number}', { number: r.confirmationNumber })}
      actions={
        preview ? (
          <OpenFullCard href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`} />
        ) : undefined
      }
      subtitle={
        <>
          <StatusBadge kind="hospitality" value={r.status} />{' '}
          <span>
            {t(statusLabel(sourceStatus, r.source))}
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
          <dt>{t('Гость')}</dt>
          <dd>
            {r.primaryGuest ? (
              <Link href={`/guests/${r.primaryGuest.id}`} data-testid="guest-link">
                {r.primaryGuest.label}
              </Link>
            ) : (
              t('Гость без имени')
            )}
            {r.primaryGuest && !desk.access.restricted && !desk.access.unknown && (
              <BookingGuestEditor key={`${desk.scopeKey}:${r.primaryGuest.id}:${canMutate}`}
                id={r.primaryGuest.id} scopeKey={desk.scopeKey ?? ''}
                canEdit={canMutate && bookingGuestEditable(desk)} piiStorage={piiStorage} />
            )}
            {r.primaryGuest && (
              <span
                className={
                  r.primaryGuest.citizenship ? 'booking-head__sub' : 'booking-head__sub warn-text'
                }
              >
                {r.primaryGuest.citizenship
                  ? t('гражданство {country}', { country: r.primaryGuest.citizenship })
                  : t('гражданство не указано')}
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
                      <a href={`tel:${r.primaryGuest.phone}`}>{t('Позвонить')}</a>
                    </>
                  ) : (
                    <a href={`tel:${r.primaryGuest.phone}`}>{formatPhone(r.primaryGuest.phone)}</a>
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
          <dt>{t('Даты')}</dt>
          <dd>
            <time dateTime={r.arrivalDate}>{displayDate(r.arrivalDate, 'numeric')}</time>
            {' → '}
            <time dateTime={r.departureDate}>{displayDate(r.departureDate, 'numeric')}</time>
            {nights > 0 && <small>{countLabel(locale, t, nights, [msg('ночь'), 'ночи', msg('ночей')]) /* kk-allow: форма склонения */}</small>}
          </dd>
        </div>
        <div>
          <dt>{t('Место')}</dt>
          <dd className="mono" data-testid="booking-place">
            {unitCodes.length ? (
              unitCodes.join(', ')
            ) : liveItems.length === 0 ? (
              <span className="muted">—</span>
            ) : liveItems.every((it) => it.status === 'CHECKED_OUT') ? (
              // выезд в день заезда снимает назначение целиком (API удаляет его): номер не хранится, тревоги нет
              <span className="muted">{t('освобождён при выезде')}</span>
            ) : (
              <span className="warn-text">{t('номер не назначен')}</span>
            )}
            {/* у группы — числом, как в списке (формулировка владельца 27.09) */}
            {unassigned > 0 && liveItems.length > 1 && (
              <small className="warn-text">{t('⚠ {n} без размещения', { n: unassigned })}</small>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('Гостей')}</dt>
          <dd>
            {r.adults}
            {r.children ? t(' + {n} дет.', { n: r.children }) : ''}
          </dd>
        </div>
        <div>
          <dt>{t('Стоимость')}</dt>
          <dd>{formatMoney(r.totalAmountMinor, r.currency)}</dd>
        </div>
        <div>
          {/* слова колонки «Финансы» списка: у отменённой брони с деньгами к возврату нет «оплачено» */}
          <dt>{t('Оплата')}</dt>
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
              <span className="muted">{t('Финансы временно недоступны')}</span>
            )}
          </dd>
        </div>
      </dl>
      <Tabs
        label={t('Разделы карточки брони')}
        panels={[
          {
            id: 'booking-overview',
            label: t('Обзор'),
            content: (
              <div id="booking-overview">
                {r.status === 'TENTATIVE' && (
                  // срез 7.3, Д4: «не подтверждена» словом и цветом внимания, не только бейджем
                  <Alert boxed tone="warning" data-testid="tentative-callout">
                    {t('Бронь не подтверждена: канал прислал предварительный статус, и подтверждение приходит оттуда же. Место за ней держится и второй раз не продаётся.')}
                  </Alert>
                )}
                {/* Следующее действие смены — первым; ссылки на вкладки ловят вкладки (Tabs) (без записи в историю) */}
                <div className="booking-next" data-testid="booking-next">
                  <a
                    href="#booking-finance"
                    className={due !== null && due > 0n ? 'btn' : 'btn btn--secondary'}
                  >
                    <Icon name="money" />
                    {t('Принять оплату')}
                  </a>
                  <a href="#booking-actions" className="btn btn--secondary">
                    <Icon name="clock" />
                    {t('Продлить или переселить')}
                  </a>
                </div>
                <SectionTitle first id="booking-stays">
                  {t('Проживания')}
                </SectionTitle>
                {/* В панели 480 px и на телефоне строка складывается в карточку (CSS .dir-table--stays), разметка та же */}
                <Table className="dir-table dir-table--stays" data-testid="stays-table">
                  <thead>
                    <tr>
                      {[msg('Номер'), msg('Категория'), msg('Заезд'), msg('Выезд'), msg('Статус'), msg('Цена'), msg('Гости')].map(
                        (h) => (
                          <th key={h} className={h === 'Цена' /* kk-allow: сверка с ключом колонки */ ? 'num' : undefined}>
                            {t(h)}
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
                          <time dateTime={it.arrivalDate}>{displayDate(it.arrivalDate, 'short', il)}</time>
                        </td>
                        <td className="nowrap">
                          <time dateTime={it.departureDate}>{displayDate(it.departureDate, 'short', il)}</time>
                        </td>
                        <td>
                          <StatusBadge kind="hospitality" value={it.status} />
                        </td>
                        <td className="num">{formatMoney(it.priceMinor, r.currency)}</td>
                        <td>
                          {it.guests.map((g) => g.label).join(', ') || '—'}
                          <span className="hint" data-testid="stay-guests-count">
                            {' '}
                            · {it.adults}
                            {it.children ? t(' + {n} дет.', { n: it.children }) : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {r.notes && (
                  <p className="note note--lg" data-testid="reservation-notes">
                    <b>{t('Заметки:')}</b> {r.notes}
                  </p>
                )}
                {preview && (
                  // §19: итог по счетам в первом экране панели; подробности — вкладка «Счета»
                  <>
                    <SectionTitle id="booking-money">{t('Финансы')}</SectionTitle>
                    <dl className="booking-money" data-testid="preview-finance">
                      {finance ? (
                        <>
                          <div>
                            <dt>{t('Итого')}</dt>
                            <dd className="num">{formatMoney(finance.chargedMinor, r.currency)}</dd>
                          </div>
                          <div>
                            <dt>{t('Оплачено')}</dt>
                            <dd className="num">{formatMoney(finance.paidMinor, r.currency)}</dd>
                          </div>
                          <div>
                            <dt>{t('Возвращено')}</dt>
                            <dd className="num">
                              {formatMoney(finance.refundedMinor, r.currency)}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <div>
                          <dt>{t('Финансы')}</dt>
                          <dd className="muted">{t('временно недоступны')}</dd>
                        </div>
                      )}
                    </dl>
                  </>
                )}
                <nav className="booking-print" aria-label={t('Печатные формы')}>
                  <span className="booking-print__label">{t('Печать')}</span>
                  {printLinks.map(([id, path, label]) => (
                    <Link
                      key={id}
                      className="btn btn--secondary btn--sm"
                      href={print(path)}
                      data-testid={id}
                    >
                      {t(label)}
                    </Link>
                  ))}
                </nav>
              </div>
            ),
          },
          {
            id: 'booking-finance',
            label: t('Счета'),
            content: (
              <>
                <SectionTitle id="booking-finance">{t('Счета')}</SectionTitle>
                {finance && services ? (
                  <>
                    {/* оплата одним шагом первой; запросы оплаты (§24) ниже, свёрнутыми (план 07.10.2026, У8) */}
                    <FinancePanel
                      number={r.confirmationNumber}
                      finance={finance}
                      services={services}
                      today={today}
                      canMutate={canMutate}
                    />
                    <PaymentRequestsPanel
                      number={r.confirmationNumber}
                      propertyName={paymentRequests?.propertyName ?? ''}
                      paymentMethods={finance?.paymentMethods}
                      requests={paymentRequests?.requests ?? null}
                      folios={finance.folios}
                      canMutate={canMutate}
                    />
                  </>
                ) : (
                  <Alert boxed>
                    {t('Не удалось загрузить счета или каталог услуг. Финансовые действия недоступны до обновления.')}{' '}
                    <Link href={`/reservations/${encodeURIComponent(r.confirmationNumber)}`}>
                      {t('Повторить загрузку')}
                    </Link>
                  </Alert>
                )}
              </>
            ),
          },
          {
            id: 'booking-actions',
            label: t('Действия'),
            content: (
              <>
                <SectionTitle id="booking-actions">{t('Действия с бронированием')}</SectionTitle>
                {longPeriods > 0 && (
                  <Alert boxed tone="warning" data-testid="stay-too-long">
                    {t('Проживание длиннее {n} ночей: список свободных номеров на весь срок не строится. Назначайте и переселяйте из календаря на нужные даты.', { n: MAX_CHESSBOARD_DAYS })}
                  </Alert>
                )}
                {periodResults.filter((v, i) => v === null && !tooLong([...periods.values()][i]!))
                  .length > 0 && (
                  <Alert boxed tone="warning">
                    {t('Доступность части периодов не загрузилась. Обновите карточку перед назначением номера.')}
                  </Alert>
                )}
                {ratePlans === null && (
                  <Alert boxed tone="warning" data-testid="rate-plans-missing">
                    {t('Справочник тарифов не загрузился: смена тарифа, «+1 ночь» и смена дат ждут обновления страницы.')}
                  </Alert>
                )}
                {summary === null && (
                  <Alert boxed tone="warning">
                    {t('Сводка фонда не загрузилась: категории в переселении показаны кодами.')}
                  </Alert>
                )}
                {canMutate && <ReservationActions
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
                />}
              </>
            ),
          },
          {
            id: 'booking-history',
            label: t('История'),
            content: (
              <section className="panel">
                <h2 className="section-title">{t('Журнал бронирования')}</h2>
                <p className="muted">
                  {t('Операции и изменения по бронированию {number}.', { number: r.confirmationNumber })}
                </p>
                {mayAccess(desk.access, 'journal') ? (
                  <Link
                    className="btn btn--secondary"
                    href={`/journal?q=${encodeURIComponent(r.confirmationNumber)}`}
                  >
                    <Icon name="journal" />
                    {t('Открыть журнал')}
                  </Link>
                ) : (
                  <p className="muted" data-testid="journal-closed">
                    {t('Журнал действий открыт владельцу и управляющему.')}
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
