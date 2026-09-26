import 'reflect-metadata';
import { HttpException, HttpStatus } from '@nestjs/common';
import { hashPasswordAsync, verifyPasswordAsync } from '@pms/domain';

export const PASSWORD_QUEUE_FULL_MESSAGE =
  'Сервер сейчас занят проверкой входов. Попробуйте через минуту.';

/**
 * Счётчик попыток в скользящем окне по ключу (адрес посетителя). В памяти процесса: API один, а перезапуск просто
 * даёт атакующему начать заново — это не обход, а та же скорость.
 *
 * Память ограничена `maxKeys`. При переполнении вытесняются только окна, чьё время вышло: прежние лимиты в памяти
 * очищались целиком, и атакующий, нагнав новых ключей, сбрасывал и свой счётчик (аудит 25.09, М-4). Если и после этого
 * места нет, новый ключ получает отказ, а известные считаются как прежде. Уборка идёт не чаще раза в десятую долю окна:
 * обход всех ключей на каждой попытке сам становился отказом в обслуживании (проверка исправлений 26.09).
 */
export class AttemptWindows {
  private readonly windows = new Map<string, number[]>();
  private lastPrune = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const known = this.windows.get(key);
    if (!known && this.windows.size >= this.maxKeys) {
      this.prune(since, now);
      if (this.windows.size >= this.maxKeys) return false;
    }
    const hits = (known ?? []).filter((t) => t > since);
    if (hits.length >= this.limit) {
      this.windows.set(key, hits);
      return false;
    }
    hits.push(now);
    this.windows.set(key, hits);
    return true;
  }

  /** Предел уже исчерпан — проверка без записи новой попытки: засчитывают потом, когда попытка удалась */
  full(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    return (this.windows.get(key) ?? []).filter((t) => t > since).length >= this.limit;
  }

  /** Вернуть занятое место: попытка, взятая заранее, не удалась и в предел не засчитывается */
  release(key: string, at: number): void {
    const hits = this.windows.get(key);
    const i = hits?.lastIndexOf(at) ?? -1;
    if (hits && i >= 0) hits.splice(i, 1);
  }

  /** Сколько ключей в памяти — для проверок */
  get size(): number {
    return this.windows.size;
  }

  private prune(since: number, now: number): void {
    if (now - this.lastPrune < Math.max(1_000, this.windowMs / 10)) return;
    this.lastPrune = now;
    for (const [key, hits] of this.windows) {
      if (hits.every((t) => t <= since)) this.windows.delete(key);
    }
  }
}

/**
 * Очередь дорогих проверок пароля. scrypt считается в пуле потоков Node (четыре потока, общих с DNS и файлами), и без
 * предела поток попыток занимал бы его целиком. Сверх очереди — сразу 429, без вычисления.
 */
export class PasswordGate {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly concurrency = 2,
    private readonly queueLimit = 64,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      if (this.waiting.length >= this.queueLimit)
        throw new HttpException(PASSWORD_QUEUE_FULL_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
      await new Promise<void>((go) => this.waiting.push(go));
    } else {
      this.running += 1;
    }
    try {
      return await work();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.running -= 1;
    }
  }
}

/**
 * Одна очередь на весь процесс для любого scrypt: вход, регистрация, сброс и смена пароля (аудит 26.09, С-5). Раньше
 * через очередь шёл только вход, а регистрация считала хеш синхронно в главном потоке.
 */
const passwordGate = new PasswordGate();
export const verifyPasswordQueued = (raw: string, stored: string): Promise<boolean> =>
  passwordGate.run(() => verifyPasswordAsync(raw, stored));
export const hashPasswordQueued = (raw: string): Promise<string> =>
  passwordGate.run(() => hashPasswordAsync(raw));

/**
 * Ключ счётчика по адресу посетителя. IPv6 — по сети /64: столько адресов у одного абонента, и перебор адресов внутри
 * неё иначе обходил бы любой предел (проверка исправлений 26.09). IPv4 и IPv4 внутри IPv6 — как есть.
 */
export function visitorKey(ip: string): string {
  const value = ip.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) return mapped[1]!;
  if (!value.includes(':')) return value;
  const [head = '', tail = ''] = value.split('::', 2);
  const left = head ? head.split(':') : [];
  const right = value.includes('::') && tail ? tail.split(':') : [];
  const groups = value.includes('::')
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, '') || '0')
    .join(':')}::/64`;
}
