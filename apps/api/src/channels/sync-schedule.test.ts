import { describe, expect, it } from 'vitest';
import type { ChannelsRepository, ChannexGateway } from './channels.repository';
import { ChannexSyncService } from './sync.service';

const utc = (s: string) => new Date(s);
function make(lastRunAt: Date | null) {
  const repo = {
    async lastAuditAt() {
      return lastRunAt;
    },
  } as unknown as ChannelsRepository;
  const svc = new ChannexSyncService({} as ChannexGateway, repo);
  const calls: string[] = [];
  svc.fullSync = async (days = 500, trigger = 'manual') => {
    calls.push(`${days}:${trigger}`);
    return {
      from: '2026-09-12',
      to: '2027-09-11',
      availabilityValues: 1,
      restrictionValues: 1,
      tasks: ['t1', 't2'],
      warnings: [],
    };
  };
  return { svc, calls };
}

describe('ChannexSyncService — полная выгрузка раз в сутки', () => {
  it('пора (03:30 Алматы, вчера был прогон) — выгрузка запускается с пометкой «по расписанию»', async () => {
    const { svc, calls } = make(utc('2026-09-10T23:10:00Z'));
    const r = await svc.runScheduledFullSyncIfDue(utc('2026-09-11T22:30:00Z'));
    expect(r.ran).toBe(true);
    expect(calls).toEqual(['500:scheduled']);
  });
  it('не пора (сегодня уже было) — ничего не отправляем и объясняем почему', async () => {
    const { svc, calls } = make(utc('2026-09-11T10:05:00Z'));
    const r = await svc.runScheduledFullSyncIfDue(utc('2026-09-11T12:00:00Z'));
    expect(r.ran).toBe(false);
    expect(r.reason).toMatch(/уже/);
    expect(calls).toEqual([]);
  });
  it('принудительно — запускается независимо от часа', async () => {
    const { svc, calls } = make(utc('2026-09-11T10:05:00Z'));
    const r = await svc.runScheduledFullSyncIfDue(utc('2026-09-11T12:00:00Z'), true);
    expect(r.ran).toBe(true);
    expect(calls).toEqual(['500:manual']);
  });
});

describe('ChannexSyncService при остановленном ARI (CHANNEX_ARI=off, план отката)', () => {
  it('расписание и принудительный запуск (кнопка, сторож) не выгружают и объясняют почему', async () => {
    const { svc, calls } = make(utc('2026-09-10T23:10:00Z'));
    process.env.CHANNEX_ARI = 'off';
    try {
      const scheduled = await svc.runScheduledFullSyncIfDue(utc('2026-09-11T22:30:00Z'));
      const forced = await svc.runScheduledFullSyncIfDue(utc('2026-09-11T22:30:00Z'), true);
      expect([scheduled.ran, forced.ran]).toEqual([false, false]);
      expect(forced.reason).toMatch(/ARI остановлен/);
      expect(calls).toEqual([]);
    } finally {
      delete process.env.CHANNEX_ARI;
    }
  });
  it('кнопка «Полная выгрузка» отвечает понятной ошибкой до обращения к базе и Channex', async () => {
    const svc = new ChannexSyncService({} as ChannexGateway, {} as ChannelsRepository);
    process.env.CHANNEX_ARI = 'off';
    try {
      await expect(svc.fullSync()).rejects.toThrow(/CHANNEX_ARI=off/);
    } finally {
      delete process.env.CHANNEX_ARI;
    }
  });
});
