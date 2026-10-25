'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Button, Table } from '../../components/ui';
import type { FoodShiftRow } from '../../lib/food-types';
import { WeekForm } from '../beauty/schedule/board';
import { loadFoodShift, saveFoodShifts } from './restaurant-actions';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

const DAYS: Record<number, string> = { 1: msg('Пн'), 2: msg('Вт'), 3: msg('Ср'), 4: msg('Чт'), 5: msg('Пт'), 6: msg('Сб'), 0: msg('Вс') };

/** График смен ресторана (Q-REST-11): неделя каждого сотрудника, правка той же формой недели, что у салона */
export function ShiftsBoard({
  scopeKey,
  write,
  employees,
}: {
  scopeKey: string;
  write: boolean;
  employees: FoodShiftRow[];
}) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<FoodShiftRow | null>(null);
  const days = employees[0]?.week.map((d) => d.weekday) ?? [1, 2, 3, 4, 5, 6, 0];
  if (!employees.length) return <p className="muted">{t('Добавьте сотрудников на вкладке «Сотрудники».')}</p>;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <th scope="col">{t('Сотрудник')}</th>
            {days.map((d) => (
              <th scope="col" key={d}>
                {t(DAYS[d] ?? '')}
              </th>
            ))}
            {write && (
              <th scope="col">
                <span className="sr-only">{t('Действия')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <th scope="row">{e.name}</th>
              {e.week.map((day) => (
                <td key={day.weekday}>
                  {day.intervals.length ? (
                    day.intervals.map((i) => <div key={i.timeFrom}>{`${i.timeFrom}–${i.timeTo}`}</div>)
                  ) : (
                    <span className="muted">{t('Выходной')}</span>
                  )}
                </td>
              ))}
              {write && (
                <td>
                  <Button size="sm" tone="secondary" onClick={() => setEditing(e)}>
                    {t('Изменить график')}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      <Overlay open={editing !== null} onClose={() => setEditing(null)} title={t('График: {name}', { name: editing?.name ?? '' })} drawer>
        {editing && (
          <WeekForm
            employeeId={editing.id}
            week={editing.week}
            expectedRevision={editing.weekRevision}
            scopeKey={scopeKey}
            loadCurrent={loadFoodShift.bind(null, scopeKey)}
            save={saveFoodShifts.bind(null, scopeKey)}
            onSaved={async () => router.refresh()}
          />
        )}
      </Overlay>
    </>
  );
}
