import 'reflect-metadata';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Попыток входа с одного адреса за 10 минут. Живой администратор столько не наберёт, перебор — упрётся. */
export const LOGIN_ATTEMPTS_PER_IP = 30;
/** Регистраций с одного адреса за час: регистрация заводит организацию и объект, это не бесплатная строка. */
export const REGISTRATIONS_PER_IP = 5;
/** Писем (сброс пароля, повтор подтверждения) с одного адреса за час. */
export const MAIL_REQUESTS_PER_IP = 10;

export const TOO_MANY_ATTEMPTS_MESSAGE =
  'Слишком много попыток с этого адреса. Попробуйте через несколько минут.';
export const PASSWORD_QUEUE_FULL_MESSAGE =
  'Сервер сейчас занят проверкой входов. Попробуйте через минуту.';

/**
 * Счётчик попыток в скользящем окне по ключу (адрес посетителя). В памяти процесса: API один, а перезапуск просто
 * даёт атакующему начать заново — это не обход, а та же скорость.
 *
 * При переполнении вытесняются только окна, чьё время вышло. Прежние лимиты в памяти при переполнении очищались
 * целиком, и атакующий, нагнав новых ключей, сбрасывал и свой счётчик (аудит 25.09, М-4).
 */
export class AttemptWindows {
  private readonly windows = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const since = now - this.windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > since);
    if (hits.length >= this.limit) {
      this.windows.set(key, hits);
      return false;
    }
    hits.push(now);
    this.windows.set(key, hits);
    if (this.windows.size > this.maxKeys) this.prune(since);
    return true;
  }

  private prune(since: number): void {
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

/** Пределы публичных форм входа по адресу посетителя (аудит 26.09, С-5). Один экземпляр на процесс. */
@Injectable()
export class AuthAttemptLimits {
  readonly login = new AttemptWindows(LOGIN_ATTEMPTS_PER_IP, 10 * 60_000);
  readonly register = new AttemptWindows(REGISTRATIONS_PER_IP, 60 * 60_000);
  readonly mail = new AttemptWindows(MAIL_REQUESTS_PER_IP, 60 * 60_000);

  /** Адреса нет (вызов не через стойку и не через туннель) — не считаем: иначе все без адреса делили бы один счётчик. */
  check(windows: AttemptWindows, ip: string | null): void {
    if (ip && !windows.allow(ip))
      throw new HttpException(TOO_MANY_ATTEMPTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
  }
}
