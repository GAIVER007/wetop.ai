import { assistant } from '@pms/integrations';
import { DEFAULT_SELLER_PROFILE } from '@pms/domain';
import type { ExtensionAccess, SellerFactsSource, SellerProfileInput } from '@pms/domain';
import type { SellerConfig, SellerConnection, SellerPort } from './seller.connection';
import type {
  SellerAudit,
  SellerFactsRepository,
  SellerOrganizationRow,
  SellerOrgsRepository,
  SellerProfileRow,
  SellerProfilesRepository,
} from './seller.repository';

/** Подставной продавец для тестов раздела: запоминает вызовы, отвечает заданным или падает заданной ошибкой */
export class FakeSeller implements SellerPort {
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

  listConversations(query: { mode?: string; limit?: number }) {
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
  reply(id: string, text: string) {
    return this.call('reply', id, text);
  }
  knowledge() {
    return this.call('knowledge');
  }
  uploadKnowledge(file: { name: string; type: string; data: Uint8Array }) {
    return this.call('uploadKnowledge', file);
  }
  summary() {
    return this.call('summary');
  }
  sandbox(input: { externalId: string; text: string }) {
    return this.call('sandbox', input);
  }
  putProfile(payload: unknown) {
    return this.call('putProfile', payload);
  }
  putSellerPrompt(payload: { object_name: string; text: string }) {
    return this.call('putSellerPrompt', payload);
  }
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
  constructor(
    public settings: SellerConfig,
    public seller: FakeSeller = new FakeSeller(),
  ) {}
  config(): SellerConfig {
    return this.settings;
  }
  client(organizationId?: string): SellerPort | null {
    if (!this.settings.baseUrl || !this.settings.serviceKey) return null;
    this.requestedOrgs.push(organizationId);
    return this.seller;
  }
}

/** Гостиницы для сверки (Э4): организации со строкой расширения и домены их сайтов */
export class FakeOrgs implements SellerOrgsRepository {
  rows: SellerOrganizationRow[] = [];
  siteHosts = new Map<string, string[]>();
  async withExtension(): Promise<SellerOrganizationRow[]> {
    return this.rows;
  }
  async one(organizationId: string): Promise<SellerOrganizationRow | null> {
    return this.rows.find((r) => r.organizationId === organizationId) ?? null;
  }
  async hosts(organizationId: string): Promise<string[]> {
    return this.siteHosts.get(organizationId) ?? [];
  }
}

export class FakeProfiles implements SellerProfilesRepository {
  rows = new Map<string, SellerProfileRow>();
  audits: Array<{ organizationId: string; before: unknown; after: unknown }> = [];

  async get(organizationId: string): Promise<SellerProfileRow | null> {
    return this.rows.get(organizationId) ?? null;
  }
  async save(
    organizationId: string,
    profile: SellerProfileInput,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const before = this.rows.get(organizationId) ?? null;
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
    this.rows.set(organizationId, row);
    this.audits.push({ organizationId, before, after: profile });
    return row;
  }
  async savePrompt(
    organizationId: string,
    text: string,
    userId: string | null,
    now: Date,
  ): Promise<SellerProfileRow> {
    const before = this.rows.get(organizationId) ?? null;
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
    this.rows.set(organizationId, row);
    return row;
  }
  async markProfileApplied(organizationId: string, version: Date): Promise<void> {
    const row = this.rows.get(organizationId);
    if (row) row.profileAppliedAt = version;
  }
  async markFactsApplied(organizationId: string, hash: string, at: Date): Promise<void> {
    const row = this.rows.get(organizationId);
    if (row) Object.assign(row, { factsHash: hash, factsAppliedAt: at });
  }
  async markError(organizationId: string, message: string, at: Date): Promise<void> {
    const row = this.rows.get(organizationId);
    if (row) Object.assign(row, { lastError: message, lastErrorAt: at });
  }
  async clearError(organizationId: string): Promise<void> {
    const row = this.rows.get(organizationId);
    if (row) Object.assign(row, { lastError: null, lastErrorAt: null });
  }
}

export class FakeFacts implements SellerFactsRepository {
  source: SellerFactsSource | null = null;
  asked: Array<{ organizationId: string; now: Date }> = [];
  async load(organizationId: string, now: Date): Promise<SellerFactsSource | null> {
    this.asked.push({ organizationId, now });
    return this.source;
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
