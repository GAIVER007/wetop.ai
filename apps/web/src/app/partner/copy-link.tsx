'use client';
import { useState } from 'react';
import { Button, Input } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';

/** Ссылка в поле и «Скопировать» */
export function CopyLink({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="row partner__copy">
      <Input readOnly value={value} aria-label={t('Ссылка')} data-testid="partner-link-value" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setDone(true), () => setDone(false));
        }}
      >
        {done ? t('Скопировано') : t('Скопировать')}
      </Button>
    </div>
  );
}
