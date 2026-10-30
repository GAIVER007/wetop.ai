'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateRangePopover } from '../../components/date-range-popover';

/**
 * Период «Истории действий» тем же окном, что в Журнале (владелец 30.10.2026). Применение меняет только from и to:
 * раздел риска, сотрудник и поиск остаются, страница листается заново с первой строки.
 */
export function JournalPeriod({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <DateRangePopover
      from={from}
      to={to}
      today={today}
      compact
      triggerTestId="journal-period"
      onApply={(range) => {
        const next = new URLSearchParams(params.toString());
        next.set('from', range.from);
        next.set('to', range.to);
        next.delete('cursor');
        router.push(`/journal?${next.toString()}`);
      }}
    />
  );
}
