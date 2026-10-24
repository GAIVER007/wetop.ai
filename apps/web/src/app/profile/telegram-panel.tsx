'use client';
import { useState, useTransition } from 'react';
import { Icon } from '../../components/icon';
import { Switch } from '../../components/switch';
import { Alert, Badge, Button, Notice, Row } from '../../components/ui';
import type { StaffTelegramStatus } from '../../lib/api';
import {
  telegramCodeAction,
  telegramDisconnectAction,
  telegramRefreshAction,
  telegramSiteBookingsAction,
  telegramTestAction,
  type TelegramActionResult,
} from './telegram-actions';

export const BOT_PENDING_TEXT = 'Бот WETOP подключается администратором платформы';

/**
 * «Уведомления» в настройках рабочего места (STAFF-TG-20261020, план plans/staff-telegram-notifications-2026-10-20.md):
 * свой Telegram для сообщений о бронях и записях с сайта. Собрано из общих компонентов (`Panel`-разметка `.panel`,
 * `Badge`, `Switch`, `Button`, `Notice`, `Alert`), своих стилей нет (DESIGN.md §8).
 */
export function TelegramNotifications({ initial }: { initial: StaffTelegramStatus | null }) {
  const [status, setStatus] = useState<StaffTelegramStatus | null>(initial);
  const [link, setLink] = useState<TelegramActionResult['link'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (name: string, action: () => Promise<TelegramActionResult>) => {
    setPending(name);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await action();
      setPending(null);
      setError(r.error);
      setMessage(r.message);
      if (r.status) setStatus(r.status);
      if (r.link) setLink(r.link);
      if (r.status?.link) setLink(null);
    });
  };

  if (!status)
    return (
      <section className="panel" data-testid="profile-telegram">
        <h2 className="section-title">Уведомления в Telegram</h2>
        <p className="muted">Состояние уведомлений видно после входа.</p>
      </section>
    );

  const connected = status.link;
  const botReady = status.botConfigured;
  return (
    <section className="panel" data-testid="profile-telegram" aria-busy={pending !== null}>
      <span className="round-icon">
        <Icon name="send" />
      </span>
      <h2 className="section-title">Уведомления в Telegram</h2>
      <p className="muted">
        Новые брони и записи с сайта WETOP приходят вам в личный чат с ботом: кто, когда, что и телефон гостя. Кнопка в
        сообщении открывает бронь в WETOP.
      </p>
      <p>
        {connected ? (
          <Badge tone="ok" data-testid="telegram-state">
            Подключено{connected.username ? `: @${connected.username}` : ''}
          </Badge>
        ) : (
          <Badge tone="neutral" data-testid="telegram-state">
            Не подключено
          </Badge>
        )}
      </p>

      {!botReady && (
        <Notice tone="muted" data-testid="telegram-bot-pending">
          {BOT_PENDING_TEXT}
        </Notice>
      )}

      {connected ? (
        <>
          <Switch
            name="siteBookings"
            label="Брони с сайта"
            hint="Брони, записи и заявки с сайта филиалов, где вы видите брони"
            checked={connected.siteBookings}
            disabled={pending !== null}
            onChange={(on) => run('switch', () => telegramSiteBookingsAction(on))}
          />
          <Row>
            <Button
              tone="secondary"
              disabled={!botReady || pending !== null}
              aria-busy={pending === 'test'}
              onClick={() => run('test', telegramTestAction)}
            >
              {pending === 'test' ? 'Отправляю…' : 'Проверить'}
            </Button>
            <Button
              tone="ghost"
              disabled={pending !== null}
              aria-busy={pending === 'disconnect'}
              onClick={() => run('disconnect', telegramDisconnectAction)}
            >
              {pending === 'disconnect' ? 'Отключаю…' : 'Отключить'}
            </Button>
          </Row>
        </>
      ) : (
        <>
          <Row>
            <Button
              disabled={!botReady || pending !== null}
              aria-busy={pending === 'code'}
              onClick={() => run('code', telegramCodeAction)}
            >
              {pending === 'code' ? 'Готовлю ссылку…' : 'Подключить Telegram'}
            </Button>
          </Row>
          {link && (
            <div data-testid="telegram-link">
              <p>
                Откройте ссылку и нажмите «Запустить» в Telegram. Ссылка действует 15 минут, код{' '}
                <strong translate="no">{link.code}</strong>.
              </p>
              <Row>
                <a className="btn btn--secondary" href={link.url} target="_blank" rel="noopener noreferrer">
                  Открыть Telegram
                  <Icon name="external" width={16} />
                </a>
                <Button tone="ghost" disabled={pending !== null} onClick={() => run('refresh', telegramRefreshAction)}>
                  {pending === 'refresh' ? 'Проверяю…' : 'Я подключил'}
                </Button>
              </Row>
            </div>
          )}
        </>
      )}

      {error && <Alert>{error}</Alert>}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </section>
  );
}
