import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { FakeAnalyticsRepository } from './fake-repository';
import { RETENTION_HOUR_LOCAL, WebRetentionService, retentionDue } from './retention.service';

/**
 * Проверка SECURITY.md 24.09.2026, Н12 и план П9: сырые данные счётчика хранятся 13 месяцев, но удалял их только
 * ручной `npm run analytics:retention` — расписания не было. Теперь раз в сутки их чистит API, следом за полной
 * выгрузкой ARI (03:00 Алматы), тем же способом: таймер в процессе и «сегодня уже было».
 */
describe('очистка счётчика сайта по расписанию', () => {
  it('раз в сутки после 04:00 Алматы', () => {
    expect(RETENTION_HOUR_LOCAL).toBe(4);
    // 22:59 UTC — это 03:59 в Алматы, 23:00 UTC — 04:00 следующего местного дня
    expect(retentionDue(null, new Date('2027-10-19T22:59:00Z'))).toBe(false);
    expect(retentionDue(null, new Date('2027-10-19T23:00:00Z'))).toBe(true);
    expect(retentionDue('2027-10-20', new Date('2027-10-20T10:00:00Z'))).toBe(false);
    expect(retentionDue('2027-10-19', new Date('2027-10-20T10:00:00Z'))).toBe(true);
  });

  it('удаляет сессии старше 13 месяцев и второй раз за сутки в базу не ходит', async () => {
    const repo = new FakeAnalyticsRepository();
    repo.seedGate(); // три сессии 12.09.2026
    const service = new WebRetentionService(repo);

    // 13.10.2027 05:00 Алматы: граница 13.09.2026, все три сессии старше
    const first = await service.runIfDue(new Date('2027-10-13T00:00:00Z'));
    expect(first).toEqual({ ran: true, deleted: 3, cutoff: '2026-09-13T00:00:00.000Z' });
    expect(repo.sessionRows).toHaveLength(0);

    const again = await service.runIfDue(new Date('2027-10-13T10:00:00Z'));
    expect(again.ran).toBe(false);
    expect(repo.retentionCutoffs).toEqual(['2026-09-13T00:00:00.000Z']);
  });

  it('свежие сессии не трогает', async () => {
    const repo = new FakeAnalyticsRepository();
    repo.seedGate();
    const service = new WebRetentionService(repo);

    // 11.10.2027 05:00 Алматы: граница 11.09.2026, сессии 12.09.2026 моложе
    const r = await service.runIfDue(new Date('2027-10-11T00:00:00Z'));
    expect(r).toMatchObject({ ran: true, deleted: 0 });
    expect(repo.sessionRows).toHaveLength(3);
  });

  it('до 04:00 не чистит вовсе', async () => {
    const repo = new FakeAnalyticsRepository();
    repo.seedGate();
    const r = await new WebRetentionService(repo).runIfDue(new Date('2027-10-13T22:00:00Z'));
    expect(r.ran).toBe(false);
    expect(repo.retentionCutoffs).toEqual([]);
  });
});
