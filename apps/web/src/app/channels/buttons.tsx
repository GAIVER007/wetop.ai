'use client';
import { useState, useTransition } from 'react';
import { channelAction, type ChannelActionResult } from './actions';

export function ChannelButtons() {
  const [result, setResult] = useState<ChannelActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'setup' | 'sync' | 'pull' | 'flush') =>
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
