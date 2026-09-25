import { assistant } from '@pms/integrations';
import type { ExtensionAccess, SellerFactsSource, SellerProfileInput } from '@pms/domain';
import type { SellerConfig, SellerConnection, SellerPort } from './seller.connection';
import type {
  SellerAudit,
  SellerFactsRepository,
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
  putFacts(payload: unknown) {
    return this.call('putFacts', payload);
  }

  ops(): string[] {
    return this.calls.map((c) => c.op);
  }
}

export const unavailable = () => new assistant.SellerUnavailableError('ИИ-продавец недоступен (HTTP 502)');
export const rejected = (status: number, detail: string, fields: string[] = []) =>
  new assistant.SellerRejectedError(status, detail, fields);

export class FakeConnection implements SellerConnection {
  constructor(
    public settings: SellerConfig,
    public seller: FakeSeller = new FakeSeller(),
  ) {}
  config(): SellerConfig {
    return this.settings;
  }
  client(): SellerPort | null {
    return this.settings.baseUrl && this.settings.serviceKey ? this.seller : null;
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
