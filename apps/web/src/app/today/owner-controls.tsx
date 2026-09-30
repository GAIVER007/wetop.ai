'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
export function DashboardRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn--secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? 'Обновляем…' : 'Обновить'}
    </button>
  );
}
export function DashboardDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn--secondary" onClick={() => setOpen(true)}>
        {title}
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} title={title} drawer>
        <div className="owner-details">{children}</div>
      </Overlay>
    </>
  );
}
