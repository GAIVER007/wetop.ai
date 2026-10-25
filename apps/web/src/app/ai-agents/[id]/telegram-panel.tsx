'use client';
import { useEffect, useState, useTransition } from 'react';
import type { TelegramStatusView } from '../../../lib/api';
import { telegramAction } from './actions';
import { Input } from '../../../components/ui';
import { msg, translator, type Translate } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
/** ID тестировщиков: только числа, без повторов, не больше 20 (как обещает подсказка у поля); `t` даёт язык человека */
export const MAX_TESTERS = 20;
export function parseTesterIds(raw: string, t: Translate = translator('ru')): { ids: string[]; error: string | null } {
  const parts = raw.split(/[\s,;]+/).filter(Boolean);
  const bad = parts.filter((p) => !/^\d{3,15}$/.test(p));
  if (bad.length)
    return {
      ids: [],
      error: t('Это не числовой Telegram ID: {ids}. Узнать ID поможет бот @userinfobot.', { ids: bad.slice(0, 3).join(', ') }),
    };
  const ids = [...new Set(parts)];
  if (ids.length > MAX_TESTERS)
    return { ids: [], error: t('Тестировщиков не больше {max}, указано {n}.', { max: MAX_TESTERS, n: ids.length }) };
  return { ids, error: null };
}
const words: Record<TelegramStatusView['state'], string> = {
  NOT_CONNECTED: msg('Не подключён'),
  CONFIGURED: msg('Приём остановлен'),
  CONNECTING: msg('Подключается'),
  CONNECTED: msg('Подключён'),
  ERROR: msg('Нужна проверка'),
};
export function TelegramPanel({ id, readOnly }: { id: string; readOnly: boolean }) {
  const t = useT();
  const [status, setStatus] = useState<TelegramStatusView | null>(null);
  const [token, setToken] = useState('');
  const [ids, setIds] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, start] = useTransition();
  const pending = loading || saving;
  useEffect(() => {
    let active = true;
    telegramAction(id, 'status')
      .then((result) => {
        if (!active) return;
        if (result.ok && 'value' in result) {
          setStatus(result.value);
          setIds((result.value.allowedUserIds ?? []).join(', '));
        } else if (!result.ok) setMessage(result.error);
      })
      .catch(() => {
        if (active) setMessage(t('Не удалось загрузить состояние подключения. Повторите проверку.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const run = (action: 'status' | 'check' | 'connect' | 'disconnect') =>
    start(async () => {
      setMessage('');
      const testers = parseTesterIds(ids, t);
      if (action === 'connect' && testers.error) {
        setMessage(testers.error);
        return;
      }
      const result = await telegramAction(id, action, token.trim(), testers.ids);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if ('check' in result && result.check) {
        setMessage(
          !result.check.valid
            ? t('Токен не прошёл проверку.')
            : result.check.conflict
              ? t('Бот подключён к другому сервису. Сначала отключите его там.')
              : t('Бот @{username} найден. Теперь подключите его.', { username: String(result.check.username) }),
        );
      } else if ('value' in result && result.value) {
        setStatus(result.value);
        setIds((result.value.allowedUserIds ?? []).join(', '));
        if (action === 'connect') {
          setToken('');
          setMessage(t('Подключение сохранено. Откройте бота и отправьте тестовое сообщение.'));
        }
        if (action === 'disconnect')
          setMessage(t('Ответы остановлены. Webhook остаётся закреплён за WETOP.'));
      }
    });
  return (
    <section className="panel agent-telegram" aria-labelledby="telegram-heading">
      <div className="agent-telegram__head">
        <div>
          <h2 id="telegram-heading">{t('Тест агента в Telegram')}</h2>
          <p>{t('Подключите своего бота. Ответы доступны только указанным тестировщикам.')}</p>
        </div>
        <button className="btn btn--secondary" disabled={pending} onClick={() => run('status')}>
          {pending ? t('Подождите…') : t('Проверить состояние')}
        </button>
      </div>
      <p>
        {status
          ? t(words[status.state])
          : loading
            ? t('Загружаем сохранённое подключение…')
            : t('Состояние подключения недоступно')}
        {status?.username && (
          <>
            {' '}
            ·{' '}
            <a
              href={`https://t.me/${encodeURIComponent(status.username)}`}
              target="_blank"
              rel="noreferrer"
            >
              @{status.username}
            </a>
          </>
        )}
      </p>
      <div className="agent-telegram__fields">
        <label>
          {t('Токен из @BotFather')}
          <Input
            type="password"
            autoComplete="off"
            value={token}
            maxLength={256}
            disabled={pending || readOnly}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              status?.username
                ? t('Токен сохранён, новый нужен только для замены')
                : t('Вставьте токен бота')
            }
          />
        </label>
        <label>
          {t('Telegram ID тестировщиков')}
          <Input
            value={ids}
            disabled={pending || readOnly}
            onChange={(e) => setIds(e.target.value)}
            placeholder="123456789, 987654321"
            inputMode="numeric"
            aria-invalid={ids.trim() !== '' && parseTesterIds(ids).error !== null}
          />
          <small>{t('Числовые ID, не @имена. До 20 человек.')}</small>
        </label>
      </div>
      <p className="muted">
        {t(
          '«Проверить токен» не сохраняет его: нажмите «Подключить бота». Сохранённый токен не возвращается в поле после перезагрузки. Токен хранится на сервере в зашифрованном виде. Для замены настроек введите его снова. Тестовый канал пока не создаёт брони.',
        )}
      </p>
      <div className="agent-telegram__actions">
        <button
          className="btn btn--secondary"
          disabled={pending || readOnly || !token.trim()}
          onClick={() => run('check')}
        >
          {t('Проверить токен')}
        </button>
        <button
          className="btn btn--primary"
          disabled={pending || readOnly || !token.trim() || !ids.trim()}
          onClick={() => run('connect')}
        >
          {t('Подключить бота')}
        </button>
        {status?.state === 'CONNECTED' && (
          <button
            className="btn btn--secondary"
            disabled={pending || readOnly}
            onClick={() => run('disconnect')}
          >
            {t('Остановить ответы')}
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {status?.error && (
        <p role="alert">
          {t('Последний обмен завершился ошибкой. Проверьте диалог перед повторной отправкой сообщения.')}
        </p>
      )}
      {status?.lastReceivedAt && (
        <p className="muted">{t('Последнее входящее: {at}', { at: new Date(status.lastReceivedAt).toLocaleString('ru-RU') })}</p>
      )}
      {status?.lastSentAt && (
        <p className="muted">{t('Последний ответ: {at}', { at: new Date(status.lastSentAt).toLocaleString('ru-RU') })}</p>
      )}
    </section>
  );
}
