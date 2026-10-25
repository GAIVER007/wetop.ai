'use client';
import { useState, useTransition } from 'react';
import { Alert, Button } from '../../components/ui';
import type { BeautyReminderItem } from '../../lib/api';
import { markReminderDone } from './reminder-actions';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

const time = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Почему нет кнопки WhatsApp: нет телефона или ссылка на отзыв уже не действует (перевыпущена в карточке записи) */
export function missingLink(item: Pick<BeautyReminderItem, 'kind' | 'customerPhone'>): string {
  if (!item.customerPhone) return msg('Нет телефона');
  return item.kind === 'REVIEW_REQUEST' ? msg('Ссылка на отзыв не действует') : msg('Проверьте телефон');
}

/**
 * «Напомнить сегодня»: сообщения, которые салон отправляет сам, в WhatsApp по ссылке wa.me. Напоминания о записи и
 * просьбы отзыва после визита («Попросить отзыв») в одном списке.
 */
export function RemindersToday({
  items,
  timezone,
  canUpdate,
}: {
  items: BeautyReminderItem[];
  timezone: string;
  canUpdate: boolean;
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = useT();
  const left = items.filter((item) => !done.has(item.id));
  if (!left.length) return null;
  return (
    <section className="beauty-reminders-today" aria-label={t('Напомнить сегодня')} data-testid="reminders-today">
      <h2>{t('Напомнить сегодня ({n})', { n: left.length })}</h2>
      <ul>
        {left.map((item) => (
          <li key={item.id} data-testid="reminder-row" data-kind={item.kind}>
            <span className="beauty-reminders-today__who">
              {item.kind === 'REVIEW_REQUEST' && (
                <span className="beauty-reminders-today__kind" data-testid="reminder-kind">
                  {item.kindLabel}:{' '}
                </span>
              )}
              {item.kind === 'REVIEW_REQUEST'
                ? t('{name}, визит в {time}', { name: item.customerName, time: time(item.appointmentStartsAt, timezone) })
                : t('{name}, запись в {time}', { name: item.customerName, time: time(item.appointmentStartsAt, timezone) })}
              {item.state === 'FAILED' && <span className="muted">{t(', письмо не ушло')}</span>}
            </span>
            <span className="beauty-reminders-today__actions">
              {item.whatsappUrl ? (
                <a className="btn btn--secondary" href={item.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  {t('Написать в WhatsApp')}
                </a>
              ) : (
                <span className="muted">{t(missingLink(item))}</span>
              )}
              {canUpdate && (
                <Button
                  type="button"
                  tone="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await markReminderDone(item.id);
                      if (result.ok) setDone((all) => new Set(all).add(item.id));
                      else setError(result.error);
                    })
                  }
                >
                  {item.kind === 'REVIEW_REQUEST' ? t('Попросил') : t('Напомнил')}
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
