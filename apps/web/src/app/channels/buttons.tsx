'use client';
import { useState, useTransition } from 'react';
import { Alert, Button, Notice, Row, Stack } from '../../components/ui';
import { channelAction, retryEventAction, type ChannelActionResult } from './actions';

/**
 * Ручные действия по каналам.
 *
 * 21.09.2026: шесть кнопок стояли одним рядом без иерархии — ежедневные вперемешку с настройкой
 * подключения, и «Полная выгрузка (500 дней)» выглядела так же, как «Забрать брони». Теперь две
 * группы с подписями, и причина, по которой кнопка недоступна, написана словами, а не спрятана в
 * `title` (DESIGN.md §8: «пункт с причиной»). Сами команды, их порядок и адреса не менялись —
 * на этих `data-testid` стоит запись показа для сертификации Channex.
 */
export function ChannelButtons({
  webhookReady,
  configured,
  connected,
}: {
  webhookReady: boolean;
  configured: boolean;
  connected: boolean;
}) {
  const [result, setResult] = useState<ChannelActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (kind: 'setup' | 'sync' | 'pull' | 'flush' | 'webhook-register' | 'webhook-test') =>
    start(async () => setResult(await channelAction(kind)));
  // Одна причина на группу: без соединения не работает ничего, без ключа — настройка, без адреса — webhook
  const noConnection = !connected ? 'Нет соединения с Channex — проверьте ключ и подключение.' : '';
  return (
    <Stack gap="sm">
      <section className="channel-actions" aria-label="Обмен с каналами">
        <h3 className="channel-actions__title">Обмен прямо сейчас</h3>
        <Row>
          <Button
            type="button"
            data-testid="channel-flush"
            onClick={() => run('flush')}
            disabled={pending || !connected}
          >
            Отправить очередь сейчас
          </Button>
          <Button
            tone="secondary"
            type="button"
            data-testid="channel-pull"
            onClick={() => run('pull')}
            disabled={pending || !connected}
          >
            Забрать брони из Channex
          </Button>
        </Row>
        {noConnection && <p className="note">{noConnection}</p>}
      </section>
      <section className="channel-actions" id="channel-setup" aria-label="Настройка подключения">
        <h3 className="channel-actions__title">Настройка подключения</h3>
        <Row>
          <Button
            type="button"
            tone="secondary"
            data-testid="channel-setup"
            onClick={() => run('setup')}
            disabled={pending || !configured}
          >
            Создать объект и категории
          </Button>
          <Button
            type="button"
            tone="secondary"
            data-testid="channel-webhook-register"
            onClick={() => run('webhook-register')}
            disabled={pending || !connected || !webhookReady}
          >
            Зарегистрировать webhook
          </Button>
          <Button
            type="button"
            tone="secondary"
            data-testid="channel-webhook-test"
            onClick={() => run('webhook-test')}
            disabled={pending || !connected || !webhookReady}
          >
            Проверить webhook
          </Button>
          <Button
            type="button"
            tone="secondary"
            data-testid="channel-sync"
            onClick={() => run('sync')}
            disabled={pending || !connected}
          >
            Полная выгрузка (500 дней)
          </Button>
        </Row>
        <p className="note">
          {!configured && 'Ключ Channex не задан на сервере — объект и категории создать нельзя. '}
          {!webhookReady &&
            'Для webhook нужны публичный HTTPS-адрес (PUBLIC_API_URL) и секрет на сервере. '}
          Полная выгрузка отправляет цены и остатки за 500 дней по всем категориям: это долго и
          нужно после смены тарифов или первой настройки.
        </p>
      </section>
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
