import { describe, expect, it } from 'vitest';
import { publicStatus } from './public-status';

/** Страница статуса сервиса (H14, ADR-144): наружу только общие слова, внутренние неисправности не видны */
describe('публичный статус сервиса', () => {
  it('всё работает', () => {
    const s = publicStatus({ databaseUp: true, openKinds: [] });
    expect(s.overall).toBe('ok');
    expect(s.components.map((c) => [c.key, c.state])).toEqual([
      ['app', 'ok'],
      ['database', 'ok'],
      ['channels', 'ok'],
      ['booking', 'ok'],
    ]);
  });
  it('обмен с каналами с перебоями — общий статус «с перебоями»', () => {
    const s = publicStatus({ databaseUp: true, openKinds: ['outbox.stuck', 'tests.failing'] });
    expect(s.overall).toBe('degraded');
    expect(s.components.find((c) => c.key === 'channels')!.state).toBe('degraded');
  });
  it('база недоступна — сервис недоступен', () => {
    expect(publicStatus({ databaseUp: false, openKinds: [] }).overall).toBe('down');
    expect(publicStatus({ databaseUp: true, openKinds: ['db.down'] }).overall).toBe('down');
  });
  it('внутренние неисправности (тесты, бэкап, сверка, ошибки API, места) наружу не выходят', () => {
    const s = publicStatus({
      databaseUp: true,
      openKinds: [
        'tests.failing',
        'backup.stale',
        'reconciliation.fail',
        'api.error',
        'stay.unassigned',
      ],
    });
    expect(s.overall).toBe('ok');
  });
  it('у каждой части понятная подпись без длинного тире', () => {
    for (const c of publicStatus({ databaseUp: true, openKinds: [] }).components) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.label).not.toContain('—');
    }
  });
});
