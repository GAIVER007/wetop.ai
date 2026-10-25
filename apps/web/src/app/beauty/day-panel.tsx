'use client';
import { useState, useTransition } from 'react';
import { Button } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyDayColumn } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { formatPhone } from '../../lib/phone';
import { beautyStatus } from '../../lib/status/beauty';
import { ACTION_WORD } from './appointment-status';
import { dayMoney, quickAction, upcoming } from './journal-day';
import { setAppointmentStatus } from './journal-actions';
import { clock } from './time';
import { useT } from '../../i18n/locale-provider';
import './day-panel.css';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

/**
 * Панель дня справа от сетки журнала (владелец 24.10.2026, вариант B): выбранная запись с главными действиями,
 * «Ближайшие» с одной кнопкой «Пришла» или «Подтвердить» и деньги дня. Полная карточка открывается как прежде.
 */
export function DayPanel({
  rows,
  columns,
  selected,
  nowMinutes,
  canUpdate,
  onOpen,
  onDone,
}: {
  rows: BeautyAppointmentRow[];
  columns: BeautyDayColumn[];
  selected: BeautyAppointmentRow | null;
  /** минуты «сейчас» по поясу филиала; не сегодня: null */
  nowMinutes: number | null;
  canUpdate: boolean;
  onOpen: (row: BeautyAppointmentRow) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const master = (id: string) => columns.find((c) => c.id === id)?.name ?? t('Специалист');
  const change = (row: BeautyAppointmentRow, to: string) =>
    start(async () => {
      setError('');
      const result = await setAppointmentStatus(row.id, to);
      if (result.error) setError(result.error);
      else onDone();
    });
  const soon = upcoming(rows, nowMinutes);
  const money = dayMoney(rows);
  const first = selected?.next.find(
    (s) => s === 'IN_PROGRESS' || s === 'DONE' || s === 'CONFIRMED',
  );
  return (
    <aside className="beauty-day-panel" aria-label={t('Панель дня')}>
      <section
        className="beauty-day-panel__card"
        aria-label={t('Выбранная запись')}
        data-testid="day-panel-selected"
      >
        {selected ? (
          <>
            <h3>
              {t('Выбранная запись')} <small>{t(beautyStatus[selected.status].label)}</small>
            </h3>
            <p className="beauty-day-panel__time">
              {clock(selected.startMinutes)}–{clock(selected.endMinutes)}
            </p>
            <dl className="beauty-day-panel__facts">
              <dt>{t('Клиент')}</dt>
              <dd>{selected.customer.name}</dd>
              {selected.customer.phone && (
                <>
                  <dt>{t('Телефон')}</dt>
                  <dd>
                    <a href={`tel:${selected.customer.phone}`}>
                      {formatPhone(selected.customer.phone)}
                    </a>
                  </dd>
                </>
              )}
              <dt>{t('Услуга')}</dt>
              <dd>
                {selected.items?.length
                  ? selected.items.map((i) => i.serviceName).join(', ')
                  : selected.serviceName}
              </dd>
              <dt>{t('Мастер')}</dt>
              <dd>{master(selected.employeeId)}</dd>
              <dt>{t('Сумма')}</dt>
              <dd>
                {formatMoney(selected.priceMinor, selected.currency)}{' '}
                <span
                  className={
                    BigInt(selected.paidMinor || '0') >= BigInt(selected.priceMinor || '0')
                      ? 'beauty-paid'
                      : 'beauty-unpaid'
                  }
                >
                  {BigInt(selected.paidMinor || '0') >= BigInt(selected.priceMinor || '0')
                    ? t('оплачено')
                    : t('не оплачено')}
                </span>
              </dd>
            </dl>
            <div className="beauty-day-panel__actions">
              {canUpdate && first && (
                <Button disabled={pending} onClick={() => change(selected, first)}>
                  {t(ACTION_WORD[first])}
                </Button>
              )}
              <Button tone="secondary" onClick={() => onOpen(selected)}>
                {selected.status === 'IN_PROGRESS' || selected.status === 'DONE'
                  ? t('Оплата')
                  : t('Открыть')}
              </Button>
              <Button tone="secondary" onClick={() => onOpen(selected)}>
                {t('Ещё')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3>{t('Выбранная запись')}</h3>
            <p className="beauty-note">
              {t('Нажмите на запись в сетке: здесь появятся клиент, сумма и действия.')}
            </p>
          </>
        )}
        {error && (
          <p className="beauty-unpaid" role="alert">
            {error}
          </p>
        )}
      </section>
      <section
        className="beauty-day-panel__card"
        aria-label={t('Ближайшие')}
        data-testid="day-panel-upcoming"
      >
        <h3>
          {t('Ближайшие')}{' '}
          {nowMinutes !== null && <small>{t('с {time}', { time: clock(Math.max(0, nowMinutes - 30)) })}</small>}
        </h3>
        {soon.length ? (
          <ul className="beauty-day-panel__list">
            {soon.map((r) => {
              const act = canUpdate ? quickAction(r) : null;
              return (
                <li key={r.id}>
                  <button type="button" className="beauty-day-panel__row" onClick={() => onOpen(r)}>
                    <time>{clock(r.startMinutes)}</time>
                    <span className="beauty-avatar" aria-hidden="true">
                      {initials(master(r.employeeId))}
                    </span>
                    <span className="beauty-day-panel__who">
                      <b>{r.customer.name}</b>
                      <small>{r.serviceName}</small>
                    </span>
                  </button>
                  {act && (
                    <Button
                      size="sm"
                      tone={act.to === 'IN_PROGRESS' ? 'success' : 'secondary'}
                      disabled={pending}
                      aria-label={`${t(act.label)}: ${r.customer.name}, ${clock(r.startMinutes)}`}
                      onClick={() => change(r, act.to)}
                    >
                      {t(act.label)}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="beauty-note">{t('Ожидаемых клиентов больше нет.')}</p>
        )}
      </section>
      <section
        className="beauty-day-panel__card"
        aria-label={t('Деньги за день')}
        data-testid="day-panel-money"
      >
        <h3>{t('Деньги за день')}</h3>
        <div className="beauty-day-panel__money">
          <div>
            <small>{t('Получено')}</small>
            <b>{formatMoney(money.received.toString(), money.currency)}</b>
          </div>
          <div>
            <small>{t('Ждём оплату')}</small>
            <b className={money.waiting > 0n ? 'beauty-unpaid' : undefined}>
              {formatMoney(money.waiting.toString(), money.currency)}
            </b>
          </div>
        </div>
      </section>
    </aside>
  );
}
