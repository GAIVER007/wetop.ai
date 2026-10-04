import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MarketReading, ObservationSource } from '@pms/domain';
import type { CompetitorRecord, MarketAudit, MarketRepository } from './market.repository';
import { MarketService, type OwnOccupancySource } from './market.service';

/** «Загрузка конкурентов» (ADR-142): проверки ввода, предел списка, снимки сегодняшнего дня, журнал */
class FakeRepo implements MarketRepository {
  rows: CompetitorRecord[] = [];
  readingsStore: MarketReading[] = [];
  audits: MarketAudit[] = [];
  async today() {
    return '2026-10-03';
  }
  async competitors() {
    return this.rows.map((r) => ({ ...r }));
  }
  async createCompetitor(c: Partial<CompetitorRecord> & { name: string }, audit: MarketAudit) {
    if (this.rows.some((r) => r.name === c.name)) throw new Error('dup');
    const id = `00000000-0000-4000-8000-${String(this.rows.length + 1).padStart(12, '0')}`;
    this.rows.push({
      id,
      name: c.name,
      distanceM: c.distanceM ?? null,
      unitsTotal: c.unitsTotal ?? null,
      url: c.url ?? null,
      note: c.note ?? null,
      active: true,
    });
    this.audits.push(audit);
    return id;
  }
  async updateCompetitor(id: string, patch: Partial<CompetitorRecord>, audit: MarketAudit) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) return false;
    Object.assign(r, patch);
    this.audits.push(audit);
    return true;
  }
  async readings(from: string, to: string, asOf: string) {
    return this.readingsStore.filter(
      (r) => r.stayDate >= from && r.stayDate <= to && r.observedOn <= asOf,
    );
  }
  async nightReadings(stayDate: string) {
    return this.readingsStore.filter((r) => r.stayDate === stayDate);
  }
  async writeReadings(
    competitorId: string,
    observedOn: string,
    entries: Array<{ date: string; bp: number | null }>,
    source: ObservationSource,
    audit: MarketAudit,
  ) {
    if (!this.rows.find((r) => r.id === competitorId && r.active)) return false;
    for (const e of entries) {
      this.readingsStore = this.readingsStore.filter(
        (r) => !(r.competitorId === competitorId && r.stayDate === e.date && r.observedOn === observedOn),
      );
      if (e.bp !== null)
        this.readingsStore.push({ competitorId, stayDate: e.date, observedOn, occupancyBp: e.bp, source });
    }
    this.audits.push(audit);
    return true;
  }
  async collectorTargets() {
    return [];
  }
  async collectorTarget() {
    return null;
  }
  async writeCollected() {
    return { saved: 0, kept: 0 };
  }
}

const own: OwnOccupancySource = {
  async ownDays(from: string) {
    return { [from]: { occupied: 5, free: 5, blocked: 0 } };
  },
};

describe('MarketService', () => {
  let repo: FakeRepo;
  let service: MarketService;
  beforeEach(() => {
    repo = new FakeRepo();
    service = new MarketService(repo, own);
  });

  it('пустой раздел: окно 14 ночей с сегодня, сравнение со вчера, своя загрузка из календаря', async () => {
    const v = await service.occupancy({});
    expect(v.from).toBe('2026-10-03');
    expect(v.board.dates).toHaveLength(14);
    expect(v.board.compareDays).toBe(1);
    expect(v.board.own[0]).toEqual({ date: '2026-10-03', bp: 5000 });
    expect(v.competitors).toEqual([]);
  });

  it('параметры окна проверяются словами', async () => {
    await expect(service.occupancy({ days: '40' })).rejects.toThrow(BadRequestException);
    await expect(service.occupancy({ compare: '3' })).rejects.toThrow('compare');
    await expect(service.occupancy({ asOf: '2026-10-04' })).rejects.toThrow('позже сегодня');
    await expect(service.occupancy({ from: '03.10.2026' })).rejects.toThrow('from');
  });

  it('конкурент создаётся, журнал пишется; дубль имени и пустое имя: 400', async () => {
    const c = await service.createCompetitor({ name: 'Отель Сосед', distanceM: 300 });
    expect(c).toMatchObject({ name: 'Отель Сосед', distanceM: 300, active: true });
    expect(repo.audits[0]!.action).toBe('market.competitor.created');
    await expect(service.createCompetitor({ name: '' })).rejects.toThrow(BadRequestException);
  });

  it('не больше 15 действующих конкурентов; архивный место освобождает', async () => {
    for (let i = 0; i < 15; i++) await service.createCompetitor({ name: `Отель ${i}` });
    await expect(service.createCompetitor({ name: 'Шестнадцатый' })).rejects.toThrow(
      ConflictException,
    );
    const first = repo.rows[0]!;
    await service.updateCompetitor(first.id, { active: false });
    expect(repo.audits.at(-1)!.action).toBe('market.competitor.archived');
    await expect(service.createCompetitor({ name: 'Шестнадцатый' })).resolves.toMatchObject({
      active: true,
    });
    await expect(service.updateCompetitor(first.id, { active: true })).rejects.toThrow(
      ConflictException,
    );
  });

  it('снимки пишутся сегодняшним днём объекта и видны в таблице; пустое снимает значение', async () => {
    const c = await service.createCompetitor({ name: 'Отель Сосед' });
    await expect(
      service.writeOccupancy(c.id, {
        entries: [
          { date: '2026-10-03', percent: '90' },
          { date: '2026-10-04', percent: '72,5' },
        ],
      }),
    ).resolves.toEqual({ saved: 2, cleared: 0 });
    expect(repo.readingsStore.every((r) => r.observedOn === '2026-10-03')).toBe(true);
    const v = await service.occupancy({});
    expect(v.board.competitors[0]!.cells.slice(0, 2).map((x) => x.bp)).toEqual([9000, 7250]);
    expect(v.board.market[0]).toEqual({ date: '2026-10-03', bp: 9000, count: 1 });
    await service.writeOccupancy(c.id, { entries: [{ date: '2026-10-04', percent: '' }] });
    expect(repo.readingsStore).toHaveLength(1);
    expect(repo.audits.at(-1)!.action).toBe('market.occupancy.recorded');
  });

  it('ночь вне окна, повтор ночи, неверный процент, чужой или убранный конкурент: отказ', async () => {
    const c = await service.createCompetitor({ name: 'Отель Сосед' });
    await expect(
      service.writeOccupancy(c.id, { entries: [{ date: '2026-08-01', percent: 50 }] }),
    ).rejects.toThrow('30 дней назад');
    await expect(
      service.writeOccupancy(c.id, {
        entries: [
          { date: '2026-10-05', percent: 50 },
          { date: '2026-10-05', percent: 60 },
        ],
      }),
    ).rejects.toThrow('дважды');
    await expect(
      service.writeOccupancy(c.id, { entries: [{ date: '2026-10-05', percent: 150 }] }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.writeOccupancy(c.id, { entries: [] })).rejects.toThrow('entries');
    await expect(
      service.writeOccupancy('00000000-0000-4000-8000-999999999999', {
        entries: [{ date: '2026-10-05', percent: 50 }],
      }),
    ).rejects.toThrow(NotFoundException);
    await service.updateCompetitor(c.id, { active: false });
    await expect(
      service.writeOccupancy(c.id, { entries: [{ date: '2026-10-05', percent: 50 }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('история ночи: дни снимков, значения конкурентов и средняя рынка; неверная дата — 400', async () => {
    const c = await service.createCompetitor({ name: 'Отель Сосед' });
    repo.readingsStore.push(
      { competitorId: c.id, stayDate: '2026-10-10', observedOn: '2026-10-01', occupancyBp: 4000, source: 'MANUAL' },
      { competitorId: c.id, stayDate: '2026-10-10', observedOn: '2026-10-03', occupancyBp: 7000, source: 'AI_AGENT' },
    );
    const h = await service.night('2026-10-10');
    expect(h.days.map((d) => [d.observedOn, d.marketBp])).toEqual([
      ['2026-10-01', 4000],
      ['2026-10-03', 7000],
    ]);
    expect(h.pickupBp).toBe(3000);
    await expect(service.night('10.10.2026')).rejects.toThrow(BadRequestException);
  });
});
