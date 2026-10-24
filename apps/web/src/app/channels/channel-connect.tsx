'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { Alert, Button, Notice } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import { connectSessionAction, loadFutureReservationsAction } from './channel-connect-actions';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

/**
 * Окно Channex внутри WETOP (ADR-140, channel-iframe.md): подключение, сопоставление комнат и тарифов, включение и
 * выключение канала делает Channex — у каждого канала свои шаги. После закрытия окна список перечитывается.
 */
function useChannexWindow() {
  const t = useT();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = (channel?: string) =>
    start(async () => {
      setError(null);
      const r = await connectSessionAction(channel);
      if (r.url) setUrl(r.url);
      else setError(r.error);
    });
  const close = () => {
    setUrl(null);
    router.refresh();
  };
  const view = (
    <>
      {error && (
        <Alert boxed data-testid="channex-window-error">
          {error}
        </Alert>
      )}
      <Overlay open={!!url} onClose={close} title={t('Менеджер каналов')} className="channex-window">
        <p className="note">
          {t('Подключение, сопоставление и включение канала выполняются в менеджере каналов. Закройте окно, когда закончите: список каналов обновится.')}
        </p>
        {url && (
          <iframe
            className="channex-window__frame"
            src={url}
            title={t('Подключение канала в менеджере каналов')}
            data-testid="channex-frame"
          />
        )}
        <Button type="button" tone="secondary" onClick={close}>
          {t('Готово')}
        </Button>
      </Overlay>
    </>
  );
  return { open, pending, view };
}

export function ConnectChannelButton({
  channel,
  label = msg('Подключить канал'),
  tone,
  testId = 'channel-connect',
}: {
  channel?: string | undefined;
  label?: string;
  tone?: 'secondary' | undefined;
  testId?: string;
}) {
  const t = useT();
  const w = useChannexWindow();
  return (
    <>
      <Button
        type="button"
        tone={tone}
        data-testid={testId}
        disabled={w.pending}
        onClick={() => w.open(channel)}
      >
        {w.pending ? t('Открываем…') : t(label)}
      </Button>
      {w.view}
    </>
  );
}

export function ChannelRowActions({
  title,
  bookingsHref,
  channel,
  canManage,
  connectionId,
  canLoadFuture = false,
}: {
  title: string;
  bookingsHref: string;
  channel: string | undefined;
  canManage: boolean;
  connectionId?: string;
  /** У канала есть действие `load_future_reservations` (Booking.com, Expedia, Airbnb) */
  canLoadFuture?: boolean;
}) {
  const t = useT();
  const w = useChannexWindow();
  const { ask, dialog } = useConfirm();
  const [result, setResult] = useState<{ message: string | null; error: string | null } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const loadFuture = async () => {
    if (!connectionId) return;
    const ok = await ask({
      title: t('Подтянуть будущие брони {title}?', { title }),
      body: t('Канал отдаст брони, которые у него уже есть. Они придут как обычные брони из канала, без дублей: уже принятые не задвоятся.'),
      confirmLabel: t('Подтянуть брони'),
    });
    if (ok) start(async () => setResult(await loadFutureReservationsAction(connectionId)));
  };
  const items: ActionMenuItem[] = [{ label: t('Брони канала'), href: bookingsHref }];
  if (canManage)
    items.push({
      label: t('Настроить канал'),
      onSelect: () => w.open(channel),
      disabled: w.pending,
    });
  if (canManage && canLoadFuture && connectionId)
    items.push({ label: t('Подтянуть будущие брони'), onSelect: () => void loadFuture(), disabled: pending });
  return (
    <>
      <ActionMenu items={items} label={t('Действия: {title}', { title })} size="sm" />
      {result?.message && (
        <Notice data-testid="channel-load-future-result">{result.message}</Notice>
      )}
      {result?.error && (
        <Alert boxed data-testid="channel-load-future-error">
          {result.error}
        </Alert>
      )}
      {w.view}
      {dialog}
    </>
  );
}
