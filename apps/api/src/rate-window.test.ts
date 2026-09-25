import { describe, expect, it } from 'vitest';
import { RateWindows } from './rate-window';

const HOUR = 3_600_000;
const at = (ms: number) => new Date(ms);

/**
 * С-6 из ТЗ аудита 25.09.2026: защита памяти «`windows.clear()` при переполнении» сбрасывала ВСЕ
 * счётчики разом — рассыпав тысячи ключей, нападающий обнулял и свой лимит. Теперь при переполнении
 * вытесняются только протухшие окна; живой счётчик сбросить нельзя, а когда стол полон живыми окнами,
 * новый ключ не заводится и запрос не пропускается (fail closed).
 */
describe('RateWindows: лимиты в памяти с вытеснением только протухших окон', () => {
  it('пропускает до предела, дальше отказывает, после окна пропускает снова', () => {
    const w = new RateWindows(HOUR, 100);
    expect(w.allow('k', 2, at(0))).toBe(true);
    expect(w.allow('k', 2, at(1))).toBe(true);
    expect(w.allow('k', 2, at(2))).toBe(false);
    expect(w.allow('k', 2, at(HOUR))).toBe(true);
  });

  it('переполнение таблицы ключей не сбрасывает живой счётчик (раньше clear() обнулял все)', () => {
    const w = new RateWindows(HOUR, 3);
    expect(w.allow('жертва', 1, at(0))).toBe(true);
    expect(w.allow('жертва', 1, at(1))).toBe(false); // предел выбран
    w.allow('шум-1', 1, at(2));
    w.allow('шум-2', 1, at(3));
    w.allow('шум-3', 1, at(4)); // таблица переполнена ключами нападающего
    // счётчик жертвы не сброшен: лимит по-прежнему исчерпан
    expect(w.allow('жертва', 1, at(5))).toBe(false);
  });

  it('когда стол полон живыми окнами, новый ключ не пропускается (fail closed), живые считаются дальше', () => {
    const w = new RateWindows(HOUR, 2);
    expect(w.allow('a', 5, at(0))).toBe(true);
    expect(w.allow('b', 5, at(1))).toBe(true);
    // место кончилось, окна a и b ещё живые — новый ключ не заводим и не пропускаем
    expect(w.allow('c', 5, at(2))).toBe(false);
    // старые ключи продолжают считаться как ни в чём не бывало
    expect(w.allow('a', 5, at(3))).toBe(true);
  });

  it('протухшие окна вытесняются, и место достаётся новому ключу', () => {
    const w = new RateWindows(HOUR, 2);
    w.allow('старый-1', 5, at(0));
    w.allow('старый-2', 5, at(1));
    // спустя час оба окна протухли: новый ключ вытесняет их и проходит
    expect(w.allow('новый', 5, at(HOUR + 2))).toBe(true);
    expect(w.size).toBeLessThanOrEqual(2);
  });

  it('свой же ключ с протухшим окном не занимает второе место в таблице', () => {
    const w = new RateWindows(HOUR, 2);
    w.allow('a', 5, at(0));
    w.allow('b', 5, at(1));
    // окно a протухло — тот же ключ заводит свежее окно, не спотыкаясь о полный стол
    expect(w.allow('a', 5, at(HOUR + 1))).toBe(true);
  });
});
