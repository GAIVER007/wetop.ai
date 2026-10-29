'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../../../components/overlay';
import { DateInput } from '../../../../components/date-field';
import { Alert, Button, Field, Input } from '../../../../components/ui';
import { useT } from '../../../../i18n/locale-provider';
import { connectBuilderAction, type ConnectBuilderResult } from './connect-actions';

/** Пробный срок по умолчанию в окне подключения: 14 дней от сегодня, датой «по» включительно */
export function trialUntil(now: Date, days = 14): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Подключение конструктора сайта прямо из «Сайт и SEO» (владелец 29.10.2026: «убери заглушку “Попросить подключить”,
 * открывай окно подключения и настройки при нажатии на кнопку»). Главный администратор WETOP в окне выбирает пробный
 * период до даты или подключение без срока и заметку (номер счёта); сохраняет тот же API, что «Платформа → Организации»,
 * с записью в журнал. Остальным окно объясняет, что подключение включает WETOP, и даёт написать в поддержку.
 */
export function ConnectBuilder({
  locationName,
  expired,
  canConnect,
  organizationId,
  locationId,
  supportHref,
}: {
  locationName: string;
  expired: boolean;
  canConnect: boolean;
  organizationId: string | null;
  locationId: string | null;
  supportHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'TRIAL' | 'ACTIVE'>('TRIAL');
  const [state, action, pending] = useActionState<ConnectBuilderResult | null, FormData>(connectBuilderAction, null);
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);
  return (
    <section className="panel site-off" data-testid="ed-license-off" aria-labelledby="site-off-title">
      <h2 id="site-off-title" className="panel__title">
        {expired ? t('Срок лицензии вышел.') : t('Конструктор сайта не активен для этого филиала.')}
      </h2>
      <p>
        {expired
          ? t('Продлите конструктор для «{name}», и сайт снова можно менять и публиковать.', { name: locationName })
          : t('Подключите конструктор для «{name}», и здесь сразу откроется создание сайта.', { name: locationName })}
      </p>
      <div>
        <Button type="button" onClick={() => setOpen(true)} data-testid="site-connect-open">
          {expired ? t('Продлить') : t('Подключить')}
        </Button>
      </div>
      <Overlay open={open} onClose={() => setOpen(false)} title={t('Подключение конструктора сайта')} size="sm" trapFocus>
        {canConnect && organizationId && locationId ? (
          <form action={action} className="stack site-connect" data-testid="site-connect-form">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="locationId" value={locationId} />
            <input type="hidden" name="status" value={mode} />
            <p>{t('Филиал: {name}', { name: locationName })}</p>
            <div className="site-connect__modes" role="radiogroup" aria-label={t('Как подключить')}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'TRIAL'}
                className="site-connect__mode"
                onClick={() => setMode('TRIAL')}
              >
                <b>{t('Пробный период')}</b>
                <span>{t('До выбранной даты')}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'ACTIVE'}
                className="site-connect__mode"
                onClick={() => setMode('ACTIVE')}
              >
                <b>{t('Оплачен')}</b>
                <span>{t('Без срока или до даты')}</span>
              </button>
            </div>
            <Field label={mode === 'TRIAL' ? t('Действует по (включительно)') : t('Действует по (пусто: без срока)')}>
              <DateInput
                key={mode}
                name="activeUntil"
                defaultValue={mode === 'TRIAL' ? trialUntil(new Date()) : ''}
                required={mode === 'TRIAL'}
              />
            </Field>
            <Field label={t('Заметка, номер счёта')}>
              <Input name="note" maxLength={300} />
            </Field>
            {state && !state.ok && (
              <Alert data-testid="site-connect-error">{state.error}</Alert>
            )}
            <Button type="submit" disabled={pending} data-testid="site-connect-save">
              {t('Подключить')}
            </Button>
          </form>
        ) : (
          <div className="stack" data-testid="site-connect-ask">
            <p>{t('Конструктор сайта подключает команда WETOP. Напишите нам, и мы включим его для «{name}».', { name: locationName })}</p>
            <a className="btn" href={supportHref} {...(supportHref.startsWith('/') ? {} : { target: '_blank', rel: 'noreferrer' })}>
              {t('Написать в WETOP')}
            </a>
          </div>
        )}
      </Overlay>
    </section>
  );
}
