'use client';
import { useState, useTransition } from 'react';
import type { TelegramStatusView } from '../../../lib/api';
import { telegramAction } from './actions';
const words: Record<TelegramStatusView['state'], string> = {
  NOT_CONNECTED: 'Не подключён', CONFIGURED: 'Приём остановлен', CONNECTING: 'Подключается', CONNECTED: 'Подключён', ERROR: 'Нужна проверка',
};
export function TelegramPanel({id, readOnly}: {id: string; readOnly: boolean}) {
  const [status, setStatus] = useState<TelegramStatusView | null>(null);
  const [token, setToken] = useState('');
  const [ids, setIds] = useState('');
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  const run = (action: 'status' | 'check' | 'connect' | 'disconnect') => start(async () => {
    setMessage('');
    const result = await telegramAction(id, action, token, ids.split(/[\s,;]+/).filter(Boolean));
    if (!result.ok) { setMessage(result.error); return; }
    if ('check' in result && result.check) {
      setMessage(!result.check.valid ? 'Токен не прошёл проверку.' : result.check.conflict ? 'Бот подключён к другому сервису. Сначала отключите его там.' : `Бот @${result.check.username} найден. Теперь подключите его.`);
    } else if ('value' in result && result.value) {
      setStatus(result.value); setIds((result.value.allowedUserIds ?? []).join(', '));
      if (action === 'connect') { setToken(''); setMessage('Подключение сохранено. Откройте бота и отправьте тестовое сообщение.'); }
      if (action === 'disconnect') setMessage('Ответы остановлены. Webhook остаётся закреплён за WETOP.');
    }
  });
  return <section className="card" aria-labelledby="telegram-heading" style={{padding:24}}>
    <div style={{display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
      <div><h2 id="telegram-heading">Telegram · тест агента</h2><p>Подключите своего бота. Ответы доступны только указанным тестировщикам.</p></div>
      <button className="btn btn--secondary" disabled={pending} onClick={() => run('status')}>{pending ? 'Подождите…' : 'Проверить состояние'}</button>
    </div>
    <p>{status ? words[status.state] : 'Состояние ещё не проверено'}{status?.username && <> · <a href={`https://t.me/${encodeURIComponent(status.username)}`} target="_blank" rel="noreferrer">@{status.username}</a></>}</p>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap:16}}>
      <label>Токен из @BotFather<input type="password" autoComplete="off" value={token} maxLength={256} disabled={pending || readOnly} onChange={e => setToken(e.target.value)} placeholder="Вставьте токен бота" /></label>
      <label>Telegram ID тестировщиков<input value={ids} disabled={pending || readOnly} onChange={e => setIds(e.target.value)} placeholder="123456789, 987654321" /><small>Числовые ID, не @имена. До 20 человек.</small></label>
    </div>
    <p className="muted">Токен хранится на сервере в зашифрованном виде. Для замены настроек введите его снова. Тестовый канал пока не создаёт брони.</p>
    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
      <button className="btn btn--secondary" disabled={pending || readOnly || !token.trim()} onClick={() => run('check')}>Проверить токен</button>
      <button className="btn btn--primary" disabled={pending || readOnly || !token.trim() || !ids.trim()} onClick={() => run('connect')}>Подключить бота</button>
      {status?.state === 'CONNECTED' && <button className="btn btn--secondary" disabled={pending || readOnly} onClick={() => run('disconnect')}>Остановить ответы</button>}
    </div>
    {message && <p role="status">{message}</p>}
    {status?.error && <p role="alert">Последний обмен завершился ошибкой. Проверьте диалог перед повторной отправкой сообщения.</p>}
    {status?.lastReceivedAt && <p>Последнее входящее: {new Date(status.lastReceivedAt).toLocaleString('ru-RU')}</p>}
    {status?.lastSentAt && <p>Последний ответ: {new Date(status.lastSentAt).toLocaleString('ru-RU')}</p>}
  </section>;
}
