'use client';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Select } from '../../components/ui';
import { shiftDate } from '../../lib/food-data';
import type { FoodWorkspace } from '../../lib/food-types';
export function DayToolbar({
  data,
  floor,
  period,
  setPeriod,
}: {
  data: FoodWorkspace;
  floor: boolean;
  period: string;
  setPeriod: (v: string) => void;
}) {
  const router = useRouter();
  const path = floor ? '/floor-plan' : '/table-reservations';
  function go(date: string, time?: string) {
    const q = new URLSearchParams({ date });
    if (time) q.set('time', time);
    router.push(`${path}?${q}`);
  }
  return (
    <div className="food-toolbar">
      <div className="food-date">
        <Button
          tone="secondary"
          aria-label="Предыдущий день"
          onClick={() => go(shiftDate(data.date, -1))}
        >
          ←
        </Button>
        <Input
          type="date"
          aria-label="Дата плана"
          value={data.date}
          onChange={(e) => e.target.value && go(e.target.value)}
        />
        <Button
          tone="secondary"
          aria-label="Следующий день"
          onClick={() => go(shiftDate(data.date, 1))}
        >
          →
        </Button>
      </div>
      <Field label="Период">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Все</option>
          {data.periods
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </Field>
      {floor && (
        <Field label="Время плана">
          <Input
            type="time"
            value={data.time}
            onChange={(e) => e.target.value && go(data.date, e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
