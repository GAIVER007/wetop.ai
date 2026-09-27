import 'reflect-metadata';
import { can, canWrite } from '@pms/domain';
import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { wizardConfig } from './wizard-input';
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
    // агенты — настройки ИИ-продавца: владелец и управляющий (ADR-104, DATA_MODEL §16.5)
    if (!can(currentRole(), 'seller'))
      throw new ForbiddenException('Создавать агентов могут владелец и управляющий');
    const membership = await this.prisma.db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: true, organization: true },
    });
    if (
      !membership ||
      !can(membership.role, 'seller') ||
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
  private validId(id: string) {
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
      throw new NotFoundException('Агент не найден');
  }
  async get(id: string) {
    this.validId(id);
    const { organizationId } = await this.owner();
    const agent = await this.prisma.db.sellerAgent.findFirst({ where: { id, organizationId } });
    if (!agent) throw new NotFoundException('Агент не найден');
    return { ...agent, profile: agent.profile as Record<string, string> };
  }
  async update(id: string, body: unknown) {
    this.validId(id);
    const { organizationId, userId } = await this.owner();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Проверьте настройки');
    const input = body as { profile?: unknown; updatedAt?: unknown };
    const profile = wizardConfig(input.profile);
    if (!profile.businessName || !profile.niche)
      throw new BadRequestException('Заполните компанию и нишу');
    if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt)))
      throw new BadRequestException('Обновите карточку');
    const expected = new Date(input.updatedAt);
    const name = profile.assistantName || profile.businessName;
    return this.prisma.db.$transaction(async (tx) => {
      const before = await tx.sellerAgent.findFirst({ where: { id, organizationId } });
      if (!before) throw new NotFoundException('Агент не найден');
      if (before.lifecycle !== 'draft')
        throw new ConflictException('Настройки работающего агента меняются через публикацию');
      const updatedAt = new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1));
      const changed = await tx.sellerAgent.updateMany({
        where: { id, organizationId, updatedAt: expected, lifecycle: 'draft' },
        data: {
          profile,
          name,
          scenario: profile.botType || 'sales',
          updatedAt,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Агент изменён в другой вкладке. Обновите карточку');
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'seller-agent',
          entityId: id,
          action: 'agent.updated',
          after: { fields: Object.keys(profile) },
        },
      });
      return { id, updatedAt: updatedAt.toISOString() };
    });
  }
  async create(body: unknown) {
    const { userId, organizationId } = await this.owner();
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Проверьте настройки');
    const input = body as { id?: unknown; profile?: unknown };
    if (typeof input.id !== 'string') throw new BadRequestException('Обновите форму');
    const id = input.id;
    this.validId(id);
    const profile = wizardConfig(input.profile);
    if (!profile.businessName || !profile.niche)
      throw new BadRequestException('Заполните компанию и нишу');
    const name = profile.assistantName || profile.businessName;
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
      const existing = await tx.sellerAgent.findUnique({ where: { id } });
      if (existing) {
        if (existing.organizationId !== organizationId || existing.createdBy !== userId)
          throw new NotFoundException('Агент не найден');
        return { id };
      }
      await tx.sellerAgent.create({
        data: {
          id,
          organizationId,
          createdBy: userId,
          name,
          scenario: profile.botType || 'sales',
          lifecycle: 'draft',
          profile,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'seller-agent',
          entityId: id,
          action: 'agent.created',
          after: { source: 'account', lifecycle: 'draft' },
        },
      });
      return { id };
    });
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
