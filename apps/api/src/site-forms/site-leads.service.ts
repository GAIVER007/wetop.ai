import 'reflect-metadata';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isSiteLeadStatus, SITE_LEAD_STATUSES, type SiteLeadStatus } from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { siteScope, siteTransaction } from '../marketing-site/scope';

/**
 * Заявки с сайта без слота во «Входящих» (SITE-5, ADR-185, DATA_MODEL §46): список и статус заявок выбранного филиала.
 * Право `dialogs`, как у диалогов ИИ-продавца: заявку разбирает тот же человек смены, что отвечает клиентам
 * (администратор, управляющий, владелец). Право организационное (`ORGANIZATION_LEVEL_PERMISSIONS`): сотруднику с
 * назначением только на филиалы закрыто, как и диалоги. Филиал только из проверенного указателя (`siteScope`), чужой заявки не видно
 * ни по id, ни в списке (плюс RLS по организации). Лицензия конструктора для чтения и смены статуса не нужна:
 * заявки уже пришли, их надо разобрать и после выключения конструктора.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 50;

const LEAD_SELECT = {
  id: true,
  name: true,
  phone: true,
  comment: true,
  kind: true,
  status: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  trackedSite: { select: { id: true, name: true } },
} as const;

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  comment: string | null;
  kind: string;
  status: string;
  source: unknown;
  createdAt: Date;
  updatedAt: Date;
  trackedSite: { id: string; name: string };
};

const view = (r: LeadRow) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  comment: r.comment,
  kind: r.kind,
  status: r.status,
  source: r.source ?? null,
  site: r.trackedSite,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

@Injectable()
export class SiteLeadsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(pointerSent: boolean, query: { status?: unknown; cursor?: unknown; limit?: unknown }) {
    const scope = siteScope(pointerSent, 'dialogs');
    const status = query.status === undefined || query.status === '' ? null : query.status;
    if (status !== null && !isSiteLeadStatus(status))
      throw new BadRequestException(`status: ${SITE_LEAD_STATUSES.join(', ')}`);
    const cursor = query.cursor === undefined || query.cursor === '' ? null : query.cursor;
    if (cursor !== null && (typeof cursor !== 'string' || !UUID_RE.test(cursor))) throw new BadRequestException('cursor: UUID');
    const limit = query.limit === undefined ? PAGE : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit: от 1 до 100');
    return siteTransaction(this.prisma, scope, false, async (tx) => {
      const where = { locationId: scope.locationId, ...(status ? { status: status as SiteLeadStatus } : {}) };
      const rows = await tx.siteLead.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: LEAD_SELECT,
      });
      const fresh = await tx.siteLead.count({ where: { locationId: scope.locationId, status: 'NEW' } });
      return {
        items: rows.slice(0, limit).map(view),
        nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        newCount: fresh,
      };
    });
  }

  async update(pointerSent: boolean, id: string, body: unknown) {
    const scope = siteScope(pointerSent, 'dialogs');
    if (!UUID_RE.test(id)) throw new NotFoundException('Заявка не найдена');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Ожидается объект');
    const extra = Object.keys(body).filter((k) => k !== 'status');
    if (extra.length) throw new BadRequestException(`Лишние поля: ${extra.join(', ')}`);
    const next = (body as { status?: unknown }).status;
    if (!isSiteLeadStatus(next)) throw new BadRequestException(`status: ${SITE_LEAD_STATUSES.join(', ')}`);
    return siteTransaction(
      this.prisma,
      scope,
      true,
      async (tx) => {
        const row = await tx.siteLead.findFirst({ where: { id, locationId: scope.locationId }, select: { id: true, status: true } });
        if (!row) throw new NotFoundException('Заявка не найдена');
        if (row.status !== next) {
          const changed = await tx.siteLead.updateMany({ where: { id, status: row.status }, data: { status: next } });
          if (changed.count !== 1) throw new ConflictException('Заявка уже изменена, обновите список');
          await tx.auditLog.create({
            data: {
              organizationId: scope.organizationId,
              userId: currentUserId(),
              entityType: 'site_lead',
              entityId: id,
              action: 'site.lead.status',
              before: { status: row.status },
              after: { status: next },
            },
          });
        }
        return view(await tx.siteLead.findUniqueOrThrow({ where: { id }, select: LEAD_SELECT }));
      },
      { license: false },
    );
  }
}
