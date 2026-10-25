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
import { countLabel, intlLocale, msg } from '../../i18n';
import { currentLocale, serverT } from '../../i18n/server';
import { nightsLabel, type Lang } from '../chessboard/lang';
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
  guestDisplayName,
} from './guest-stay';
import { formatPhone } from '../../lib/phone';

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
  const t = await serverT();
  const locale = await currentLocale();
  const lang: Lang = { t, locale };
  const date = (iso: string, style: 'short' | 'numeric' = 'short') => displayDate(iso, style, intlLocale(locale));
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
          title={t('Гость не открылся')}
          actions={
            <Link className="btn btn--secondary" href={closeHref}>
              {t('Закрыть')}
            </Link>
          }
        >
          {t('Гостя нет в базе организации или сервер не ответил. Выберите другого гостя в списке.')}
        </EmptyState>
      </div>
    );
  const g = loaded.guest;
  const stay = g.stay;
  const actions = readOnly ? null : stayActions(stay);
  const messengers = messengerLinks(g.phone);
  const status = stayStatus(g, today, lang);
  const name = guestDisplayName(g);
  const payment = stayPayment(stay);
  const currency = stay?.currency ?? g.currency;
  const visitsShown = g.visits.slice(0, 3);
  const yearOf = (date: string) => date.slice(0, 4) !== today.slice(0, 4);
  // даты проживания с годом, когда оно не целиком в текущем году: иначе «7 окт. → 12 окт.» двусмысленно
  const stayStyle = stay && (yearOf(stay.arrivalDate) || yearOf(stay.departureDate)) ? 'numeric' : 'short';

  const info = (
    <div className="gb-panel__body">
      <PanelSection title={t('Контакты')} action={{ href: `/guests/${encodeURIComponent(g.id)}`, label: t('Изменить') }}>
        <ul className="gb-contact-list">
          <li>
            <Icon name="phone" width={16} height={16} />
            <span>{g.phone ? formatPhone(g.phone) : <span className="muted">{t('нет телефона')}</span>}</span>
            {g.phone && <CopyButton text={g.phone} what={t('телефон')} />}
          </li>
          <li>
            <Icon name="mail" width={16} height={16} />
            <span>{g.email ?? <span className="muted">{t('нет почты')}</span>}</span>
            {g.email && <CopyButton text={g.email} what={t('почту')} />}
          </li>
          {messengers && (
            <li>
              <Icon name="chat" width={16} height={16} />
              <a href={messengers.whatsapp} target="_blank" rel="noreferrer">
                {t('Написать в WhatsApp')}
              </a>
            </li>
          )}
        </ul>
      </PanelSection>

      <PanelSection
        title={t('Бронь')}
        action={
          stay?.confirmationNumber
            ? { href: `/reservations/${encodeURIComponent(stay.confirmationNumber)}`, label: t('Открыть') }
            : undefined
        }
      >
        {stay ? (
          <dl className="gb-facts" data-testid="guest-panel-stay">
            <div>
              <dt>{t('Номер брони')}</dt>
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
              <dt>{t('Номер и категория')}</dt>
              <dd>
                {stay.unitCode ? <strong>{stay.unitCode}</strong> : <span className="warn-text">{t('не назначена')}</span>}{' '}
                <span className="muted">{stay.accommodationTypeName}</span>
              </dd>
            </div>
            <div>
              <dt>{t('Даты проживания')}</dt>
              <dd>
                <time dateTime={stay.arrivalDate}>{date(stay.arrivalDate, stayStyle)}</time>
                {' → '}
                <time dateTime={stay.departureDate}>{date(stay.departureDate, stayStyle)}</time>{' '}
                <span className="muted">({nightsLabel(lang, stay.nights)})</span>
              </dd>
            </div>
            <div>
              <dt>{t('Количество гостей')}</dt>
              <dd>
                {countLabel(locale, t, stay.adults, [msg('взрослый'), 'взрослых', msg('взрослых')]) /* kk-allow: форма склонения */}
                {stay.children > 0 &&
                  `, ${countLabel(locale, t, stay.children, [msg('ребёнок'), 'ребёнка', msg('детей')])}` /* kk-allow: форма склонения */}
              </dd>
            </div>
            <div>
              <dt>{t('Источник')}</dt>
              <dd>{t(sourceLabel(stay.source, stay.channel))}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted" data-testid="guest-panel-nostay">
            {g.lastCancelledAt
              ? t('Бронь на {date} отменена, других проживаний нет.', { date: date(g.lastCancelledAt) })
              : t('Проживаний нет: гость появится здесь после брони.')}
          </p>
        )}
      </PanelSection>

      {stay && (
        <PanelSection
          title={t('Оплата')}
          action={actions?.service ? { href: actions.service, label: t('Счёт') } : undefined}
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
                  <dt>{t('Общая сумма')}</dt>
                  <dd className="num">{formatMoney(stay.money.chargedMinor, currency)}</dd>
                </div>
                <div>
                  <dt>{t('Оплачено')}</dt>
                  <dd className="num">{formatMoney(stay.money.paidMinor, currency)}</dd>
                </div>
                <div>
                  <dt>{t('Долг')}</dt>
                  <dd className={BigInt(stay.money.balanceMinor) > 0n ? 'num warn-text' : 'num'}>
                    {formatMoney(BigInt(stay.money.balanceMinor) > 0n ? stay.money.balanceMinor : '0', currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="muted" data-testid="guest-panel-payment">
              {t('Счёта по проживанию нет.')}
            </p>
          )}
        </PanelSection>
      )}

      <PanelSection
        title={t('История проживания')}
        action={
          g.visits.length > 3 || g.staysCount > 3
            ? { href: '#history', label: t('Все визиты ({n})', { n: g.staysCount }) }
            : undefined
        }
      >
        {visitsShown.length ? (
          <ul className="gb-visits" data-testid="guest-panel-visits">
            {visitsShown.map((v) => (
              <li key={`${v.confirmationNumber}-${v.arrivalDate}`}>
                <time dateTime={v.arrivalDate}>{date(v.arrivalDate, yearOf(v.arrivalDate) ? 'numeric' : 'short')}</time>
                <span>
                  <strong>{v.unitCode ?? '–'}</strong> <span className="muted">{v.accommodationTypeName}</span>
                </span>
                <span className="muted">{nightsLabel(lang, v.nights)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('Состоявшихся визитов пока нет.')}</p>
        )}
      </PanelSection>

      <div className="gb-panel__actions" data-testid="guest-panel-actions">
        {actions?.open && (
          <Link className="btn gb-panel__primary" href={actions.open} prefetch={false}>
            {t('Открыть бронь')}
          </Link>
        )}
        {actions?.checkOut && (
          <Link className="btn btn--secondary" href={actions.checkOut} prefetch={false}>
            {t('Выселить')}
          </Link>
        )}
        {actions?.checkIn && (
          <Link className="btn btn--secondary" href={actions.checkIn} prefetch={false}>
            {t('Заселить')}
          </Link>
        )}
        {actions?.extend && (
          <Link className="btn btn--secondary" href={actions.extend} prefetch={false}>
            {t('Продлить')}
          </Link>
        )}
        {actions?.relocate && (
          <Link className="btn btn--secondary" href={actions.relocate} prefetch={false}>
            {t('Переселить')}
          </Link>
        )}
        {actions?.service && (
          <Link className="btn btn--secondary" href={actions.service} prefetch={false}>
            {t('Добавить услугу')}
          </Link>
        )}
        {!readOnly && !actions?.open && (
          <Link className="btn gb-panel__primary" href={`/reservations/new?guest=${encodeURIComponent(g.id)}`}>
            <Icon name="plus" />
            {t('Новая бронь')}
          </Link>
        )}
        {messengers && (
          <a className="btn btn--secondary gb-panel__wide" href={messengers.whatsapp} target="_blank" rel="noreferrer">
            {t('Написать в WhatsApp')}
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
              <span className="muted">{s.serviceDate ? date(s.serviceDate) : ''}</span>
              <span className="num">{formatMoney(s.amountMinor, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" data-testid="guest-panel-services-empty">
          {t('В счёте основного проживания услуг нет.')}
        </p>
      )}
      {actions?.service && (
        <Link className="btn btn--secondary" href={actions.service} prefetch={false}>
          {t('Добавить услугу')}
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
              <span className="muted">{nightsLabel(lang, v.nights)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{t('Состоявшихся визитов пока нет.')}</p>
      )}
      <Link className="btn btn--secondary" href={`/guests/${encodeURIComponent(g.id)}`}>
        {t('Открыть гостя')}
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
          {t('Заметок нет.')}
        </p>
      )}
      <Link className="btn btn--secondary" href={`/guests/${encodeURIComponent(g.id)}`}>
        {t('Открыть карточку гостя')}
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
            <span>{guestNote(g, lang)}</span>
            <span>{visitsWord(g.staysCount, lang)}</span>
          </p>
        </div>
        <Link className="gb-panel__close" href={closeHref} scroll={false} aria-label={t('Закрыть панель гостя')}>
          <Icon name="close" width={18} height={18} />
        </Link>
      </header>
      <Tabs
        key={g.id}
        label={t('Панель гостя')}
        panels={[
          { id: 'info', label: t('Информация'), content: info },
          { id: 'services', label: t('Услуги'), content: services },
          { id: 'history', label: t('История'), content: history },
          { id: 'notes', label: t('Заметки'), content: notes },
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
