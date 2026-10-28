import { LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from '@pms/domain';
import { visitorKey } from './attempt-limits';

/**
 * Замок входа по паре «почта + адрес устройства» (владелец 27.10.2026). 5 промахов подряд с одного адреса запирают
 * этот адрес для этой почты на 15 минут; верный пароль с другого адреса входит. Так посторонний, вводя чужую почту,
 * больше не запирает вход хозяину, а подбор с одного адреса стоит, как раньше. В памяти процесса, как лимиты по адресу
 * (`AttemptWindows`): API один, перезапуск лишь даёт начать заново с той же скоростью. Адрес нигде не сохраняется.
 */
export class LoginGuard {
  private readonly entries = new Map<string, { fails: number; lockedUntil: number }>();

  constructor(private readonly maxKeys = 50_000) {}

  private key(email: string, ip: string): string {
    return `${email.trim().toLowerCase()}|${visitorKey(ip)}`;
  }

  locked(email: string, ip: string | null | undefined, now: Date): boolean {
    if (!ip) return false;
    const entry = this.entries.get(this.key(email, ip));
    return entry !== undefined && entry.lockedUntil > now.getTime();
  }

  fail(email: string, ip: string | null | undefined, now: Date): void {
    if (!ip) return;
    const key = this.key(email, ip);
    const prev = this.entries.get(key);
    // замок истёк: счёт сначала, иначе одна ошибка раз в 15 минут держала бы адрес запертым (как аудит 26.09, С-6)
    const fails = prev && !(prev.lockedUntil !== 0 && prev.lockedUntil <= now.getTime()) ? prev.fails + 1 : 1;
    if (!prev && this.entries.size >= this.maxKeys) this.prune(now);
    if (!prev && this.entries.size >= this.maxKeys) return;
    this.entries.set(key, {
      fails,
      lockedUntil: fails >= MAX_FAILED_ATTEMPTS ? now.getTime() + LOCK_MINUTES * 60_000 : 0,
    });
  }

  success(email: string, ip: string | null | undefined): void {
    if (ip) this.entries.delete(this.key(email, ip));
  }

  /** Новый пароль по ссылке из письма: замки этой почты на всех адресах снимаются */
  clearEmail(email: string): void {
    const prefix = `${email.trim().toLowerCase()}|`;
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
  }

  clearAll(): void {
    this.entries.clear();
  }

  private prune(now: Date): void {
    const cutoff = now.getTime() - LOCK_MINUTES * 60_000;
    for (const [key, entry] of this.entries)
      if (entry.lockedUntil === 0 ? false : entry.lockedUntil <= now.getTime()) this.entries.delete(key);
    void cutoff;
  }
}

/** Замок «почта + адрес устройства» на весь процесс API (владелец 27.10.2026) */
export const loginGuard = new LoginGuard();
