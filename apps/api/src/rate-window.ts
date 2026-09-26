/**
 * Окна лимитов в памяти (fixed window на час или иной период): ключ → { начало окна, счётчик }.
 * Один класс для броней с сайта, счётчика посещений и лимитов входа — раньше каждый сервис держал
 * копию `allow()` со своим `windows.clear()`.
 *
 * С-6 из ТЗ аудита 25.09.2026: `clear()` при переполнении сбрасывал ВСЕ счётчики разом — рассыпав
 * тысячи ключей, нападающий обнулял и свой лимит. Теперь при переполнении вытесняются только
 * протухшие окна; если стол всё ещё полон живыми, новый ключ не заводится и запрос не пропускается
 * (fail closed): счётчики живых ключей не сбросить, а перебор ключей не превращается в снятие лимитов.
 * Окна живут в памяти и перезапуск API их теряет — стойкий предел там, где он критичен, держит база
 * (брони с сайта — С-7, счётчик по журналу; локаут входа — `users.failed_attempts`).
 */
export class RateWindows {
  private windows = new Map<string, { start: number; count: number }>();
  private lastEviction = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly windowMs: number,
    /** Предел таблицы ключей — защита памяти от перебора ключей */
    private readonly maxKeys: number,
  ) {}

  /** true — пропустить; false — предел исчерпан или стол полон живыми окнами (fail closed) */
  allow(key: string, limit: number, now: Date): boolean {
    const t = now.getTime();
    const w = this.windows.get(key);
    if (w && t - w.start < this.windowMs) {
      w.count += 1;
      return w.count <= limit;
    }
    if (w) this.windows.delete(key); // своё протухшее окно — не второе место в таблице
    if (this.windows.size >= this.maxKeys) this.evictExpired(t);
    if (this.windows.size >= this.maxKeys) return false;
    this.windows.set(key, { start: t, count: 1 });
    return true;
  }

  /**
   * Не чаще раза в десятую долю окна (не реже раза в секунду): на полном столе живых окон обход таблицы на каждом новом
   * ключе сам становился отказом в обслуживании (проверка слияния 26.09). Протухнуть раньше окна ничто не может.
   */
  private evictExpired(t: number): void {
    if (t - this.lastEviction < Math.max(1_000, this.windowMs / 10)) return;
    this.lastEviction = t;
    for (const [key, w] of this.windows) {
      if (t - w.start >= this.windowMs) this.windows.delete(key);
    }
  }

  /** Для тестов */
  reset(): void {
    this.windows = new Map();
    this.lastEviction = Number.NEGATIVE_INFINITY;
  }

  get size(): number {
    return this.windows.size;
  }
}
