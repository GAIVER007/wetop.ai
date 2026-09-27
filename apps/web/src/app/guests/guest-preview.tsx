import Link from 'next/link';
import { guestsApi, messengerLinks } from '../../lib/api';
import { notFoundOn404 } from '../../lib/page-error';
import { hotelToday } from '../../lib/hotel-api';
import { Badge, SectionTitle } from '../../components/ui';
import { AmountChip } from '../../components/amount-chip';
import { Icon } from '../../components/icon';
import { displayDate } from '../../lib/display-date';
import { STATE_BADGE } from './guest-state';
import './guests.css';

/**
 * Предпросмотр гостя панелью (G3, ТЗ §17; «долг — сначала в предпросмотре» — владелец 27.09).
 * Быстрый ответ стойке без ухода со списка: кто это, где он сейчас, сколько раз был и должен ли.
 * Документов здесь нет — их показ пишется в журнал и живёт на карточке; «Открыть гостя» ведёт туда.
 */
export async function GuestPreview({ id }: { id: string }) {
  const [g, today] = await Promise.all([
    guestsApi.preview(id).catch(notFoundOn404),
    hotelToday(),
  ]);
  const messengers = messengerLinks(g.phone);
  const badge = STATE_BADGE[g.state];
  const debt = g.hasFolios && BigInt(g.debtMinor) > 0n;
  const openNumber = g.current?.confirmationNumber ?? g.next?.confirmationNumber ?? null;
  const lastWithYear = g.last !== null && g.last.departureDate.slice(0, 4) !== today.slice(0, 4);
  return (
    <div className="guest-preview" data-testid="guest-preview">
      <h2 className="guest-preview__name">
        {g.lastName} {g.firstName} {g.middleName ?? ''}
      </h2>
      <dl className="booking-head guest-head guest-preview__contacts">
        <div>
          <dt>Телефон</dt>
          <dd>
            {g.phone ?? <span className="muted">—</span>}
            {messengers && (
              <span className="booking-head__contacts">
                <a href={messengers.whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <a href={messengers.telegram} target="_blank" rel="noreferrer">
                  Telegram
                </a>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{g.email ?? <span className="muted">—</span>}</dd>
        </div>
      </dl>

      <SectionTitle first>Сейчас</SectionTitle>
      <div className="guest-preview__now" data-testid="guest-preview-now">
        {badge ? <Badge tone={badge.tone}>{badge.word}</Badge> : <span className="muted">—</span>}
        {g.current ? (
          <p>
            {g.current.unitCode && (
              <span className="dir-unit">
                <Icon name="bed" />
                {g.current.unitCode}
              </span>
            )}
            <span className="dir-sub">{g.current.accommodationTypeName}</span>
            <span className="dir-sub">
              до{' '}
              <time dateTime={g.current.departureDate}>{displayDate(g.current.departureDate)}</time>
            </span>
          </p>
        ) : g.next ? (
          <p>
            <span>
              {g.next.arrivalDate < today ? 'заезд был' : 'заезд'}{' '}
              <time dateTime={g.next.arrivalDate}>{displayDate(g.next.arrivalDate)}</time>
            </span>
            <span className="dir-sub">{g.next.accommodationTypeName}</span>
          </p>
        ) : g.lastCancelledAt ? (
          <p>
            <span className="dir-sub">
              бронь на{' '}
              <time dateTime={g.lastCancelledAt}>{displayDate(g.lastCancelledAt)}</time> отменена
            </span>
          </p>
        ) : null}
        {openNumber && (
          <Link className="btn btn--secondary btn--sm" href={`/reservations/${encodeURIComponent(openNumber)}`}>
            Открыть бронь
          </Link>
        )}
      </div>

      <SectionTitle>История</SectionTitle>
      <dl className="guest-preview__facts" data-testid="guest-preview-history">
        <div>
          <dt>Визитов</dt>
          <dd>{g.staysCount}</dd>
        </div>
        <div>
          <dt>Ночей</dt>
          <dd>{g.nightsTotal}</dd>
        </div>
        <div>
          <dt>Последний визит</dt>
          <dd>
            {g.last ? (
              <>
                <time dateTime={g.last.arrivalDate}>
                  {displayDate(g.last.arrivalDate, lastWithYear ? 'numeric' : 'short')}
                </time>
                {' → '}
                <time dateTime={g.last.departureDate}>
                  {displayDate(g.last.departureDate, lastWithYear ? 'numeric' : 'short')}
                </time>
              </>
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
      </dl>

      <SectionTitle>Финансы</SectionTitle>
      <p className="guest-preview__finance" data-testid="guest-preview-finance">
        {!g.hasFolios ? (
          <span className="muted">Счетов пока нет</span>
        ) : debt ? (
          <AmountChip tone="due" minor={g.debtMinor} currency={g.currency} />
        ) : (
          <span className="dir-paid">оплачено</span>
        )}
      </p>

      <div className="guest-preview__actions">
        <Link className="btn btn--secondary" href={`/guests/${encodeURIComponent(g.id)}`}>
          Открыть гостя
        </Link>
        {/* предзаполнение гостя в форме — ступень G6, пока обычная новая бронь */}
        <Link className="btn" href="/reservations/new">
          <Icon name="plus" />
          Новая бронь
        </Link>
      </div>
    </div>
  );
}
