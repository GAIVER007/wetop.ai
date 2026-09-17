import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, channelsApi, type RevisionPage } from '../../../../lib/api';
import { Page } from '../../../../components/page';
import { Icon } from '../../../../components/icon';
import { Badge, StatusBadge } from '../../../../components/ui';
import { AmountChip } from '../../../../components/amount-chip';
import { formatMoney } from '../../../../lib/money';
import { displayPeriod } from '../../../../lib/display-date';
import { RetryEventButton } from '../../buttons';
import {
  EVENT_STATUS_RU,
  EVENT_STATUS_TONE,
  EVENT_TYPE_RU,
  VIA_RU,
  almatyDateTimeFull,
} from '../../format';

/** Сумма канала приходит десятичной строкой («16000.00») — в тиыны без float (ADR-008) */
function decimalToMinor(amount: string): string | null {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return null;
  return `${m[1]}${m[2]}${(m[3] ?? '').padEnd(2, '0')}`;
}
const COLLECT_RU: Record<string, string> = {
  ota: 'предоплата канала',
  property: 'оплата на объекте',
};
const RESERVATION_STATUS_RU: Record<string, string> = {
  TENTATIVE: 'не подтверждена',
  CONFIRMED: 'подтверждена',
  CHECKED_IN: 'заселён',
  CHECKED_OUT: 'выселен',
  CANCELLED: 'отменена',
  NO_SHOW: 'незаезд',
};

/**
 * Приём брони из канала (срез 7.2, макет «Inbound»): цепочка ревизия → бронь → ячейка. Только чтение
 * существующих данных; персональные данные гостя из ревизии наружу не идут (ADR-018) — гость виден
 * в карточке брони по правилам стойки. Сравнение «было → стало» при изменении база не хранит — показываем
 * текущее состояние брони (план 7.2, п. 11).
 */
export default async function RevisionPageView({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const { revisionId } = await params;
  let data: RevisionPage;
  try {
    data = await channelsApi.event(revisionId);
  } catch {
    notFound();
  }
  const summary = await api.inventorySummary().catch(() => null);
  const byCode = new Map((summary?.byCategory ?? []).map((c) => [c.code, c.name]));
  const { event, facts, reservation, balances } = data;
  const categories = [
    ...new Set(
      facts.rooms
        .map((r) => (r.roomTypeId ? data.categoryByRoomType[r.roomTypeId] : null))
        .filter((c): c is string => !!c),
    ),
  ].map((c) => byCode.get(c) ?? c);
  const amountMinor = facts.amount ? decimalToMinor(facts.amount) : null;
  const total = reservation ? BigInt(reservation.totalAmountMinor) : 0n;
  const due = reservation
    ? reservation.items.reduce((s, it) => s + BigInt(balances[it.id] ?? '0'), 0n)
    : 0n;
  // «Оплачено» как стоимость минус остаток не считается: на счёте бывают услуги и штрафы,
  // и разность уезжает в минус. Показываем то, что знаем точно: предоплату канала из самой ревизии.
  const prepaid = amountMinor !== null && facts.paymentCollect === 'ota' ? amountMinor : null;
  const guests =
    facts.adults !== null
      ? `${facts.adults} взр.${facts.children ? `, ${facts.children} дет.` : ''}`
      : '—';
  return (
    <Page
      width="wide"
      title="Приём брони из канала"
      subtitle="Входящая ревизия → бронь → назначенная койка, время объекта (Алматы)"
      crumbs={<Link href="/channels">← каналы продаж</Link>}
    >
      <div className="chain" data-testid="revision-chain">
        <section className="chain__card" aria-labelledby="chain-revision">
          <h2 id="chain-revision" className="chain__title">
            1. Ревизия Channex
          </h2>
          <div className="row row--inline">
            <Badge tone="info">{EVENT_TYPE_RU[event.type] ?? event.type}</Badge>
            <Badge>{VIA_RU[event.receivedVia ?? 'PULL'] ?? event.receivedVia}</Badge>
            <Badge
              tone={EVENT_STATUS_TONE[event.status] ?? 'neutral'}
              data-testid="revision-status"
            >
              {EVENT_STATUS_RU[event.status] ?? event.status}
            </Badge>
          </div>
          <div>
            {facts.otaName ?? 'канал не назван'}, получено {almatyDateTimeFull(event.receivedAt)}
          </div>
          <div className="muted mono">
            unique_id {facts.uniqueId ?? '—'}, ревизия {event.externalEventId}
          </div>
          <dl className="facts facts--list">
            <div>
              <dt className="fact__label">Категория</dt>
              <dd className="fact__value">{categories.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="fact__label">Даты</dt>
              <dd className="fact__value">
                {facts.arrivalDate && facts.departureDate
                  ? displayPeriod(facts.arrivalDate, facts.departureDate)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="fact__label">Гостей</dt>
              <dd className="fact__value">{guests}</dd>
            </div>
            <div>
              <dt className="fact__label">Оплата</dt>
              <dd className="fact__value" data-testid="revision-amount">
                {facts.paymentCollect
                  ? `${COLLECT_RU[facts.paymentCollect] ?? facts.paymentCollect} `
                  : ''}
                {amountMinor
                  ? formatMoney(amountMinor, facts.currency ?? 'KZT')
                  : (facts.amount ?? '—')}
              </dd>
            </div>
          </dl>
          {event.status === 'FAILED' && (
            <div className="callout callout--warn">
              <Icon name="incidents" width={16} height={16} />
              <span>{event.lastError ?? 'ревизия не обработана'}</span>
              <RetryEventButton revisionId={event.externalEventId} />
            </div>
          )}
        </section>
        <div className="chain__arrow" aria-hidden="true">
          <Icon name="chevron" />
        </div>
        <section className="chain__card" aria-labelledby="chain-reservation">
          <h2 id="chain-reservation" className="chain__title">
            2. Бронь в PMS
          </h2>
          {reservation ? (
            <>
              <div className="row row--inline">
                <StatusBadge
                  status={reservation.status}
                  label={RESERVATION_STATUS_RU[reservation.status] ?? reservation.status}
                />
                <Link
                  href={`/reservations/${encodeURIComponent(reservation.confirmationNumber)}`}
                  className="bold"
                  data-testid="revision-reservation"
                >
                  {reservation.confirmationNumber}
                </Link>
              </div>
              <div>
                {displayPeriod(reservation.arrivalDate, reservation.departureDate)}, счёт{' '}
                {due > 0n ? 'открыт' : 'закрыт'}
              </div>
              <dl className="facts facts--list">
                <div>
                  <dt className="fact__label">Стоимость</dt>
                  <dd className="fact__value">{formatMoney(total, reservation.currency)}</dd>
                </div>
                <div>
                  <dt className="fact__label">Предоплата канала</dt>
                  <dd className="fact__value">
                    {prepaid ? formatMoney(prepaid, facts.currency ?? reservation.currency) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="fact__label">К оплате</dt>
                  <dd className="fact__value" data-testid="revision-due">
                    {formatMoney(due, reservation.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="fact__label">Источник</dt>
                  <dd className="fact__value">{reservation.channel ?? reservation.source}</dd>
                </div>
              </dl>
              {due > 0n ? (
                <AmountChip minor={due.toString()} tone="due" currency={reservation.currency} />
              ) : prepaid ? (
                <AmountChip
                  minor={prepaid}
                  tone="paid"
                  label="предоплата канала"
                  currency={facts.currency ?? reservation.currency}
                />
              ) : (
                <AmountChip minor="0" tone="paid" currency={reservation.currency} />
              )}
            </>
          ) : (
            <p className="muted" data-testid="revision-no-reservation">
              {event.status === 'FAILED'
                ? 'Бронь не создана: ревизия не обработана. Исправьте причину слева и нажмите «Обработать заново».'
                : `Бронь по unique_id ${facts.uniqueId ?? '—'} не найдена.`}
            </p>
          )}
        </section>
        <div className="chain__arrow" aria-hidden="true">
          <Icon name="chevron" />
        </div>
        <section className="chain__card" aria-labelledby="chain-unit">
          <h2 id="chain-unit" className="chain__title">
            3. Ячейка на шахматке
          </h2>
          {reservation?.items.length ? (
            reservation.items.map((it) => (
              <div key={it.id} className="stack stack--sm" data-testid="revision-unit">
                <div className="row row--inline">
                  <Badge tone={it.unitCode ? 'ok' : 'warn'}>
                    {it.unitCode ? `${it.unitCode}, ${it.accommodationTypeName}` : 'без ячейки'}
                  </Badge>
                  <StatusBadge
                    status={it.status}
                    label={RESERVATION_STATUS_RU[it.status] ?? it.status}
                  />
                </div>
                <div>{displayPeriod(it.arrivalDate, it.departureDate)}</div>
                <div className="muted">
                  {it.unitCode
                    ? 'назначена автоматически: первая свободная в категории (Q-094)'
                    : 'место не назначено — на шахматке в строке «Без ячейки»'}
                </div>
                <Link
                  href={`/chessboard?from=${it.arrivalDate}&to=${it.departureDate}`}
                  className="btn btn--secondary btn--sm"
                >
                  Открыть шахматку на эти даты
                </Link>
              </div>
            ))
          ) : (
            <p className="muted">Проживаний нет — ячейка появится после создания брони.</p>
          )}
        </section>
      </div>
    </Page>
  );
}
