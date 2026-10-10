import { assistant } from '@pms/integrations';
import { DEFAULT_SELLER_PROFILE } from '@pms/domain';
import type { ExtensionAccess, SellerFactsSource, SellerProfileInput } from '@pms/domain';
import type { SellerConfig, SellerConnection, SellerPort } from './seller.connection';
import type {
  SellerAudit,
  SellerCatalogDraft,
  SellerCatalogPlacement,
  SellerCatalogRepository,
  SellerAgentScope,
  SellerFactsRepository,
  SellerOrganizationRow,
  SellerOrgsRepository,
  SellerProfileRow,
  SellerProfilesRepository,
} from './seller.repository';
import {
  ForeignIdempotencyKeyError,
  LocationTakenError,
  type AgentPlacementRow,
  type BusinessAgentRecord,
  type BusinessAgentsRepository,
  type BusinessOption,
} from './business-agents.repository';

/** Подставной продавец для тестов раздела: запоминает вызовы, отвечает заданным или падает заданной ошибкой */
export class FakeSeller implements SellerPort {
  telegram(orgId: string, action: string, body?: unknown) { return this.call('telegram', orgId, action, body); }
  calls: Array<{ op: string; args: unknown[] }> = [];
  failWith: Error | null = null;
  /** Отказ одного вызова (`putProfile`, `putFacts`…) — остальные отвечают как обычно */
  failOn: Record<string, Error> = {};
  replies: Record<string, unknown> = {};

  private async call(op: string, ...args: unknown[]): Promise<unknown> {
    this.calls.push({ op, args });
    const failure = this.failOn[op] ?? this.failWith;
    if (failure) throw failure;
    return this.replies[op] ?? { status: 'ok' };
  }

  listConversations(query: Record<string, unknown>) {
    return this.call('listConversations', query);
  }
  conversation(id: string) {
    return this.call('conversation', id);
  }
  takeover(id: string) {
    return this.call('takeover', id);
  }
  release(id: string) {
    return this.call('release', id);
  }
  close(id: string) {
    return this.call('close', id);
  }
  handling(id: string, body: Record<string, unknown>) {
    return this.call('handling', id, body);
  }
  addNote(id: string, body: Record<string, unknown>) {
    return this.call('addNote', id, body);
  }
  reply(id: string, text: string) {
    return this.call('reply', id, text);
  }
  knowledge() {
    return this.call('knowledge');
  }
  uploadKnowledge(file: { name: string; type: string; data: Uint8Array }) {
    return this.call('uploadKnowledge', file);
  }
  summary(excludeSandbox?: boolean) {
    return this.call('summary', excludeSandbox);
  }
  sandbox(input: { externalId: string; text: string }) {
    return this.call('sandbox', input);
  }
  // база знаний WETOP Support (S3): только у помощника
  kbList(query: Record<string, unknown>) {
    return this.call('kbList', query);
  }
  kbCreate(body: unknown) {
    return this.call('kbCreate', body);
  }
  kbRead(id: string) {
    return this.call('kbRead', id);
  }
  kbUpdate(id: string, body: unknown) {
    return this.call('kbUpdate', id, body);
  }
  kbPublish(id: string, approvedBy: string) {
    return this.call('kbPublish', id, approvedBy);
  }
  kbStatus(id: string, status: string, by: string | null) {
    return this.call('kbStatus', id, status, by);
  }
  conversationKnowledge(id: string) {
    return this.call('conversationKnowledge', id);
  }
  knowledgeDraft(id: string, by: string | null) {
    return this.call('knowledgeDraft', id, by);
  }
  conversationActions(id: string) {
    return this.call('conversationActions', id);
  }
  putProfile(payload: unknown) {
    return this.call('putProfile', payload);
  }
  putSellerPrompt(payload: { object_name: string; text: string }) {
    return this.call('putSellerPrompt', payload);
  }
  generateInstruction(story: string) { return this.call('generateInstruction', story); }

  extractProfile(story: string) {
    return this.call('extractProfile', story);
  }
  llmKeyStatus(orgId: string) {
    return this.call('llmKeyStatus', orgId);
  }
  putLlmKey(orgId: string, key: string) {
    return this.call('putLlmKey', orgId, key);
  }
  checkLlmKey(orgId: string, key: string) {
    return this.call('checkLlmKey', orgId, key);
  }
  whatsappStatus(orgId: string) {
    return this.call('whatsappStatus', orgId);
  }
  putWhatsApp(orgId: string, input: { phoneNumberId: string; token: string; appSecret: string }) {
    return this.call('putWhatsApp', orgId, input);
  }
  checkWhatsApp(orgId: string, input: { phoneNumberId: string; token: string }) {
    return this.call('checkWhatsApp', orgId, input);
  }
  putFacts(payload: unknown) {
    return this.call('putFacts', payload);
  }
  putOrganization(
    id: string,
    org: { name: string; publicKey: string; active: boolean; hosts: string[] },
  ) {
    return this.call('putOrganization', id, org);
  }
  // правила и модель — у помощника («Платформа → Техподдержка», ADR-084)
  prompt() {
    return this.call('prompt');
  }
  putPrompt(text: string) {
    return this.call('putPrompt', text);
  }
  settings() {
    return this.call('settings');
  }
  putModel(model: string) {
    return this.call('putModel', model);
  }

  ops(): string[] {
    return this.calls.map((c) => c.op);
  }
}

export const unavailable = () =>
  new assistant.SellerUnavailableError('ИИ-продавец недоступен (HTTP 502)');
export const rejected = (status: number, detail: string, fields: string[] = []) =>
  new assistant.SellerRejectedError(status, detail, fields);

export class FakeConnection implements SellerConnection {
  /** С какой организацией просили клиента (Э4): каждая отправка — со своей */
  requestedOrgs: Array<string | undefined> = [];
  /** С каким агентом (SA2.5, `X-Agent`): у рабочего продавца — его идентификатор, у вызова без организации — `undefined` */
  requestedAgents: Array<string | undefined> = [];
  constructor(
    public settings: SellerConfig,
    public seller: FakeSeller = new FakeSeller(),
  ) {}
  config(): SellerConfig {
    return this.settings;
  }
  client(organizationId?: string, agentId?: string): SellerPort | null {
    if (!this.settings.baseUrl || !this.settings.serviceKey) return null;
    this.requestedOrgs.push(organizationId);
    this.requestedAgents.push(agentId);
    return this.seller;
  }
}

/** Гостиницы для сверки (Э4): организации со строкой расширения и домены их сайтов */
export class FakeOrgs implements SellerOrgsRepository {
  rows: SellerOrganizationRow[] = [];
  siteHosts = new Map<string, string[]>();
  /** Домены сайтов ФИЛИАЛА агента (SA2.5): ключ — идентификатор агента */
  agentHosts = new Map<string, string[]>();
  async withExtension(): Promise<SellerOrganizationRow[]> {
    return this.rows;
  }
  async one(organizationId: string): Promise<SellerOrganizationRow | null> {
    return this.rows.find((r) => r.organizationId === organizationId) ?? null;
  }
  async hosts(organizationId: string): Promise<string[]> {
    return this.siteHosts.get(organizationId) ?? [];
  }
  async hostsForAgent(scope: SellerAgentScope): Promise<string[]> {
    return this.agentHosts.get(scope.agentId) ?? [];
  }
  userLabels = new Map<string, string>();
  async userLabel(userId: string): Promise<string | null> {
    return this.userLabels.get(userId) ?? null;
  }
}

export class FakeProfiles implements SellerProfilesRepository {
  /** Ключ — идентификатор АГЕНТА (SA2.5); у перенесённого продавца он равен организации */
  rows = new Map<string, SellerProfileRow>();
  audits: Array<{ organizationId: string; agentId: string; before: unknown; after: unknown }> = [];

  async get(agentId: string): Promise<SellerProfileRow | null> {
    return this.rows.get(agentId) ?? null;
  }
  async save(
    scope: SellerAgentScope,
    profile: SellerProfileInput,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const { agentId, organizationId } = scope;
    const before = this.rows.get(agentId) ?? null;
    const row: SellerProfileRow = {
      ...(before ?? {
        promptText: null,
        profileAppliedAt: null,
        factsHash: null,
        factsAppliedAt: null,
        lastError: null,
        lastErrorAt: null,
      }),
      ...profile,
      organizationId,
      updatedAt: now,
      updatedBy: userId,
    };
    this.rows.set(agentId, row);
    this.audits.push({ organizationId, agentId, before, after: profile });
    return row;
  }
  async savePrompt(
    scope: SellerAgentScope,
    text: string,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const { agentId, organizationId } = scope;
    const before = this.rows.get(agentId) ?? null;
    const row: SellerProfileRow = {
      ...(before ?? {
        ...DEFAULT_SELLER_PROFILE,
        profileAppliedAt: null,
        factsHash: null,
        factsAppliedAt: null,
        lastError: null,
        lastErrorAt: null,
      }),
      promptText: text,
      organizationId,
      updatedAt: now,
      updatedBy: userId,
    };
    this.rows.set(agentId, row);
    return row;
  }
  async markProfileApplied(agentId: string, version: Date): Promise<void> {
    const row = this.rows.get(agentId);
    if (row) row.profileAppliedAt = version;
  }
  async markFactsApplied(agentId: string, hash: string, at: Date): Promise<void> {
    const row = this.rows.get(agentId);
    if (row) Object.assign(row, { factsHash: hash, factsAppliedAt: at });
  }
  async markError(agentId: string, message: string, at: Date): Promise<void> {
    const row = this.rows.get(agentId);
    if (row) Object.assign(row, { lastError: message, lastErrorAt: at });
  }
  async clearError(agentId: string): Promise<void> {
    const row = this.rows.get(agentId);
    if (row) Object.assign(row, { lastError: null, lastErrorAt: null });
  }
}

export class FakeFacts implements SellerFactsRepository {
  source: SellerFactsSource | null = null;
  asked: Array<{ organizationId: string; agentId: string; now: Date }> = [];
  /** Факты по агенту (SA2.5): без записи — общий `source`; у агента без филиала тест ставит `null` */
  byAgent = new Map<string, SellerFactsSource | null>();
  async load(scope: SellerAgentScope, now: Date): Promise<SellerFactsSource | null> {
    this.asked.push({ organizationId: scope.organizationId, agentId: scope.agentId, now });
    return this.byAgent.has(scope.agentId) ? this.byAgent.get(scope.agentId)! : this.source;
  }
}

export class FakeAudit implements SellerAudit {
  events: Array<{ entityType: string; action: string; entityId: string; after: unknown }> = [];
  async record(event: {
    entityType: string;
    entityId: string;
    action: string;
    after: Record<string, unknown>;
  }): Promise<void> {
    this.events.push(event);
  }
}

/** Расширение «ИИ-продавец» организации для тестов раздела (ADR-083): по умолчанию действует */
export class FakeSellerExtensions {
  access: ExtensionAccess = 'active';
  daysLeft: number | null = null;
  asked: string[] = [];
  async aiSeller(organizationId: string) {
    this.asked.push(organizationId);
    return {
      access: this.access,
      status: this.access === 'off' ? null : ('ACTIVE' as const),
      activeUntil: null,
      daysLeft: this.daysLeft,
    };
  }
}

/** Каталог агентов (SA1): расположение объекта и черновики по организациям */
export class FakeCatalog implements SellerCatalogRepository {
  placements = new Map<string, SellerCatalogPlacement>();
  draftRows = new Map<string, SellerCatalogDraft[]>();
  asked: string[] = [];
  async placement(organizationId: string): Promise<SellerCatalogPlacement | null> {
    this.asked.push(organizationId);
    return this.placements.get(organizationId) ?? null;
  }
  async drafts(organizationId: string, limit: number): Promise<SellerCatalogDraft[]> {
    return (this.draftRows.get(organizationId) ?? []).slice(0, limit);
  }
}


/**
 * Business Agents (SA2) в памяти: те же правила, что у настоящего хранилища — повтор по ключу, чужой ключ, занятый филиал,
 * рабочий продавец (`id = organization_id`) не отдаётся как черновик. Журнал — список событий.
 */
export class FakeBusinessAgents implements BusinessAgentsRepository {
  /** Business → филиалы по организациям; `archived` — снятые с показа */
  businesses = new Map<
    string,
    Array<{ id: string; name: string; archived?: boolean; locations: Array<{ id: string; name: string; archived?: boolean }> }>
  >();
  agents = new Map<
    string,
    {
      id: string;
      organizationId: string;
      createdBy: string;
      name: string;
      scenario: string;
      lifecycle: string;
      locationId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  events: Array<{ entityId: string; action: string; after: unknown; organizationId: string; userId: string }> = [];

  private find(organizationId: string, locationId: string) {
    for (const b of this.businesses.get(organizationId) ?? [])
      for (const l of b.locations) if (l.id === locationId) return { b, l };
    return null;
  }

  async options(organizationId: string): Promise<BusinessOption[]> {
    return (this.businesses.get(organizationId) ?? [])
      .filter((b) => !b.archived)
      .map((b) => ({
        id: b.id,
        name: b.name,
        locations: b.locations
          .filter((l) => !l.archived)
          .map((l) => ({
            id: l.id,
            name: l.name,
            taken: [...this.agents.values()].some(
              (a) => a.locationId === l.id && a.scenario === 'sales' && a.lifecycle !== 'archived',
            ),
          })),
      }));
  }

  async placement(organizationId: string, businessId: string, locationId: string): Promise<AgentPlacementRow | null> {
    const hit = this.find(organizationId, locationId);
    if (!hit || hit.b.id !== businessId || hit.b.archived || hit.l.archived) return null;
    return { business: { id: hit.b.id, name: hit.b.name }, location: { id: hit.l.id, name: hit.l.name } };
  }

  async create(input: {
    id: string;
    organizationId: string;
    userId: string;
    name: string;
    businessId: string;
    locationId: string;
  }): Promise<{ agent: BusinessAgentRecord; created: boolean }> {
    const existing = this.agents.get(input.id);
    if (existing) {
      if (
        existing.organizationId !== input.organizationId ||
        existing.createdBy !== input.userId ||
        existing.id === input.organizationId
      )
        throw new ForeignIdempotencyKeyError();
      return { agent: this.record(existing)!, created: false };
    }
    const taken = [...this.agents.values()].some(
      (a) => a.locationId === input.locationId && a.scenario === 'sales' && a.lifecycle !== 'archived',
    );
    if (taken) throw new LocationTakenError();
    const now = new Date('2026-09-30T08:00:00.000Z');
    const row = {
      id: input.id,
      organizationId: input.organizationId,
      createdBy: input.userId,
      name: input.name,
      scenario: 'sales',
      lifecycle: 'draft',
      locationId: input.locationId,
      createdAt: now,
      updatedAt: now,
    };
    this.agents.set(row.id, row);
    this.events.push({
      entityId: row.id,
      action: 'agent.created',
      after: { source: 'business-agent', businessId: input.businessId, locationId: input.locationId, lifecycle: 'draft' },
      organizationId: input.organizationId,
      userId: input.userId,
    });
    return { agent: this.record(row)!, created: true };
  }

  async get(organizationId: string, id: string): Promise<BusinessAgentRecord | null> {
    if (id === organizationId) return null;
    const row = this.agents.get(id);
    return row && row.organizationId === organizationId ? this.record(row) : null;
  }

  private record(row: {
    id: string;
    name: string;
    lifecycle: string;
    locationId: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): BusinessAgentRecord | null {
    if (!row.locationId) return null;
    const hit = this.find(row.organizationId, row.locationId);
    if (!hit) return null;
    return {
      id: row.id,
      name: row.name,
      lifecycle: row.lifecycle,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      business: { id: hit.b.id, name: hit.b.name },
      location: { id: hit.l.id, name: hit.l.name },
    };
  }
}
