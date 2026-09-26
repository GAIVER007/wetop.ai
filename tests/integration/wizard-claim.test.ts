import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { WizardService } from '../../apps/api/src/wizard/wizard.service';
import { SellerAgentsService } from '../../apps/api/src/wizard/seller-agents.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

it.skipIf(!process.env.DATABASE_URL?.includes('@127.0.0.1:55432/'))(
  'claim is idempotent, owner-only and isolated across organizations',
  async () => {
    const db = createPrismaClient();
    const org = randomUUID(),
      user = randomUUID(),
      other = randomUUID();
    let session = '';
    process.env.WIZARD_ENABLED = '1';
    process.env.WIZARD_SESSION_TTL_SECONDS = '3600';
    const provider = { db } as PrismaService;
    const wizard = new WizardService(provider);
    const agents = new SellerAgentsService(provider);
    const actor = { userId: user, organizationId: org, role: 'OWNER' as const };
    try {
      await db.organization.create({
        data: { id: org, name: 'Synthetic claim', status: 'ACTIVE' },
      });
      await db.user.create({
        data: { id: user, email: `${user}@example.invalid`, emailVerifiedAt: new Date() },
      });
      await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER' } });
      const first = await wizard.open(undefined, 'test');
      if (!('guestToken' in first)) throw Error('token');
      session = first.guestSessionId;
      await wizard.save(first.guestToken, {
        revision: 0,
        step: 'review',
        config: { businessName: 'Synthetic business', niche: 'Hotel', assistantName: 'Assistant' },
      });
      await expect(agents.claim(first.guestToken)).rejects.toThrow();
      await expect(
        withSignedInUser({ ...actor, role: 'STAFF' }, () => agents.claim(first.guestToken)),
      ).rejects.toThrow();
      const results = await Promise.all(
        [1, 2].map(() => withSignedInUser(actor, () => agents.claim(first.guestToken))),
      );
      expect(results[0]!.id).toBe(results[1]!.id);
      const card = await withSignedInUser(actor, () => agents.get(results[0]!.id));
      const changes = await Promise.allSettled(
        ['First', 'Second'].map((assistantName) =>
          withSignedInUser(actor, () =>
            agents.update(card.id, {
              profile: { ...card.profile, assistantName },
              updatedAt: card.updatedAt.toISOString(),
            }),
          ),
        ),
      );
      expect(changes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refreshed = await withSignedInUser(actor, () => agents.get(card.id));
      expect(['First', 'Second']).toContain(refreshed.name);
      await expect(
        withSignedInUser(actor, () =>
          agents.update(card.id, {
            profile: { businessName: '' },
            updatedAt: refreshed.updatedAt.toISOString(),
          }),
        ),
      ).rejects.toThrow();

      expect(await db.sellerAgent.count({ where: { organizationId: org } })).toBe(1);
      await expect(
        withSignedInUser({ userId: other, organizationId: other, role: 'OWNER' }, () =>
          agents.claim(first.guestToken),
        ),
      ).rejects.toThrow();
      expect((await withSignedInUser(actor, () => agents.list())).items).toHaveLength(1);
      await expect(
        wizard.save(first.guestToken, { revision: 1, step: 'review', config: { goal: 'changed' } }),
      ).rejects.toThrow();
      const requestId = randomUUID();
      const input = {
        id: requestId,
        profile: {
          businessName: 'Synthetic direct',
          niche: 'Hotel',
          assistantName: 'Direct assistant',
        },
      };
      await expect(agents.create(input)).rejects.toThrow();
      const direct = await Promise.all(
        [1, 2].map(() => withSignedInUser(actor, () => agents.create(input))),
      );
      expect(direct[0]!.id).toBe(direct[1]!.id);
      expect((await withSignedInUser(actor, () => agents.get(requestId))).name).toBe(
        'Direct assistant',
      );
      expect(
        await db.auditLog.count({ where: { entityId: requestId, action: 'agent.created' } }),
      ).toBe(1);
    } finally {
      if (session) await db.wizardSession.deleteMany({ where: { id: session } });
      await db.auditLog.deleteMany({ where: { entityType: 'seller-agent', userId: user } });
      await db.sellerAgent.deleteMany({ where: { organizationId: org } });
      await db.membership.deleteMany({ where: { organizationId: org } });
      await db.user.deleteMany({ where: { id: user } });
      await db.organization.deleteMany({ where: { id: org } });
      await db.$disconnect();
    }
  },
);
