import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import type { ReactNode } from 'react';
import { guestsApi, type GuestPreview } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { sourceLabel } from '../../lib/dashboard-format';
import { displayDate } from '../../lib/display-date';
import { hotelToday } from '../../lib/hotel-api';
import { messengerLinks } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Icon } from '../../components/icon';
import { Tabs } from '../../components/tabs';
import { Badge, EmptyState, StatusBadge } from '../../components/ui';
import { CopyButton } from './copy-button';
import {
  guestNote,
  initials,
  stayActions,
  stayPayment,
  stayStatus,
  visitsWord,
} from './guest-stay';

/**
 * Панель выбранного гостя рядом с таблицей «Гостей и бронирований» (план guests-bookings-2026-10-09): кто это, где он
 * сейчас, сколько должен, что делать дальше. Данные те же, что у шторки предпросмотра (`/guests/:id/preview`): документов
 * здесь нет, их показ пишется в журнал и живёт на карточке гостя. Действия это переходы в карточку брони на нужную
 * вкладку, где подтверждения сумм уже есть; «только чтение» (ADR-102) их не рисует.
 */
export async function GuestPanel({
  id,
  closeHref,
}: {
  id: string;
  /** ссылка закрытия: тот же список с `guest=none` */
  closeHref: string;
}) {
  const [loaded, today, { readOnly }] = await Promise.all([
    guestsApi.preview(id).then(
      (guest) => ({ ok: true as const, guest }),
      (error: unknown) => {
        unstable_rethrow(error);
        return { ok: false as const, error };
      },
    ),
    hotelToday(),
    deskShell(),
  ]);
  if (!loaded.ok)
    return (
      <div className="gb-panel__card" data-testid="guest-panel-error">
        <EmptyState
          icon={<Icon name="guests" />}
          title="Гость не открылся"
          actions={
            <Link className="btn btn--secondary" href={closeHref}>
              Закрыть
            </Link>
          }
        >
          Гостя нет в базе организации или сервер не ответил. Выберите другого гостя в списке.
        </EmptyState>
      </div>
    );
  const g = loaded.guest;
  const stay = g.stay;
  const actions = readOnly ? null : stayActions(stay);
  const messengers = messengerLinks(g.phone);
  const status = stayStatus(g, today);
  const name = `${g.lastName} ${g.firstName} ${g.middleName ?? ''}`.trim();
  const payment = stayPayment(stay);
  const currency = stay?.currency ?? g.currency;
  const visitsShown = g.visits.slice(0, 3);
  const yearOf = (date: string) => date.slice(0, 4) !== today.slice(0, 4);
  // даты проживания с годом, когда оно не целиком в текущем году: иначе «7 окт. → 12 окт.» двусмысленно
  const stayStyle = stay && (yearOf(stay.arrivalDate) || yearOf(stay.departureDate)) ? 'numeric' : 'short';

  const info = (
    <div className="gb-panel__body">
      <PanelSection title="Контакты" action={{ href: `/guests/${encodeURIComponent(g.id)}`, label: 'Изменить' }}>
        <ul className="gb-contact-list">
          <li>
            <Icon name="phone" width={16} height={16} />
            <span>{g.phone ?? <span className="muted">нет телефона</span>}</span>
            {g.phone && <CopyButton text={g.phone} what="телефон" />}
          </li>
          <li>
            <Icon name="mail" width={16} height={16} />
            <span>{g.email ?? <span className="muted">нет почты</span>}</span>
            {g.email && <CopyButton text={g.email} what="почту" />}
          </li>
          {messengers && (
            <li>
              <Icon name="chat" width={16} height={16} />
              <a href={messengers.whatsapp} target="_blank" rel="noreferrer">
                Написать в WhatsApp
              </a>
            </li>
          )}
        </ul>
      </PanelSection>

      <PanelSection
        title="Бронь"
        action={
          stay?.confirmationNumber
            ? { href: `/reservations/${encodeURIComponent(stay.confirmationNumber)}`, label: 'Открыть' }
            : undefined
        }
      >
        {stay ? (
          <dl className="gb-facts" data-testid="guest-panel-stay">
            <div>
              <dt>Номер брони</dt>
              <dd>
                {stay.confirmationNumber ? (
                  <Link href={`/reservations/${encodeURIComponent(stay.confirmationNumber)}`} prefetch={false}>
                    #{stay.confirmationNumber}
                  </Link>
                ) : (
                  '–'
                )}
              </dd>
            </div>
            <div>
              <dt>Номер и категория</dt>
              <dd>
                {stay.unitCode ? <strong>{stay.unitCode}</strong> : <span className="warn-text">не назначена</span>}{' '}
                <span className="muted">{stay.accommodationTypeName}</span>
              </dd>
            </div>
            <div>
              <dt>Даты проживания</dt>
              <dd>
                <time dateTime={stay.arrivalDate}>{displayDate(stay.arrivalDate, stayStyle)}</time>
                {' → '}
                <time dateTime={stay.departureDate}>{displayDate(stay.departureDate, stayStyle)}</time>{' '}
                <span className="muted">({pluralRu(stay.nights, ['ночь', 'ночи', 'ночей'])})</span>
              </dd>
            </div>
            <div>
              <dt>Количество гостей</dt>
              <dd>
                {pluralRu(stay.adults, ['взрослый', 'взрослых', 'взрослых'])}
                {stay.children > 0 && `, ${pluralRu(stay.children, ['ребёнок', 'ребёнка', 'детей'])}`}
              </dd>
            </div>
            <div>
              <dt>Источник</dt>
              <dd>{sourceLabel(stay.source, stay.channel)}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted" data-testid="guest-panel-nostay">
            {g.lastCancelledAt
              ? `Бронь на ${displayDate(g.lastCancelledAt)} отменена, других проживаний нет.`
              : 'Проживаний нет: гость появится здесь после брони.'}
          </p>
        )}
      </PanelSection>

      {stay && (
        <PanelSection
          title="Оплата"
          action={actions?.service ? { href: actions.service, label: 'Счёт' } : undefined}
        >
          {stay.money ? (
            <div data-testid="guest-panel-payment">
              {payment && (
                <p className="gb-panel__pay">
                  <StatusBadge kind="payment" value={payment.state} />
                </p>
              )}
              <dl className="gb-facts">
                <div>
                  <dt>Общая сумма</dt>
                  <dd className="num">{formatMoney(stay.money.chargedMinor, currency)}</dd>
                </div>
                <div>
                  <dt>Оплачено</dt>
                  <dd className="num">{formatMoney(stay.money.paidMinor, currency)}</dd>
                </div>
                <div>
                  <dt>Долг</dt>
                  <dd className={BigInt(stay.money.balanceMinor) > 0n ? 'num warn-text' : 'num'}>
                    {formatMoney(BigInt(stay.money.balanceMinor) > 0n ? stay.money.balanceMinor : '0', currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="muted" data-testid="guest-panel-payment">
              Счёта по проживанию нет.
            </p>
          )}
        </PanelSection>
      )}

      <PanelSection
        title="История проживания"
        action={g.visits.length > 3 || g.staysCount > 3 ? { href: '#history', label: `Все визиты (${g.staysCount})` } : undefined}
      >
        {visitsShown.length ? (
          <ul className="gb-visits" data-testid="guest-panel-visits">
            {visitsShown.map((v) => (
              <li key={`${v.confirmationNumber}-${v.arrivalDate}`}>
                <time dateTime={v.arrivalDate}>{displayDate(v.arrivalDate, yearOf(v.arrivalDate) ? 'numeric' : 'short')}</time>
                <span>
                  <strong>{v.unitCode ?? '–'}</strong> <span className="muted">{v.accommodationTypeName}</span>
                </span>
                <span className="muted">{pluralRu(v.nights, ['ночь', 'ночи', 'ночей'])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Состоявшихся визитов пока нет.</p>
        )}
      </PanelSection>

      <div className="gb-panel__actions" data-testid="guest-panel-actions">
        {actions?.open && (
          <Link className="btn gb-panel__primary" href={actions.open} prefetch={false}>
            Открыть бронь
          </Link>
        )}
        {actions?.checkOut && (
          <Link className="btn btn--secondary" href={actions.checkOut} prefetch={false}>
            Выселить
          </Link>
        )}
        {actions?.checkIn && (
          <Link className="btn btn--secondary" href={actions.checkIn} prefetch={false}>
            Заселить
          </Link>
        )}
        {actions?.extend && (
          <Link className="btn btn--secondary" href={actions.extend} prefetch={false}>
            Продлить
          </Link>
        )}
        {actions?.relocate && (
          <Link className="btn btn--secondary" href={actions.relocate} prefetch={false}>
            Переселить
          </Link>
        )}
        {actions?.service && (
          <Link className="btn btn--secondary" href={actions.service} prefetch={false}>
            Добавить услугу
          </Link>
        )}
        {!readOnly && !actions?.open && (
          <Link className="btn gb-panel__primary" href={`/reservations/new?guest=${encodeURIComponent(g.id)}`}>
            <Icon name="plus" />
            Новая бронь
          </Link>
        )}
        {messengers && (
          <a className="btn btn--secondary gb-panel__wide" href={messengers.whatsapp} target="_blank" rel="noreferrer">
            Написать в WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  const services = (
    <div className="gb-panel__body">
      {g.services.length ? (
        <ul className="gb-visits" data-testid="guest-panel-services">
          {g.services.map((s) => (
            <li key={s.id}>
              <span>
                {s.description}
                {s.quantity > 1 && ` × ${s.quantity}`}
              </span>
              <span className="muted">{s.serviceDate ? displayDate(s.serviceDate) : ''}</span>
              <span className="num">{formatMoney(s.amountMinor, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" data-testid="guest-panel-services-empty">
          В счёте основного проживания услуг нет.
        </p>
      )}
      {actions?.service && (
        <Link className="btn btn--secondary" href={actions.service} prefetch={false}>
          Добавить услугу
        </Link>
      )}
    </div>
  );

  const history = (
    <div className="gb-panel__body">
      {g.visits.length ? (
        <ul className="gb-visits" data-testid="guest-panel-history">
          {g.visits.map((v) => (
            <li key={`${v.confirmationNumber}-${v.arrivalDate}`}>
              <Link href={`/reservations/${encodeURIComponent(v.confirmationNumber)}`} prefetch={false}>
                <time dateTime={v.arrivalDate}>{displayDate(v.arrivalDate, 'numeric')}</time>
              </Link>
              <span>
                <strong>{v.unitCode ?? '–'}</strong> <span className="muted">{v.accommodationTypeName}</span>
              </span>
              <span className="muted">{pluralRu(v.nights, ['ночь', 'ночи', 'ночей'])}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Состоявшихся визитов пока нет.</p>
      )}
      <Link className="btn btn--secondary" href={`/guests/${encodeURIComponent(g.id)}`}>
        Открыть гостя
      </Link>
    </div>
  );

  const notes = (
    <div className="gb-panel__body">
      {g.notes ? (
        <p className="gb-panel__notes" data-testid="guest-panel-notes">
          {g.notes}
        </p>
      ) : (
        <p className="muted" data-testid="guest-panel-notes">
          Заметок нет.
        </p>
      )}
      <Link className="btn btn--secondary" href={`/guests/${encodeURIComponent(g.id)}`}>
        Открыть карточку гостя
      </Link>
    </div>
  );

  return (
    <div className="gb-panel__card" data-testid="guest-panel">
      <header className="gb-panel__head">
        <span className="gb-avatar gb-avatar--lg" data-hue={0} aria-hidden="true">
          {initials(g.lastName, g.firstName)}
        </span>
        <div className="gb-panel__title">
          <h2>
            {name}
            {status && <Badge tone={status.tone}>{status.word}</Badge>}
          </h2>
          <p className="muted gb-panel__sub">
            <span>{guestNote(g)}</span>
            <span>{visitsWord(g.staysCount)}</span>
          </p>
        </div>
        <Link className="gb-panel__close" href={closeHref} scroll={false} aria-label="Закрыть панель гостя">
          <Icon name="close" width={18} height={18} />
        </Link>
      </header>
      <Tabs
        key={g.id}
        label="Панель гостя"
        panels={[
          { id: 'info', label: 'Информация', content: info },
          { id: 'services', label: 'Услуги', content: services },
          { id: 'history', label: 'История', content: history },
          { id: 'notes', label: 'Заметки', content: notes },
        ]}
      />
    </div>
  );
}

function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string } | undefined;
  children: ReactNode;
}) {
  return (
    <section className="gb-section" aria-label={title}>
      <header>
        <h3>{title}</h3>
        {action &&
          (action.href.startsWith('#') ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            <Link href={action.href} prefetch={false}>
              {action.label}
            </Link>
          ))}
      </header>
      {children}
    </section>
  );
}

export type { GuestPreview };
