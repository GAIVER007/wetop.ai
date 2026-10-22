'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Button, EmptyState, Table } from '../../components/ui';
import type { FoodShiftRow } from '../../lib/food-types';
import { WeekForm } from '../beauty/schedule/board';
import { loadHotelShift, saveHotelShifts } from '../hotel-staff/actions';

const DAYS: Record<number, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' };

/** Неделя каждого сотрудника гостиницы; правка той же формой недели, что у салона и ресторана */
export function HotelShiftsBoard({ scopeKey, write, employees }: { scopeKey: string; write: boolean; employees: FoodShiftRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<FoodShiftRow | null>(null);
  const days = employees[0]?.week.map((d) => d.weekday) ?? [1, 2, 3, 4, 5, 6, 0];
  if (!employees.length)
    return <EmptyState title="Сотрудников пока нет" details="Пригласите горничную или администратора в разделе «Персонал → Сотрудники»." />;
  return (
    <>
      <Table data-testid="hotel-shifts">
        <thead>
          <tr>
            <th scope="col">Сотрудник</th>
            {days.map((d) => (
              <th scope="col" key={d}>
                {DAYS[d]}
              </th>
            ))}
            {write && (
              <th scope="col">
                <span className="sr-only">Действия</span>
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
                    <span className="muted">Выходной</span>
                  )}
                </td>
              ))}
              {write && (
                <td>
                  <Button size="sm" tone="secondary" onClick={() => setEditing(e)}>
                    Изменить график
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      <Overlay open={editing !== null} onClose={() => setEditing(null)} title={`График: ${editing?.name ?? ''}`} drawer>
        {editing && (
          <WeekForm
            employeeId={editing.id}
            week={editing.week}
            expectedRevision={editing.weekRevision}
            scopeKey={scopeKey}
            loadCurrent={loadHotelShift.bind(null, scopeKey)}
            save={saveHotelShifts.bind(null, scopeKey)}
            onSaved={async () => router.refresh()}
          />
        )}
      </Overlay>
    </>
  );
}
