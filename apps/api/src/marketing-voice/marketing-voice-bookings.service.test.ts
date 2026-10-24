import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MarketingVoiceService } from './marketing-voice.service';
import type { MarketingVoiceRepository, ReadScope, VoiceBookingRecord } from './marketing-voice.repository';

/** Брони, принятые голосовым агентом (срез 4): без имён и телефонов гостей, новые сверху, окно в днях */
const SCOPE: ReadScope = { organizationId: 'org-1', locationId: 'loc-1', timezone: 'Asia/Almaty' };
const NOW = new Date('2026-11-10T10:00:00Z');
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000);

const HOTEL: VoiceBookingRecord = {
  id: 'h1', kind: 'HOTEL', at: at(5), status: 'CONFIRMED', reference: 'WT-1',
  category: 'Стандарт', arrival: '2026-11-20', departure: '2026-11-22', adults: 2, totalMinor: '3000000', currency: 'KZT',
};
const VISIT: VoiceBookingRecord = {
  id: 'v1', kind: 'APPOINTMENT', at: at(1), status: 'BOOKED', service: 'Стрижка', master: 'Алия',
  startsAt: '2026-11-12T05:00:00.000Z', totalMinor: '500000', currency: 'KZT',
};
const TABLE: VoiceBookingRecord = {
  id: 't1', kind: 'TABLE', at: at(30), status: 'BOOKED', startsAt: '2026-11-12T14:00:00.000Z', partySize: 4, period: 'Ужин',
};

class FakeRepo {
  args: unknown[] = [];
  rows: VoiceBookingRecord[] = [HOTEL, VISIT, TABLE];
  async scope() { return SCOPE; }
  async voiceBookings(scope: ReadScope, since: Date, limit: number) {
    this.args.push({ scope, since, limit });
    return this.rows;
  }
}
const make = (repo = new FakeRepo()) => ({ repo, service: new MarketingVoiceService(repo as unknown as MarketingVoiceRepository, () => 'u', () => NOW) });

describe('брони голосового агента', () => {
  it('новые сверху, окно по умолчанию 7 дней, лимит 50, пояс филиала', async () => {
    const { repo, service } = make();
    const out = await service.bookings({});
    expect(out.rows.map((r) => r.id)).toEqual(['v1', 'h1', 't1']);
    expect(out.timezone).toBe('Asia/Almaty');
    expect(repo.args[0]).toMatchObject({ limit: 50 });
    expect((repo.args[0] as { since: Date }).since.getTime()).toBe(NOW.getTime() - 7 * 86_400_000);
  });
  it('в ответе нет имён, телефонов и внутренних идентификаторов гостей', async () => {
    const out = await make().service.bookings({});
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/phone|телефон|firstName|lastName|guest/i);
    expect(out.rows[1]).toMatchObject({ kind: 'HOTEL', reference: 'WT-1', category: 'Стандарт', arrival: '2026-11-20', adults: 2 });
  });
  it('за сутки считает новые', async () => {
    expect((await make().service.bookings({})).last24h).toBe(2);
  });
  it('days 1..30, целое; мусор отклоняется', async () => {
    const { repo, service } = make();
    await service.bookings({ days: '30' });
    expect((repo.args[0] as { since: Date }).since.getTime()).toBe(NOW.getTime() - 30 * 86_400_000);
    for (const bad of ['0', '31', 'x', '2.5']) await expect(service.bookings({ days: bad })).rejects.toBeInstanceOf(BadRequestException);
  });
});
