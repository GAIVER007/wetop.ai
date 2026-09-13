'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui';

export function RefreshButton({ label = 'Обновить' }: { label?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      tone="secondary"
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? 'Проверяем…' : label}
    </Button>
  );
}
