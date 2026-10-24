'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import type { BeautyLocationHoursResponse } from '../../lib/api';
import { localInput } from '../beauty/time';
import { zoneLabel } from '../../lib/human-period';
import { saveSalonHours } from './actions';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

type Interval = BeautyLocationHoursResponse['intervals'][number] & { key: number };
const DAYS = [
  [1, msg('Понедельник')],
  [2, msg('Вторник')],
  [3, msg('Среда')],
  [4, msg('Четверг')],
  [5, msg('Пятница')],
  [6, msg('Суббота')],
  [0, msg('Воскресенье')],
] as const;
export function SalonHoursForm({
  initial,
  scopeKey,
  canEdit,
}: {
  initial: BeautyLocationHoursResponse;
  scopeKey: string;
  canEdit: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(saveSalonHours, null);
  const data = state?.data ?? initial;
  const [rows, setRows] = useState<Interval[]>(() =>
    initial.intervals.map((interval, key) => ({ ...interval, key })),
  );
  const nextKey = useRef(rows.length);
  useEffect(() => {
    if (!state?.data) return;
    setRows(state.data.intervals.map((interval, key) => ({ ...interval, key })));
    nextKey.current = state.data.intervals.length;
  }, [state]);
  return (
    <form action={action} className="salon-hours-form">
      <h2>{t('Режим работы салона')}</h2>
      <p>
        {t('Время: {zone}. Запись должна попадать в часы салона и график мастера.', {
          zone: zoneLabel(initial.location.timezone),
        })}
      </p>
      {!data.configured && (
        <p>{t('Режим пока не настроен. До сохранения доступность определяется графиками мастеров.')}</p>
      )}
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <input type="hidden" name="revision" value={data.revision} />
      <input
        type="hidden"
        name="intervals"
        value={JSON.stringify(
          rows.map(({ weekday, timeFrom, timeTo }) => ({ weekday, timeFrom, timeTo })),
        )}
      />
      <fieldset disabled={!canEdit || pending} className="salon-hours-week">
        <legend className="sr-only">{t('Недельный режим работы')}</legend>
        {DAYS.map(([weekday, dayName]) => {
          const name = t(dayName);
          const own = rows.filter((row) => row.weekday === weekday);
          return (
            <section key={weekday} className="salon-hours-day" aria-label={name}>
              <h3>{name}</h3>
              <div className="salon-hours-day-content">
                {!own.length && <p>{data.configured ? t('Выходной') : t('Интервалы не заданы')}</p>}
                {own.map((row, index) => (
                  <div className="salon-hours-interval" key={row.key}>
                    <Field label={t('С')}>
                      <Input
                        type="time"
                        required
                        aria-label={t('Начало: {day}, интервал {n}', { day: name, n: index + 1 })}
                        value={row.timeFrom}
                        onChange={(event) =>
                          setRows((all) =>
                            all.map((item) =>
                              item.key === row.key
                                ? { ...item, timeFrom: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={t('До')}>
                      <Input
                        type="time"
                        required
                        aria-label={t('Конец: {day}, интервал {n}', { day: name, n: index + 1 })}
                        value={row.timeTo}
                        onChange={(event) =>
                          setRows((all) =>
                            all.map((item) =>
                              item.key === row.key ? { ...item, timeTo: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </Field>
                    {canEdit && (
                      <Button
                        type="button"
                        tone="ghost"
                        onClick={() => setRows((all) => all.filter((item) => item.key !== row.key))}
                        aria-label={t('Удалить интервал {n}: {day}', { n: index + 1, day: name })}
                      >
                        {t('Удалить')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <Button
                  type="button"
                  tone="secondary"
                  disabled={own.length >= 4}
                  onClick={() =>
                    setRows((all) => [
                      ...all,
                      { key: nextKey.current++, weekday, timeFrom: '', timeTo: '' },
                    ])
                  }
                  aria-label={t('Добавить интервал: {day}', { day: name })}
                >
                  {t('Добавить интервал')}
                </Button>
              )}
            </section>
          );
        })}
        {canEdit && (
          <div className="salon-hours-foot">
            {!rows.length && (
              <p>{t('Если сохранить пустой график, все дни станут выходными для новых записей.')}</p>
            )}
            {state?.error && <Alert>{state.error}</Alert>}
            {state?.data && (
              <Alert tone="success">{t('Режим работы сохранён. Существующие записи не перенесены.')}</Alert>
            )}
            <div className="salon-hours-actions">
              <Button type="submit" disabled={pending}>
                {pending ? t('Сохраняем…') : t('Сохранить режим')}
              </Button>
              <Button
                type="button"
                tone="secondary"
                disabled={!rows.some((row) => row.weekday === 1)}
                onClick={() =>
                  setRows((all) => {
                    const monday = all.filter((row) => row.weekday === 1);
                    return [
                      ...monday,
                      ...DAYS.filter(([weekday]) => weekday !== 1).flatMap(([weekday]) =>
                        monday.map((row) => ({ ...row, weekday, key: nextKey.current++ })),
                      ),
                    ];
                  })
                }
              >
                {t('Скопировать понедельник на все дни')}
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {!canEdit && state?.error && <Alert>{state.error}</Alert>}
      {data.conflicts.length > 0 && (
        <section aria-label={t('Записи вне нового режима')}>
          <h3>{t('Записи вне режима работы')}</h3>
          <p>{t('Проверьте эти визиты. Их время сохранено.')}</p>
          <ul>
            {data.conflicts.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/calendar?date=${localInput(visit.startsAt, data.location.timezone).slice(0, 10)}&appointment=${visit.id}`}
                >
                  {visit.customerName},{' '}
                  {localInput(visit.startsAt, data.location.timezone).replace('T', ' ')}
                </Link>
              </li>
            ))}
          </ul>
          {data.conflictsTruncated && (
            <p>{t('Показаны первые 100 конфликтов. Проверьте остальные записи в журнале.')}</p>
          )}
        </section>
      )}
    </form>
  );
}
