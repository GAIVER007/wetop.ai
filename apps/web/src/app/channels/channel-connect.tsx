'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { Alert, Button } from '../../components/ui';
import { connectSessionAction } from './channel-connect-actions';

/**
 * Окно Channex внутри WETOP (ADR-138, channel-iframe.md): подключение, сопоставление комнат и тарифов, включение и
 * выключение канала делает Channex — у каждого канала свои шаги. После закрытия окна список перечитывается.
 */
function useChannexWindow() {
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
      <Overlay open={!!url} onClose={close} title="Менеджер каналов" className="channex-window">
        <p className="note">
          Подключение, сопоставление и включение канала выполняются в менеджере каналов. Закройте
          окно, когда закончите: список каналов обновится.
        </p>
        {url && (
          <iframe
            className="channex-window__frame"
            src={url}
            title="Подключение канала в менеджере каналов"
            data-testid="channex-frame"
          />
        )}
        <Button type="button" tone="secondary" onClick={close}>
          Готово
        </Button>
      </Overlay>
    </>
  );
  return { open, pending, view };
}

export function ConnectChannelButton({
  channel,
  label = 'Подключить канал',
  tone,
  testId = 'channel-connect',
}: {
  channel?: string | undefined;
  label?: string;
  tone?: 'secondary' | undefined;
  testId?: string;
}) {
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
        {w.pending ? 'Открываем…' : label}
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
}: {
  title: string;
  bookingsHref: string;
  channel: string | undefined;
  canManage: boolean;
}) {
  const w = useChannexWindow();
  const items: ActionMenuItem[] = [{ label: 'Брони канала', href: bookingsHref }];
  if (canManage)
    items.push({
      label: 'Настроить канал',
      onSelect: () => w.open(channel),
      disabled: w.pending,
    });
  return (
    <>
      <ActionMenu items={items} label={`Действия: ${title}`} size="sm" />
      {w.view}
    </>
  );
}
