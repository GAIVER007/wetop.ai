import 'reflect-metadata';
import { canWrite } from '@pms/domain';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';
import { currentUserId, currentOrganizationId, currentRole } from '../auth/request-context';

@Injectable()
export class SellerAgentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async owner() {
    if (process.env.WIZARD_ENABLED !== '1')
      throw new ServiceUnavailableException('Создание агентов пока не включено');
    const userId = currentUserId(),
      organizationId = currentOrganizationId();
    if (!userId || !organizationId)
      throw new UnauthorizedException('Войдите в аккаунт, чтобы сохранить агента');
    if (currentRole() !== 'OWNER')
      throw new ForbiddenException('Создавать агентов может владелец организации');
    const membership = await this.prisma.db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true, organization: true },
    });
    if (
      !membership ||
      membership.role !== 'OWNER' ||
      membership.user.status !== 'ACTIVE' ||
      !membership.user.emailVerifiedAt ||
      !canWrite(membership.organization.status, membership.organization.trialEndsAt, new Date())
    )
      throw new ForbiddenException('Нет доступа к созданию агентов');
    return { userId, organizationId };
  }
  async list() {
    const { organizationId } = await this.owner();
    return {
      items: await this.prisma.db.sellerAgent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          scenario: true,
          lifecycle: true,
          profile: true,
          updatedAt: true,
        },
      }),
    };
  }
  async claim(token: string | undefined) {
    const { userId, organizationId } = await this.owner();
    if (!token || !/^wz_[a-f0-9]{64}$/.test(token))
      throw new UnauthorizedException('Черновик не найден');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.prisma.db.$transaction(async (tx) => {
      // All claims of this bearer serialize; config writes also lock this row.
      const sessions = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM wizard_sessions WHERE token_hash=${tokenHash} FOR UPDATE`;
      if (!sessions[0]) throw new NotFoundException('Черновик не найден');
      const session = await tx.wizardSession.findUnique({
        where: { id: sessions[0].id },
        include: { draft: true },
      });
      if (!session?.draft || session.expiresAt <= new Date())
        throw new UnauthorizedException('Сессия мастера истекла');
      const draft = session.draft;
      if (draft.agentId) {
        if (draft.claimedBy !== userId || draft.organizationId !== organizationId)
          throw new NotFoundException('Черновик не найден');
        return { id: draft.agentId };
      }
      if (!draft.businessName.trim() || !draft.niche.trim())
        throw new BadRequestException('Заполните компанию и нишу');
      const profile = draft.config as Record<string, string>;
      const agent = await tx.sellerAgent.create({
        data: {
          organizationId,
          createdBy: userId,
          name: profile.assistantName || draft.businessName,
          scenario: profile.botType || 'sales',
          profile: draft.config!,
          lifecycle: 'draft',
        },
      });
      const updated = await tx.wizardDraft.updateMany({
        where: { id: draft.id, revision: draft.revision, agentId: null },
        data: { agentId: agent.id, claimedBy: userId, organizationId },
      });
      if (updated.count !== 1)
        throw new BadRequestException('Черновик изменился. Повторите сохранение');
      await tx.wizardSession.update({ where: { id: session.id }, data: { lastStep: 'signup' } });
      await tx.wizardEvent.create({
        data: {
          guestSessionId: session.id,
          eventType: 'complete',
          deduplicationKey: `complete:${session.id}`,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'seller-agent',
          entityId: agent.id,
          action: 'agent.created',
          after: { source: 'guest-draft', lifecycle: 'draft' },
        },
      });
      return { id: agent.id };
    });
  }
}
