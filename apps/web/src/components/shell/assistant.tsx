'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Overlay } from '../overlay';
import { Icon } from '../icon';
import { loadDeskSummary } from './summary-action';
import { formatMinor } from '../../lib/format';
export function ShellAssistant({
  open,
  close,
  notifications = false,
}: {
  open: boolean;
  close: () => void;
  notifications?: boolean;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadDeskSummary>> | null>(null);
  const [version, setVersion] = useState(0);
  const [topic, setTopic] = useState('summary');
  useEffect(() => {
    if (!open) return;
    let current = true;
    setResult(null);
    loadDeskSummary()
      .then((r) => {
        if (current) setResult(r);
      })
      .catch(() => {
        if (current) setResult({ day: null, availability: null, error: 'Сводка недоступна.' });
      });
    return () => {
      current = false;
    };
  }, [open, version]);
  const day = result?.day;
  const rows = day
    ? topic === 'departures'
      ? day.departures.filter((r) => r.status !== 'CHECKED_OUT')
      : topic === 'arrivals'
        ? day.arrivals.filter((r) => r.status !== 'CHECKED_IN')
        : [
            ...day.departures.filter((r) => BigInt(r.balanceMinor) > 0n),
            ...day.arrivals.filter(
              (r) => r.blockedReason || !r.unitCode || r.guestsRecorded < r.adults,
            ),
          ]
    : [];
  return (
    <Overlay
      open={open}
      onClose={close}
      title={notifications ? 'Уведомления' : 'WETOP AI Assistant'}
      drawer
    >
      <div className="assistant-intro">
        <span className="ai-orb ai-orb--large" aria-hidden="true" />
        <h3>{notifications ? 'В центре внимания' : 'Ваша смена, в одном взгляде'}</h3>
        <p>Оперативная сводка по данным объекта</p>
      </div>
      {!result && (
        <div aria-busy="true" aria-label="Загрузка сводки">
          {[1, 2, 3].map((n) => (
            <div className="skeleton skeleton-row" key={n} />
          ))}
        </div>
      )}
      {result?.error && (
        <div className="alert" role="alert">
          {result.error}
          <button className="btn btn--secondary" onClick={() => setVersion((v) => v + 1)}>
            Повторить
          </button>
        </div>
      )}
      {day && (
        <>
          <div className="assistant-facts">
            <div>
              <Icon name="arrival" />
              <strong>{day.counts.toCheckIn}</strong>
              <span>ожидают заселения</span>
            </div>
            <div>
              <Icon name="departure" />
              <strong>{day.counts.toCheckOut}</strong>
              <span>ожидают выезда</span>
            </div>
            <div>
              <Icon name="money" />
              <strong>{formatMinor(day.debtMinor)}</strong>
              <span>долг уезжающих</span>
            </div>
          </div>
          {!notifications && (
            <div className="assistant-prompts">
              {[
                ['summary', 'Что требует внимания?'],
                ['arrivals', 'Кого нужно заселить?'],
                ['departures', 'Кого нужно выселить?'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className="btn btn--secondary"
                  aria-pressed={topic === id}
                  onClick={() => setTopic(id!)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="assistant-results">
            {rows.length ? (
              rows.map((r, i) => (
                <Link
                  key={`${r.itemId}-${i}`}
                  href={`/reservations/${encodeURIComponent(r.confirmationNumber)}#booking-actions`}
                  onClick={close}
                >
                  <span className="round-icon">
                    <Icon name={r.blockedReason ? 'incidents' : 'guests'} />
                  </span>
                  <span>
                    <strong>{r.guestLabel}</strong>
                    <small>
                      {r.unitCode ?? 'Номер не назначен'} ·{' '}
                      {r.blockedReason ||
                        (BigInt(r.balanceMinor) > 0n
                          ? `К оплате ${formatMinor(r.balanceMinor)}`
                          : `${r.arrivalDate} → ${r.departureDate}`)}
                    </small>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <Icon name="check" />
                <h3>Всё в порядке</h3>
                <p>В этом списке нет незавершённых задач.</p>
              </div>
            )}
          </div>
        </>
      )}
      <div className="assistant-footer">
        <Icon name="shield" />
        Действия выполняются после вашего выбора.
      </div>
    </Overlay>
  );
}
