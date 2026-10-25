'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useT } from '../../i18n/locale-provider';
export function DashboardRefresh({ label }: { label?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className={label ? 'btn btn--secondary' : 'owner-refresh icon-button'}
      aria-label={pending ? t('Обновляем данные') : (label ?? t('Обновить данные'))}
      aria-busy={pending}
      title={t('Обновить данные')}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <Icon name="refresh" />
      {label && <span>{pending ? t('Обновляем…') : label}</span>}
    </button>
  );
}
export function DashboardDetails({
  title,
  label,
  children,
  count,
}: {
  title: string;
  /** подпись кнопки, если отличается от заголовка панели («Все задачи» в обзоре бизнеса) */
  label?: string;
  children: ReactNode;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="owner-attention-button"
        aria-label={label ?? title}
        onClick={() => setOpen(true)}
      >
        <span>{label ?? title}</span>
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

export function ForecastDetails({ children }: { children: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="owner-outlook-open"
        aria-label={t('Загрузка по дням')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {t('По дням')} <Icon name="chevron" width={14} height={14} />
      </button>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        title={t('Ближайшие 7 дней')}
        drawer
        className="owner-forecast-dialog"
      >
        {children}
      </Overlay>
    </>
  );
}
