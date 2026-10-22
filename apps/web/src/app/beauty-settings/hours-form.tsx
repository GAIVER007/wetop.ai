'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Field, Input } from '../../components/ui';
import type { BeautyLocationHoursResponse } from '../../lib/api';
import { localInput } from '../beauty/time';
import { zoneLabel } from '../../lib/human-period';
import { saveSalonHours } from './actions';

type Interval = BeautyLocationHoursResponse['intervals'][number] & { key: number };
const DAYS = [
  [1, 'Понедельник'],
  [2, 'Вторник'],
  [3, 'Среда'],
  [4, 'Четверг'],
  [5, 'Пятница'],
  [6, 'Суббота'],
  [0, 'Воскресенье'],
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
      <h2>Режим работы салона</h2>
      <p>
        Время: {zoneLabel(initial.location.timezone)}. Запись должна попадать в часы салона и график
        мастера.
      </p>
      {!data.configured && (
        <p>Режим пока не настроен. До сохранения доступность определяется графиками мастеров.</p>
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
        <legend className="sr-only">Недельный режим работы</legend>
        {DAYS.map(([weekday, name]) => {
          const own = rows.filter((row) => row.weekday === weekday);
          return (
            <section key={weekday} className="salon-hours-day" aria-label={name}>
              <h3>{name}</h3>
              <div className="salon-hours-day-content">
                {!own.length && <p>{data.configured ? 'Выходной' : 'Интервалы не заданы'}</p>}
                {own.map((row, index) => (
                  <div className="salon-hours-interval" key={row.key}>
                    <Field label="С">
                      <Input
                        type="time"
                        required
                        aria-label={`Начало: ${name}, интервал ${index + 1}`}
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
                    <Field label="До">
                      <Input
                        type="time"
                        required
                        aria-label={`Конец: ${name}, интервал ${index + 1}`}
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
                        aria-label={`Удалить интервал ${index + 1}: ${name}`}
                      >
                        Удалить
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
                  aria-label={`Добавить интервал: ${name}`}
                >
                  Добавить интервал
                </Button>
              )}
            </section>
          );
        })}
        {canEdit && (
          <div className="salon-hours-foot">
            {!rows.length && (
              <p>Если сохранить пустой график, все дни станут выходными для новых записей.</p>
            )}
            {state?.error && <Alert>{state.error}</Alert>}
            {state?.data && (
              <Alert tone="success">Режим работы сохранён. Существующие записи не перенесены.</Alert>
            )}
            <div className="salon-hours-actions">
              <Button type="submit" disabled={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить режим'}
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
                Скопировать понедельник на все дни
              </Button>
            </div>
          </div>
        )}
      </fieldset>
      {!canEdit && state?.error && <Alert>{state.error}</Alert>}
      {data.conflicts.length > 0 && (
        <section aria-label="Записи вне нового режима">
          <h3>Записи вне режима работы</h3>
          <p>Проверьте эти визиты. Их время сохранено.</p>
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
            <p>Показаны первые 100 конфликтов. Проверьте остальные записи в журнале.</p>
          )}
        </section>
      )}
    </form>
  );
}
