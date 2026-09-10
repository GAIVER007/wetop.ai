'use client';
import { useState, useTransition } from 'react';
import { channelAction, retryEventAction, type ChannelActionResult } from './actions';

export function ChannelButtons({ webhookReady }: { webhookReady: boolean }) {
  const [result, setResult] = useState<ChannelActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'setup' | 'sync' | 'pull' | 'flush' | 'webhook-register' | 'webhook-test') =>
    start(async () => setResult(await channelAction(kind)));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="channel-pull"
          onClick={() => run('pull')}
          disabled={pending}
          style={btn}
        >
          Забрать брони из Channex
        </button>
        <button
          type="button"
          data-testid="channel-flush"
          onClick={() => run('flush')}
          disabled={pending}
          style={btn}
        >
          Отправить очередь сейчас
        </button>
        <button
          type="button"
          data-testid="channel-sync"
          onClick={() => run('sync')}
          disabled={pending}
          style={btnSecondary}
        >
          Полная выгрузка (365 дней)
        </button>
        <button
          type="button"
          data-testid="channel-setup"
          onClick={() => run('setup')}
          disabled={pending}
          style={btnSecondary}
        >
          Создать объект и категории на staging
        </button>
        <button
          type="button"
          data-testid="channel-webhook-register"
          onClick={() => run('webhook-register')}
          disabled={pending || !webhookReady}
          title={webhookReady ? '' : 'нужны PUBLIC_API_URL (https) и CHANNEX_WEBHOOK_SECRET в .env'}
          style={btnSecondary}
        >
          Зарегистрировать webhook
        </button>
        <button
          type="button"
          data-testid="channel-webhook-test"
          onClick={() => run('webhook-test')}
          disabled={pending || !webhookReady}
          style={btnSecondary}
        >
          Проверить webhook
        </button>
      </div>
      {result?.error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
          {result.error}
        </div>
      )}
      {result?.message && (
        <div data-testid="channel-result" style={{ color: '#166534', fontSize: 13 }}>
          {result.message}
        </div>
      )}
    </div>
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
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button
        type="button"
        data-testid={`retry-event-${revisionId}`}
        onClick={() => start(async () => setResult(await retryEventAction(revisionId)))}
        disabled={pending}
        style={{ ...btnSecondary, padding: '3px 8px', fontSize: 12 }}
      >
        Обработать заново
      </button>
      {result?.message && <span style={{ color: '#166534', fontSize: 11 }}>{result.message}</span>}
      {result?.error && (
        <span role="alert" style={{ color: '#b91c1c', fontSize: 11 }}>
          {result.error}
        </span>
      )}
    </span>
  );
}
const btn: React.CSSProperties = {
  padding: '8px 14px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  background: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
