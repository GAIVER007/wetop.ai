import { describe, expect, it } from 'vitest';
import { attachPartnerByCode } from './partner-attribution';

/** Регистрация по ссылке партнёра (DATA_MODEL §63.3): клиент сам привязывается к действующему партнёру по коду */
function fakeTx(partners: Array<{ id: string; code: string; active: boolean }>) {
  const links: Array<Record<string, unknown>> = [];
  const audit: Array<Record<string, unknown>> = [];
  return {
    links,
    audit,
    tx: {
      platformPartner: {
        findUnique: async ({ where }: { where: { code: string } }) => partners.find((p) => p.code === where.code) ?? null,
      },
      platformClientPartner: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          links.push(data);
          return data;
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          audit.push(data);
          return data;
        },
      },
    },
  };
}

describe('привязка клиента по ссылке партнёра', () => {
  it('действующий партнёр: строка LINK с каналом и запись в журнал', async () => {
    const f = fakeTx([{ id: 'p1', code: 'P007', active: true }]);
    expect(await attachPartnerByCode(f.tx, { organizationId: 'org-1', userId: 'u-1', code: ' p007 ', channel: 'Instagram' })).toBe('p1');
    expect(f.links).toEqual([{ organizationId: 'org-1', partnerId: 'p1', source: 'LINK', channel: 'instagram', updatedBy: 'u-1' }]);
    expect(f.audit[0]).toMatchObject({ entityType: 'organization', entityId: 'org-1', action: 'platform.client.partner_set', after: { partnerId: 'p1', source: 'LINK', channel: 'instagram' } });
  });

  it('нет кода, чужая строка, неизвестный или выключенный партнёр: регистрация как прямая, ничего не пишется', async () => {
    const f = fakeTx([{ id: 'p2', code: 'P002', active: false }]);
    for (const code of [undefined, '', 'drop table', 'P999', 'P002'])
      expect(await attachPartnerByCode(f.tx, { organizationId: 'org-1', userId: 'u-1', code, channel: null })).toBeNull();
    expect(f.links).toEqual([]);
    expect(f.audit).toEqual([]);
  });
});
