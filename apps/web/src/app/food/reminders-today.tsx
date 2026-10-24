'use client';
import { useState, useTransition } from 'react';
import { Alert, Button } from '../../components/ui';
import type { FoodReminderItem } from '../../lib/food-api';
import { markFoodReminderDone } from '../restaurant-settings/reminder-actions';

const time = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/**
 * «Напомнить сегодня» на «Бронированиях» ресторана (§61): напоминания, которые ресторан шлёт сам, в WhatsApp по
 * ссылке wa.me. Только «Вручную» и «Ошибка», остальное уходит само. Вид и классы те же, что у журнала салона.
 */
export function FoodRemindersToday({ items, timezone, canUpdate }: { items: FoodReminderItem[]; timezone: string; canUpdate: boolean }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const left = items.filter((item) => !done.has(item.id));
  if (!left.length) return null;
  return (
    <section className="rest-reminders-today" aria-label="Напомнить сегодня" data-testid="food-reminders-today">
      <h2>Напомнить сегодня ({left.length})</h2>
      <ul>
        {left.map((item) => (
          <li key={item.id} data-testid="food-reminder-row" data-kind={item.kind}>
            <span className="rest-reminders-today__who">
              {item.customerName}, бронь в {time(item.reservationStartsAt, timezone)}, гостей {item.partySize}
              {item.state === 'FAILED' && <span className="muted">, письмо не ушло</span>}
            </span>
            <span className="rest-reminders-today__actions">
              {item.whatsappUrl ? (
                <a className="btn btn--secondary" href={item.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Написать в WhatsApp
                </a>
              ) : (
                <span className="muted">{item.customerPhone ? 'Проверьте телефон' : 'Нет телефона'}</span>
              )}
              {canUpdate && (
                <Button
                  type="button"
                  tone="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await markFoodReminderDone(item.id);
                      if (result.ok) setDone((all) => new Set(all).add(item.id));
                      else setError(result.error);
                    })
                  }
                >
                  Напомнил
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {error && <Alert>{error}</Alert>}
    </section>
  );
}
