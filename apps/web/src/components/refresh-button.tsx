'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { msg } from '../i18n';
import { useT } from '../i18n/locale-provider';
import { Button } from './ui';

export function RefreshButton({ label = msg('Обновить') }: { label?: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      tone="secondary"
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? t('Проверяем…') : t(label)}
    </Button>
  );
}
