import { describe, expect, it } from 'vitest';
import {
  QUEUE_CHIPS,
  chipCount,
  emptyQueueText,
  lastMessageLine,
  priorityBadge,
  queueOf,
  waitingFor,
} from './support-queue';

const NOW = Date.parse('2026-09-29T10:00:00.000Z');
const counts = {
  open: 4,
  new: 2,
  waiting: 3,
  needs_human: 1,
  owner_takeover: 1,
  bot_active: 2,
  capped: false,
};

describe('очередь техподдержки: слова экрана', () => {
  it('чипы — по порядку работы оператора, «Закрытые» последними и без числа', () => {
    expect(QUEUE_CHIPS.map((c) => c.label)).toEqual([
      'Все открытые',
      'Новые',
      'Ждут ответа',
      'Нужен человек',
      'Ведёт оператор',
      'Ведёт ИИ',
      'Закрытые',
    ]);
    expect(chipCount('waiting', counts)).toBe('3');
    expect(chipCount('closed', counts)).toBeNull();
    expect(chipCount('open', { ...counts, open: 200, capped: true })).toBe('200+');
  });

  it('очередь из адреса: чужое слово — «Все открытые»', () => {
    expect(queueOf('waiting')).toBe('waiting');
    expect(queueOf('всё')).toBe('open');
    expect(queueOf(undefined)).toBe('open');
  });

  it('сколько ждёт: минуты, часы с минутами, дни; не ждёт — null', () => {
    expect(waitingFor(null, NOW)).toBeNull();
    expect(waitingFor('2026-09-29T09:59:40.000Z', NOW)).toBe('ждёт меньше минуты');
    expect(waitingFor('2026-09-29T09:48:00.000Z', NOW)).toBe('ждёт 12 мин');
    expect(waitingFor('2026-09-29T07:55:00.000Z', NOW)).toBe('ждёт 2 ч 5 мин');
    expect(waitingFor('2026-09-29T07:00:00.000Z', NOW)).toBe('ждёт 3 ч');
    expect(waitingFor('2026-09-26T09:00:00.000Z', NOW)).toBe('ждёт 3 дн.');
  });

  it('приоритет словом и тоном; у закрытого — нет метки', () => {
    expect(priorityBadge({ priority: 'urgent', mode: 'needs_human', closed: false })).toEqual({
      label: 'срочно',
      tone: 'danger',
    });
    expect(priorityBadge({ priority: 'waiting', mode: 'owner_takeover', closed: false })).toEqual({
      label: 'ждёт оператора',
      tone: 'warn',
    });
    expect(priorityBadge({ priority: 'waiting', mode: 'bot_active', closed: false })).toEqual({
      label: 'ждёт ответа',
      tone: 'warn',
    });
    expect(priorityBadge({ priority: 'normal', mode: 'bot_active', closed: false })).toBeNull();
    expect(priorityBadge({ priority: 'urgent', mode: 'needs_human', closed: true })).toBeNull();
  });

  it('последнее сообщение — кто сказал и что; нет сообщения — прочерк', () => {
    expect(lastMessageLine({ role: 'user', text: 'Не могу заселить', at: null })).toBe(
      'Пользователь: Не могу заселить',
    );
    expect(lastMessageLine({ role: 'assistant', text: 'Откройте бронь', at: null })).toBe(
      'ИИ: Откройте бронь',
    );
    expect(lastMessageLine({ role: 'operator', text: 'Смотрю', at: null })).toBe('Оператор: Смотрю');
    expect(lastMessageLine(null)).toBe('—');
  });

  it('пустая очередь говорит, что пусто и что это значит', () => {
    expect(emptyQueueText('open').title).toBe('Открытых обращений нет');
    expect(emptyQueueText('waiting').title).toBe('Никто не ждёт ответа');
    expect(emptyQueueText('needs_human').title).toBe('Человек никому не нужен');
    expect(emptyQueueText('closed').title).toBe('Закрытых обращений нет');
  });
});
