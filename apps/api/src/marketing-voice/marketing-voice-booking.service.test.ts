import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MarketingVoiceService } from './marketing-voice.service';
import type { BookingAgentRecord, MarketingVoiceRepository, ReadScope } from './marketing-voice.repository';

/** Настройка голосовой брони из стойки (срез 4): выключатель с проверкой готовности, лимит за звонок, права и журнал */
const SCOPE: ReadScope = { organizationId: 'org-1', locationId: 'loc-1', timezone: 'Asia/Almaty' };
const AGENT: BookingAgentRecord = {
  agentId: '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b', lifecycle: 'active', vertical: 'BEAUTY', enabled: false, needsApproval: true, maxPerCall: 3,
};

class FakeRepo {
  agent: BookingAgentRecord | null = AGENT;
  blockers: string[] = [];
  writable = true;
  saved: Array<{ agentId: string; patch: unknown; userId: string | null }> = [];
  async scope() { return SCOPE; }
  async assertWritable() { if (!this.writable) throw new ForbiddenException('Организация доступна только для чтения'); }
  async bookingAgent() { return this.agent; }
  async readiness() { return this.blockers; }
  async saveBooking(_scope: ReadScope, agentId: string, patch: unknown, userId: string | null) {
    this.saved.push({ agentId, patch, userId });
    this.agent = this.agent ? { ...this.agent, ...(patch as object) } as BookingAgentRecord : null;
  }
}

const make = (repo = new FakeRepo()) => ({ repo, service: new MarketingVoiceService(repo as unknown as MarketingVoiceRepository, () => 'user-1') });

describe('GET настройки брони', () => {
  it('агент действует и всё готово: можно включать', async () => {
    const view = await make().service.bookingView();
    expect(view).toMatchObject({ hasAgent: true, vertical: 'BEAUTY', enabled: false, maxPerCall: 3, canEnable: true, blockers: [] });
  });
  it('агент не действует и нет данных: причины словами, включить нельзя', async () => {
    const { repo, service } = make();
    repo.agent = { ...AGENT, lifecycle: 'draft' };
    repo.blockers = ['Нет услуг с мастерами'];
    const view = await service.bookingView();
    expect(view.canEnable).toBe(false);
    expect(view.blockers).toEqual(['Агент ИИ-продавца должен быть в состоянии «Действует»', 'Нет услуг с мастерами']);
  });
  it('у филиала нет агента: hasAgent false', async () => {
    const { repo, service } = make();
    repo.agent = null;
    expect(await service.bookingView()).toMatchObject({ hasAgent: false, canEnable: false });
  });
});

describe('PATCH настройки брони', () => {
  it('включение при готовности: сохраняется с автором', async () => {
    const { repo, service } = make();
    const view = await service.saveBooking({ enabled: true });
    expect(repo.saved).toEqual([{ agentId: AGENT.agentId, patch: { enabled: true }, userId: 'user-1' }]);
    expect(view.enabled).toBe(true);
  });
  it('включение при неготовности: 409 с причиной, ничего не сохранено', async () => {
    const { repo, service } = make();
    repo.blockers = ['Нет услуг с мастерами'];
    await expect(service.saveBooking({ enabled: true })).rejects.toBeInstanceOf(ConflictException);
    expect(repo.saved).toHaveLength(0);
  });
  it('выключить можно всегда, даже если агент не действует', async () => {
    const { repo, service } = make();
    repo.agent = { ...AGENT, lifecycle: 'paused', enabled: true };
    repo.blockers = ['что угодно'];
    await service.saveBooking({ enabled: false });
    expect(repo.saved).toHaveLength(1);
  });
  it('лимит за звонок 1..20, целое', async () => {
    const { repo, service } = make();
    await service.saveBooking({ maxPerCall: 5 });
    expect(repo.saved[0]!.patch).toEqual({ maxPerCall: 5 });
    for (const bad of [0, 21, 2.5, '3', null])
      await expect(service.saveBooking({ maxPerCall: bad })).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.saved).toHaveLength(1);
  });
  it('неизвестные поля и пустое тело отклоняются; needsApproval из стойки не меняется', async () => {
    const { repo, service } = make();
    for (const bad of [{}, { needsApproval: false }, { enabled: 'yes' }, { handoffPhone: '+77001112233' }])
      await expect(service.saveBooking(bad)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.saved).toHaveLength(0);
  });
  it('только чтение: запись отказывает; агента нет: 404', async () => {
    const ro = make();
    ro.repo.writable = false;
    await expect(ro.service.saveBooking({ enabled: false })).rejects.toBeInstanceOf(ForbiddenException);
    const none = make();
    none.repo.agent = null;
    await expect(none.service.saveBooking({ enabled: false })).rejects.toBeInstanceOf(NotFoundException);
  });
});
