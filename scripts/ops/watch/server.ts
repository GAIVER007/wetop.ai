/**
 * «Сторож сторожа» — сервер (plans/slice-12-guard-server.md, шаг 12.1). Запуск: `node server.ts` (Node 24, без сборки).
 *
 *   POST /heartbeat   сигнал от сторожа в API (Authorization: Bearer <WATCH_SECRET>), в теле только числа
 *   GET  /health      жив ли сервер и сколько секунд назад был последний сигнал (без чисел неисправностей)
 *
 * Окружение (вписывает владелец на сервере, агент значения не видит):
 *   WATCH_SECRET         общий секрет с GUARD_HEARTBEAT_SECRET на Mac
 *   TELEGRAM_BOT_TOKEN   токен бота; TELEGRAM_CHAT_ID — номер группы дежурных (можно несколько через запятую)
 *   PORT                 по умолчанию 8080
 * Состояние в памяти: после перезапуска контейнера отсчёт тишины начинается заново (тревога — через 5 минут без сигнала).
 */
import { createServer } from 'node:http';
import {
  authorized,
  initialState,
  onBeat,
  onTimer,
  parseBeat,
  type WatchState,
} from './watch-logic.ts';

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.WATCH_SECRET ?? '';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
const CHATS = (process.env.TELEGRAM_CHAT_ID ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_BODY = 4096;

let state: WatchState = initialState(new Date());

function log(text: string): void {
  console.log(`${new Date().toISOString()} ${text}`);
}

/** Telegram sendMessage (docs/telegram/README.md): каждому чату отдельно, без разметки, токен в текст ошибок не попадает */
async function send(messages: string[]): Promise<void> {
  for (const text of messages) {
    log(`тревога: ${text}`);
    if (!TOKEN || CHATS.length === 0) {
      log(
        'Telegram не настроен (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — сообщение только в журнал',
      );
      continue;
    }
    for (const chat of CHATS) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4096) }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) log(`Telegram ответил HTTP ${res.status} для чата ${chat}`);
      } catch (e) {
        log(`Telegram недоступен: ${(e as Error).message.split(TOKEN).join('<токен>')}`);
      }
    }
  }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const age = state.lastBeatAt
      ? Math.round((Date.now() - state.lastBeatAt.getTime()) / 1000)
      : null;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, lastBeatSecondsAgo: age }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/heartbeat') {
    res.writeHead(404).end();
    return;
  }
  if (!authorized(req.headers.authorization, SECRET)) {
    res.writeHead(401).end();
    return;
  }
  let size = 0;
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > MAX_BODY) req.destroy();
    else chunks.push(c);
  });
  req.on('end', () => {
    let body: unknown = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      /* не JSON — ниже 400 */
    }
    const beat = parseBeat(body);
    if (!beat) {
      res.writeHead(400).end();
      return;
    }
    const step = onBeat(state, beat, new Date());
    state = step.state;
    res.writeHead(204).end();
    void send(step.messages);
  });
});

setInterval(() => {
  const step = onTimer(state, new Date());
  state = step.state;
  void send(step.messages);
}, 30_000).unref();

if (!SECRET)
  log(
    'WATCH_SECRET не задан — сигналы не принимаются (401), тревога о тишине сработает через 5 минут',
  );
server.listen(PORT, () => log(`сторож сторожа слушает :${PORT}`));
