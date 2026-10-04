'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/icon';
import { Field, Input } from '../../components/ui';
export function DateBar({ date, path }: { date: string; path: string }) {
  const router = useRouter();
  const shift = (n: number) => {
    const at = new Date(`${date}T12:00:00Z`);
    at.setUTCDate(at.getUTCDate() + n);
    return `${path}?date=${at.toISOString().slice(0, 10)}`;
  };
  return (
    <div className="beauty-date-bar">
      <Link className="btn btn--secondary" href={path}>
        Сегодня
      </Link>
      <Link className="btn btn--ghost" href={shift(-1)} aria-label="Предыдущий день">
        <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} />
      </Link>
      <Field label="Дата">
        <Input
          type="date"
          value={date}
          data-testid="beauty-day-date"
          onChange={(e) => {
            if (e.target.value) router.push(`${path}?date=${e.target.value}`);
          }}
        />
      </Field>
      <Link className="btn btn--ghost" href={shift(1)} aria-label="Следующий день">
        <Icon name="chevron" />
      </Link>
    </div>
  );
}
