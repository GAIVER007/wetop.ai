'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { EmptyState } from '../../components/ui';
import type { FoodShiftRow } from '../../lib/food-types';
import { WeekForm, WeekTemplateGrid } from '../beauty/schedule/board';
import { loadHotelShift, saveHotelShifts } from '../hotel-staff/actions';
import { useT } from '../../i18n/locale-provider';

/** Неделя каждого сотрудника гостиницы видом графика салона (вариант B, 25.10.2026); правка той же формой недели */
export function HotelShiftsBoard({ scopeKey, write, employees, monday }: { scopeKey: string; write: boolean; employees: Array<FoodShiftRow & { absent?: string[] }>; monday?: string }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState<(FoodShiftRow & { absent?: string[] }) | null>(null);
  if (!employees.length)
    return <EmptyState title={t('Сотрудников пока нет')} details={t('Пригласите горничную или администратора в разделе «Персонал → Сотрудники».')} />;
  return (
    <>
      <WeekTemplateGrid rows={employees} write={write} onEdit={(row) => setEditing(row)} testId="hotel-shifts" monday={monday} />
      <Overlay open={editing !== null} onClose={() => setEditing(null)} title={t('График: {name}', { name: editing?.name ?? '' })} drawer>
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
