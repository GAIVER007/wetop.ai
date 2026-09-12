'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Notice, Row, Stack } from '../../components/ui';
import { channelAction, retryEventAction, type ChannelActionResult } from './actions';

export function ChannelButtons({ webhookReady }: { webhookReady: boolean }) {
  const [result, setResult] = useState<ChannelActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'setup' | 'sync' | 'pull' | 'flush' | 'webhook-register' | 'webhook-test') =>
    start(async () => setResult(await channelAction(kind)));
  return (
    <Stack gap="sm">
      <Row>
        <Button
          type="button"
          data-testid="channel-pull"
          onClick={() => run('pull')}
          disabled={pending}
        >
          Забрать брони из Channex
        </Button>
        <Button
          type="button"
          data-testid="channel-flush"
          onClick={() => run('flush')}
          disabled={pending}
        >
          Отправить очередь сейчас
        </Button>
        <Button
          type="button"
          tone="secondary"
          data-testid="channel-sync"
          onClick={() => run('sync')}
          disabled={pending}
        >
          Полная выгрузка (365 дней)
        </Button>
        <Button
          type="button"
          tone="secondary"
          data-testid="channel-setup"
          onClick={() => run('setup')}
          disabled={pending}
        >
          Создать объект и категории на staging
        </Button>
        <Button
          type="button"
          tone="secondary"
          data-testid="channel-webhook-register"
          onClick={() => run('webhook-register')}
          disabled={pending || !webhookReady}
          title={webhookReady ? '' : 'нужны PUBLIC_API_URL (https) и CHANNEX_WEBHOOK_SECRET в .env'}
        >
          Зарегистрировать webhook
        </Button>
        <Button
          type="button"
          tone="secondary"
          data-testid="channel-webhook-test"
          onClick={() => run('webhook-test')}
          disabled={pending || !webhookReady}
        >
          Проверить webhook
        </Button>
      </Row>
      {result?.error && <Alert>{result.error}</Alert>}
      {result?.message && <Notice data-testid="channel-result">{result.message}</Notice>}
    </Stack>
  );
}
/**
 * Кнопка у неудачного события. После шести попыток PMS сама больше не пробует — иначе ревизия,
 * которую мы не умеем разобрать, падала бы на каждом опросе, а человек ничего бы не заметил.
 */
export function RetryEventButton({ revisionId }: { revisionId: string }) {
  const [result, setResult] = useState<ChannelActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="row row--inline row--xs">
      <Button
        type="button"
        tone="secondary"
        size="xs"
        data-testid={`retry-event-${revisionId}`}
        onClick={() => start(async () => setResult(await retryEventAction(revisionId)))}
        disabled={pending}
      >
        Обработать заново
      </Button>
      {result?.message && <Notice className="small">{result.message}</Notice>}
      {result?.error && <Alert className="small">{result.error}</Alert>}
    </div>
  );
}
