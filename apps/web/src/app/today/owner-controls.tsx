'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
export function DashboardRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="owner-refresh icon-button"
      aria-label={pending ? 'Обновляем данные' : 'Обновить данные'}
      title="Обновить данные"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <Icon name="refresh" />
    </button>
  );
}
export function DashboardDetails({
  title,
  children,
  count,
}: {
  title: string;
  children: ReactNode;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="owner-attention-button" aria-label={title} onClick={() => setOpen(true)}>
        <span>{title}</span>
        <b data-testid="owner-attention-count" data-empty={count === 0}>
          {count}
        </b>
        <Icon name="chevron" width={18} height={18} />
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title={title} drawer>
        <div className="owner-details">{children}</div>
      </Overlay>
    </>
  );
}
