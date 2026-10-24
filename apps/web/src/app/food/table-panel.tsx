'use client';
import { useEffect, useRef } from 'react';
import { Icon } from '../../components/icon';
import { Badge, Button } from '../../components/ui';
import { wholeTenge } from '../../lib/dashboard-format';
import { foodStatus } from '../../lib/status/food';
import type { DiningTable, OrderView, RestaurantReservation } from '../../lib/food-types';
import { formatPhone } from '../../lib/phone';
import { tableTitle } from '../../lib/table-title';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';

export type TableKind = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
export const KIND_LABEL: Record<TableKind, string> = {
  FREE: msg('Свободен'),
  OCCUPIED: msg('Занят'),
  RESERVED: msg('Бронь'),
  CLEANING: msg('Уборка'),
};
export const KIND_TONE: Record<TableKind, 'neutral' | 'danger' | 'info' | 'warn'> = {
  FREE: 'neutral',
  OCCUPIED: 'danger',
  RESERVED: 'info',
  CLEANING: 'warn',
};

/**
 * Карточка стола по макету (экран 2) и ТЗ §5.4: колонка справа от плана, открывается щелчком по столу и
 * не держит место закрытой; на телефоне лист снизу (ТЗ §21). Escape и крестик закрывают, фокус на стол.
 * Номер, зал, места, статус на время плана, текущий визит или заказ, брони стола за день и действия по
 * правам. Сами изменения идут через панель брони и заказы: карточка не дублирует их логику.
 */
export function TablePanel({
  table,
  areaName,
  kind,
  current,
  order,
  day,
  write,
  clock,
  close,
  openReservation,
  openOrders,
  book,
  walkIn,
  toggleCleaning,
  cleaningPending,
}: {
  table: DiningTable;
  areaName: string;
  kind: TableKind;
  current: RestaurantReservation | undefined;
  order: OrderView | undefined;
  /** брони этого стола на день экрана, по времени */
  day: RestaurantReservation[];
  write: boolean;
  clock: (iso: string) => string;
  close: () => void;
  openReservation: (r: RestaurantReservation) => void;
  openOrders: () => void;
  book: () => void;
  walkIn: () => void;
  toggleCleaning: () => void;
  cleaningPending: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const name = (r: RestaurantReservation) =>
    [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
  const upcoming = day.filter((r) => r.id !== current?.id);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), [table.id]);
  // Escape закрывает карточку, где бы ни стоял фокус (на столе схемы или в карточке),
  // если поверх нет открытого окна брони или заказа: у него свой Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <aside
      className="rest-table-panel"
      data-testid="table-panel"
      aria-label={tableTitle(table.name, t)}
    >
      <div className="rest-table-panel__head">
        <h2>{tableTitle(table.name, t)}</h2>
        <button
          ref={closeButton}
          type="button"
          className="rest-icon-btn"
          aria-label={t('Закрыть: {table}', { table: tableTitle(table.name, t) })}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
        <div className="food-section-heading">
          <Badge tone={KIND_TONE[kind]}>
            {t(current ? foodStatus[current.status].label : KIND_LABEL[kind])}
          </Badge>
          <span className="muted">
            {areaName}, {countLabel(locale, t, table.capacity, [msg('место@@стол'), 'места', msg('мест@@стол')])}{/* kk-allow: форма склонения */}
          </span>
        </div>
        {current && (
          <section aria-label={t('Текущий визит')} className="rest-table-panel__now">
            <strong>{name(current)}</strong>
            {current.customer.phone && <span>{formatPhone(current.customer.phone)}</span>}
            <span>
              {t('Время: {from}–{to},', { from: clock(current.startsAt), to: clock(current.endsAt) })}{' '}
              {countLabel(locale, t, current.partySize, [msg('гость'), 'гостя', msg('гостей')])}{/* kk-allow: форма склонения */}
            </span>
            {current.notes && <small>{current.notes}</small>}
          </section>
        )}
        {order && (
          <section aria-label={t('Заказ стола')} className="rest-table-panel__now">
            <strong>{t('Заказ №{number}', { number: order.number })}</strong>
            <span>
              {t('{sum}, с {time}', { sum: wholeTenge(order.totalMinor, order.currency), time: clock(order.openedAt) })}
            </span>
          </section>
        )}
        <div className="rest-table-panel__actions">
          {current && (
            <Button onClick={() => openReservation(current)}>{t('Открыть бронь')}</Button>
          )}
          {order && (
            <Button tone={current ? 'secondary' : 'primary'} onClick={openOrders}>
              {t('Открыть заказ')}
            </Button>
          )}
          {write && !current && !order && kind !== 'CLEANING' && (
            <>
              <Button onClick={book}>{t('Забронировать')}</Button>
              <Button tone="secondary" onClick={walkIn}>
                {t('Посадить без брони')}
              </Button>
            </>
          )}
          {write && !current && !order && (
            <Button tone="secondary" disabled={cleaningPending} onClick={toggleCleaning}>
              {table.needsCleaning ? t('Убрано') : t('Отметить уборку')}
            </Button>
          )}
        </div>
        <section aria-label={t('Брони стола на день')}>
          <h3>{t('Брони на день')}</h3>
          {upcoming.length === 0 ? (
            <p className="muted">{t('Других броней на этот день нет')}</p>
          ) : (
            <ul className="rest-table-panel__list">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => openReservation(r)}>
                    <span>
                      {clock(r.startsAt)}–{clock(r.endsAt)}
                    </span>
                    <span>{name(r)}</span>
                    <Badge>{t(foodStatus[r.status].label)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
    </aside>
  );
}
