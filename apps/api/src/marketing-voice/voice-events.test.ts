import { describe, expect, it } from 'vitest';
import { applyEvent, parseVoiceEvent, VoiceEventError, type CallValues } from './voice-events';

const AGENT = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const NOW = new Date('2026-10-22T12:00:00Z');
const base = (over: Record<string, unknown> = {}) => ({
  agentId: AGENT,
  externalCallId: 'room-abc.123',
  state: 'RECEIVED',
  occurredAt: '2026-10-22T11:59:00Z',
  ...over,
});

describe('parseVoiceEvent', () => {
  it('разбирает минимальное событие и ставит умолчания', () => {
    const ev = parseVoiceEvent(base(), NOW);
    expect(ev).toMatchObject({
      agentId: AGENT,
      externalCallId: 'room-abc.123',
      state: 'RECEIVED',
      direction: 'INBOUND',
      dialedNumber: null,
      callerMasked: null,
      transferRequested: false,
      callback: null,
    });
    expect(ev.occurredAt.toISOString()).toBe('2026-10-22T11:59:00.000Z');
  });

  it('принимает просьбу о звонке и приводит номер к E.164', () => {
    const ev = parseVoiceEvent(
      base({ state: 'ANSWERED', callback: { phone: '8 700 111 22 33', name: ' Айдана ', note: 'окрашивание' } }),
      NOW,
    );
    expect(ev.callback).toEqual({ phone: '+77001112233', name: 'Айдана', note: 'окрашивание' });
  });

  it.each([
    ['не объект', 'text'],
    ['agentId не UUID', base({ agentId: 'x' })],
    ['пустой externalCallId', base({ externalCallId: '' })],
    ['externalCallId длиннее 128', base({ externalCallId: 'a'.repeat(129) })],
    ['externalCallId с пробелом', base({ externalCallId: 'a b' })],
    ['неизвестное состояние', base({ state: 'DONE' })],
    ['время не ISO', base({ occurredAt: 'вчера' })],
    ['время без пояса', base({ occurredAt: '2026-10-22 11:59' })],
    ['время из далёкого будущего (больше суток)', base({ occurredAt: '2026-10-24T12:10:00Z' })],
    ['время старше 30 суток', base({ occurredAt: '2026-09-01T00:00:00Z' })],
    ['маска не маска', base({ callerMasked: '+77001112233' })],
    ['dialedNumber не E.164', base({ dialedNumber: '8700' })],
    ['неизвестное поле', base({ extra: 1 })],
    ['длительность от воркера не принимается (считает сервер)', base({ durationSeconds: 5 })],
    ['телефон просьбы не номер', base({ callback: { phone: '123', name: 'А', note: '' } })],
    ['заметка длиннее 500', base({ callback: { phone: '+77001112233', name: 'А', note: 'я'.repeat(501) } })],
    ['имя длиннее 100', base({ callback: { phone: '+77001112233', name: 'я'.repeat(101), note: '' } })],
    ['endReason длиннее 40', base({ endReason: 'x'.repeat(41) })],
    ['endReason со служебным знаком', base({ endReason: 'a\u0000b' })],
    ['endReason с пробелом и кириллицей', base({ endReason: 'сбой связи' })],
    ['errorCode со служебным знаком', base({ errorCode: 'x\u0001' })],
    ['имя с нулевым знаком', base({ callback: { phone: '+77001112233', name: 'А\u0000', note: '' } })],
    ['заметка с непарным суррогатом', base({ callback: { phone: '+77001112233', name: 'А', note: 'x\ud800' } })],
  ])('отказ: %s', (_name, dto) => {
    expect(() => parseVoiceEvent(dto, NOW)).toThrow(VoiceEventError);
  });

  it('сообщение отказа не содержит значений полей', () => {
    try {
      parseVoiceEvent(base({ callback: { phone: '+7700SECRET', name: 'А', note: '' } }), NOW);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('SECRET');
    }
  });
});

const T = (s: string) => new Date(`2026-10-22T${s}Z`);
const ev = (state: string, at: string, over: Record<string, unknown> = {}) =>
  parseVoiceEvent(base({ state, occurredAt: `2026-10-22T${at}Z`, ...over }), NOW);

describe('время из будущего (расхождение часов воркера)', () => {
  it('до суток вперёд принимается и приводится ко времени сервера', () => {
    const e = parseVoiceEvent(base({ occurredAt: '2026-10-22T12:10:00Z' }), NOW);
    expect(e.occurredAt.toISOString()).toBe(NOW.toISOString());
  });
});

describe('текст: переводы строки в заметке допустимы', () => {
  it('перевод строки и табуляция проходят', () => {
    const e = parseVoiceEvent(base({ callback: { phone: '+77001112233', name: 'А', note: 'строка 1\nстрока 2\tхвост' } }), NOW);
    expect(e.callback?.note).toBe('строка 1\nстрока 2\tхвост');
  });
});

describe('applyEvent: состояние идёт только вперёд, повтор не меняет', () => {
  it('первое событие создаёт звонок', () => {
    const { next, changed } = applyEvent(null, ev('RECEIVED', '11:00:00', { callerMasked: '***2233' }));
    expect(changed).toBe(true);
    expect(next).toMatchObject({ state: 'RECEIVED', callerMasked: '***2233', answeredAt: null, endedAt: null });
    expect(next.receivedAt).toEqual(T('11:00:00'));
  });

  it('RECEIVED -> ANSWERED -> ENDED, длительность считает сервер', () => {
    const a = applyEvent(null, ev('RECEIVED', '11:00:00')).next;
    const b = applyEvent(a, ev('ANSWERED', '11:00:05')).next;
    expect(b).toMatchObject({ state: 'ANSWERED', answeredAt: T('11:00:05') });
    const c = applyEvent(b, ev('ENDED', '11:02:05', { endReason: 'hangup' })).next;
    expect(c).toMatchObject({ state: 'ENDED', endedAt: T('11:02:05'), durationSeconds: 120, endReason: 'hangup' });
  });

  it('повтор того же события ничего не меняет', () => {
    const first = applyEvent(null, ev('RECEIVED', '11:00:00')).next;
    expect(applyEvent(first, ev('RECEIVED', '11:00:00')).changed).toBe(false);
  });

  it('позднее событие меньшего ранга не откатывает состояние', () => {
    const ended = applyEvent(applyEvent(null, ev('RECEIVED', '11:00:00')).next, ev('ENDED', '11:01:00')).next;
    const late = applyEvent(ended, ev('ANSWERED', '11:00:05'));
    expect(late.next.state).toBe('ENDED');
  });

  it('конечное состояние не заменяется другим конечным', () => {
    const rejected = applyEvent(null, ev('REJECTED', '11:00:00')).next;
    expect(applyEvent(rejected, ev('FAILED', '11:00:02')).next.state).toBe('REJECTED');
  });

  it('если ANSWERED пришло раньше RECEIVED, receivedAt берётся из первого события и не меняется', () => {
    const first = applyEvent(null, ev('ANSWERED', '11:00:05')).next;
    const later = applyEvent(first, ev('RECEIVED', '11:00:00')).next;
    expect(later.receivedAt).toEqual(T('11:00:05'));
    expect(later.state).toBe('ANSWERED');
  });

  it('расхождение часов: время ответа и конца не раньше получения', () => {
    const a = applyEvent(null, ev('RECEIVED', '11:00:10')).next;
    const b = applyEvent(a, ev('ANSWERED', '11:00:05')).next;
    expect(b.answeredAt).toEqual(T('11:00:10'));
    const c = applyEvent(b, ev('ENDED', '11:00:01')).next;
    expect(c.endedAt).toEqual(T('11:00:10'));
    expect(c.durationSeconds).toBe(0);
  });

  it('просьба и перевод запоминаются и не снимаются', () => {
    const a = applyEvent(null, ev('ANSWERED', '11:00:05', { transferRequested: true, callback: { phone: '+77001112233', name: '', note: '' } })).next;
    expect(a).toMatchObject({ transferRequested: true, callbackRequested: true });
    const b = applyEvent(a, ev('ENDED', '11:01:00')).next;
    expect(b).toMatchObject({ transferRequested: true, callbackRequested: true });
  });

  it('согласие: false не возвращается в true', () => {
    const a = applyEvent(null, ev('RECEIVED', '11:00:00', { consentAnnounced: false })).next;
    expect(a.consentAnnounced).toBe(false);
    expect(applyEvent(a, ev('ANSWERED', '11:00:02', { consentAnnounced: true })).next.consentAnnounced).toBe(false);
  });

  it('причины и номера заполняются один раз', () => {
    const a = applyEvent(null, ev('RECEIVED', '11:00:00', { dialedNumber: '+77009990000' })).next as CallValues;
    const b = applyEvent(a, ev('ENDED', '11:01:00', { endReason: 'hangup', dialedNumber: '+77001110000' })).next;
    expect(b.dialedNumber).toBe('+77009990000');
    expect(b.endReason).toBe('hangup');
    expect(applyEvent(b, ev('ENDED', '11:01:00', { endReason: 'other' })).next.endReason).toBe('hangup');
  });
});


describe('applyEvent: события вне порядка (замечания ревью M2, L3)', () => {
  it('ENDED раньше ANSWERED: длительность неизвестна (null), а не ноль', () => {
    const ended = applyEvent(null, ev('ENDED', '11:03:00')).next;
    const late = applyEvent(ended, ev('ANSWERED', '11:01:30')).next;
    expect(late.state).toBe('ENDED');
    expect(late.durationSeconds).toBeNull();
  });

  it('позднее ANSWERED на REJECTED или FAILED не делает звонок отвеченным', () => {
    for (const final of ['REJECTED', 'FAILED']) {
      const row = applyEvent(null, ev(final, '11:00:00')).next;
      const late = applyEvent(row, ev('ANSWERED', '11:00:05')).next;
      expect(late.answeredAt).toBeNull();
      expect(late.state).toBe(final);
    }
  });

  it('конфликтующее конечное событие не подмешивает причину и код ошибки', () => {
    const ended = applyEvent(applyEvent(null, ev('RECEIVED', '11:00:00')).next, ev('ENDED', '11:01:00', { endReason: 'hangup' })).next;
    const failed = applyEvent(ended, ev('FAILED', '11:01:01', { errorCode: 'session_error', endReason: 'boom' })).next;
    expect(failed).toMatchObject({ state: 'ENDED', endReason: 'hangup', errorCode: null });
  });

  it('конечное событие заполняет причину у ещё не конечного звонка', () => {
    const a = applyEvent(null, ev('ANSWERED', '11:00:05')).next;
    expect(applyEvent(a, ev('FAILED', '11:00:30', { errorCode: 'session_error' })).next).toMatchObject({
      state: 'FAILED',
      errorCode: 'session_error',
    });
  });
});
