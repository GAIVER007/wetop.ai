'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import type { FoodShiftRow } from '../../lib/food-types';
import { WeekForm, WeekTemplateGrid } from '../beauty/schedule/board';
import { loadFoodShift, saveFoodShifts } from './restaurant-actions';
import { useT } from '../../i18n/locale-provider';

/** График смен ресторана (Q-REST-11): неделя каждого сотрудника видом графика салона (вариант B, 25.10.2026) */
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
  if (!employees.length) return <p className="muted">{t('Добавьте сотрудников на вкладке «Сотрудники».')}</p>;
  return (
    <>
      <WeekTemplateGrid rows={employees} write={write} onEdit={(row) => setEditing(row)} />
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
