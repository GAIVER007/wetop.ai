import { assertBeautyOperation } from './access';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Ip,
  NotFoundException,
  Optional,
  Param,
  Post,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { newSessionToken } from '@pms/shared';
import { Access } from '../auth/access.decorator';
import { BeautyAccess } from './access.decorator';
import { AttemptWindows, visitorKey } from '../auth/attempt-limits';
import { RequiresBusinessCapability } from '../auth/capability.decorator';
import { Public } from '../auth/public.decorator';
import { currentUserId, withServiceDatabase } from '../auth/request-context';
import { PrismaService } from '../database/prisma.provider';
import { visitorIp } from '../web-booking/client-ip';
import { beautyScope, beautyTransaction, UUID } from './scope';

export const BEAUTY_REVIEW_CLOCK = Symbol('BEAUTY_REVIEW_CLOCK');
const THIRTY_DAYS_MS = 30 * 86_400_000;
const TOKEN = /^[A-Za-z0-9_-]{40,100}$/;
const MASTER_KEY = /^[a-f0-9]{64}$/;

export interface BeautyReviewRequestContext {
  ip: string | null;
  now?: Date;
}
export interface BeautyReviewInvitationResult {
  reviewPath: string;
  expiresAt: string;
  masterCount: number;
}
export type BeautyPublicReviewResult =
  | { status: 'SUBMITTED' }
  | { status: 'OPEN'; expiresAt: string; masters: Array<{ key: string; name: string }> };
export interface BeautyReviewSubmissionResult {
  status: 'SUBMITTED';
  submittedCount: number;
}
interface ParsedReview {
  masterKey: string;
  stars: number;
  comment: string | null;
}
const uniqueMasters = <T extends { employeeId: string; employee: { name: string } }>(
  lines: T[],
) => {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.employeeId)) return false;
    seen.add(line.employeeId);
    return true;
  });
};

const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

const masterKey = (tokenHash: string, employeeId: string) =>
  hashToken(`${tokenHash}:${employeeId}`);

function parseSubmission(raw: unknown): ParsedReview[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BadRequestException('Укажите оценки мастеров');
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== 'reviews') || !Array.isArray(body['reviews']))
    throw new BadRequestException('Укажите оценки мастеров');
  if (body['reviews'].length < 1) throw new BadRequestException('Укажите хотя бы одну оценку');
  if (body['reviews'].length > 100) throw new BadRequestException('Слишком много оценок');
  const reviews = body['reviews'].map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('Некорректная оценка');
    const row = value as Record<string, unknown>;
    if (Object.keys(row).some((key) => !['masterKey', 'stars', 'comment'].includes(key)))
      throw new BadRequestException('Некорректная оценка');
    const key = String(row['masterKey'] ?? '');
    const stars = row['stars'];
    if (!MASTER_KEY.test(key)) throw new BadRequestException('Некорректный мастер');
    if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5)
      throw new BadRequestException('Оценка должна быть от 1 до 5');
    if (
      row['comment'] !== undefined &&
      row['comment'] !== null &&
      typeof row['comment'] !== 'string'
    )
      throw new BadRequestException('Некорректный комментарий');
    const comment = typeof row['comment'] === 'string' ? row['comment'].trim() : '';
    if (comment.length > 2000)
      throw new BadRequestException('Комментарий не должен превышать 2000 знаков');
    return { masterKey: key, stars, comment: comment || null };
  });
  if (new Set(reviews.map((review) => review.masterKey)).size !== reviews.length)
    throw new BadRequestException('Мастер указан дважды');
  return reviews;
}

@Injectable()
export class BeautyReviewsService {
  private readonly now: () => Date;
  private readonly readPerIp = new AttemptWindows(30, 60_000);
  private readonly submitPerIp = new AttemptWindows(5, 3_600_000);
  private readonly submitPerToken = new AttemptWindows(10, 3_600_000);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(BEAUTY_REVIEW_CLOCK) clock?: () => Date,
  ) {
    this.now = clock ?? (() => new Date());
  }

  async issue(appointmentId: string): Promise<BeautyReviewInvitationResult> {
    await assertBeautyOperation(this.prisma.db, 'reviews', 'create', { legacy: 'staff' });
    if (!UUID.test(appointmentId)) throw new NotFoundException('Запись не найдена');
    const scope = await beautyScope(this.prisma, true);
    const now = this.now();
    return withServiceDatabase(() => beautyTransaction(this.prisma, scope, async (tx) => {
      await tx.$queryRaw`SELECT id FROM appointments WHERE id=${appointmentId}::uuid FOR UPDATE`;
      const appointment = await tx.appointment.findFirst({
        where: { id: appointmentId, locationId: scope.locationId! },
        select: {
          id: true,
          status: true,
          lines: {
            orderBy: { position: 'asc' },
            select: {
              employeeId: true,
              employee: { select: { name: true } },
            },
          },
        },
      });
      if (!appointment) throw new NotFoundException('Запись не найдена');
      if (appointment.status !== 'DONE')
        throw new ConflictException('Отзыв доступен только после завершения записи');
      const masters = uniqueMasters(appointment.lines);
      if (!masters.length) throw new ConflictException('В записи нет мастеров для оценки');
      const completed = await tx.auditLog.findFirst({
        where: {
          organizationId: scope.organizationId,
          entityType: 'appointment',
          entityId: appointment.id,
          action: 'beauty.appointment.status',
          after: { path: ['status'], equals: 'DONE' },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { createdAt: true },
      });
      if (!completed) throw new ConflictException('Completion time is unavailable');
      const expiresAt = new Date(completed.createdAt.getTime() + THIRTY_DAYS_MS);
      if (now >= expiresAt) throw new ConflictException('Review invitation expired');
      await tx.$queryRaw`SELECT appointment_id FROM beauty_review_invitations
        WHERE appointment_id=${appointment.id}::uuid FOR UPDATE`;
      const current = await tx.beautyReviewInvitation.findUnique({
        where: { appointmentId: appointment.id },
      });
      if (current?.submittedAt) throw new ConflictException('Review invitation already submitted');
      const token = newSessionToken();
      const tokenHash = hashToken(token);
      await tx.beautyReviewInvitation.upsert({
        where: { appointmentId: appointment.id },
        create: { appointmentId: appointment.id, tokenHash, expiresAt },
        update: { tokenHash, expiresAt },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          userId: currentUserId(),
          entityType: 'appointment',
          entityId: appointment.id,
          action: current ? 'beauty.review_invitation.rotated' : 'beauty.review_invitation.issued',
          after: { expiresAt: expiresAt.toISOString(), masterCount: masters.length },
        },
      });
      return {
        reviewPath: `/reviews/${token}`,
        expiresAt: expiresAt.toISOString(),
        masterCount: masters.length,
      };
    }));
  }

  async read(
    token: string,
    context: BeautyReviewRequestContext,
  ): Promise<BeautyPublicReviewResult> {
    const now = context.now ?? this.now();
    this.limit(this.readPerIp, context.ip, now, 'Слишком много запросов. Повторите через минуту.');
    const invitation = await this.invitation(token);
    if (!invitation) throw new NotFoundException('Ссылка недействительна или истекла');
    if (invitation.submittedAt) return { status: 'SUBMITTED' };
    if (invitation.appointment.status !== 'DONE' || now >= invitation.expiresAt)
      throw new NotFoundException('Ссылка недействительна или истекла');
    const masters = uniqueMasters(invitation.appointment.lines);
    if (!masters.length) throw new NotFoundException('Ссылка недействительна или истекла');
    return {
      status: 'OPEN',
      expiresAt: invitation.expiresAt.toISOString(),
      masters: masters.map((line) => ({
        key: masterKey(invitation.tokenHash, line.employeeId),
        name: line.employee.name,
      })),
    };
  }

  async submit(
    token: string,
    raw: unknown,
    context: BeautyReviewRequestContext,
  ): Promise<BeautyReviewSubmissionResult> {
    const parsed = parseSubmission(raw);
    const now = context.now ?? this.now();
    this.limit(this.submitPerIp, context.ip, now, 'Слишком много отправок. Повторите позже.');
    const tokenHash = this.tokenHash(token);
    if (!this.submitPerToken.allow(tokenHash, now.getTime()))
      throw new HttpException('Слишком много отправок. Повторите позже.', 429);
    return this.prisma.db.$transaction(async (tx) => {
      const candidate = await tx.beautyReviewInvitation.findUnique({
        where: { tokenHash },
        select: { appointmentId: true },
      });
      if (!candidate) throw new NotFoundException('Ссылка недействительна или истекла');
      // Match issuance and appointment mutations: appointment first, invitation second.
      await tx.$queryRaw`SELECT id FROM appointments WHERE id=${candidate.appointmentId}::uuid FOR UPDATE`;
      const locked = await tx.$queryRaw<Array<{ appointment_id: string }>>`
        SELECT appointment_id::text FROM beauty_review_invitations WHERE token_hash=${tokenHash} FOR UPDATE`;
      if (!locked[0]) throw new NotFoundException('Ссылка недействительна или истекла');
      const invitation = await tx.beautyReviewInvitation.findUnique({
        where: { tokenHash },
        select: {
          tokenHash: true,
          expiresAt: true,
          submittedAt: true,
          appointment: {
            select: {
              id: true,
              status: true,
              location: {
                select: { business: { select: { organizationId: true, vertical: true } } },
              },
              lines: {
                orderBy: { position: 'asc' },
                select: { employeeId: true, employee: { select: { name: true } } },
              },
            },
          },
        },
      });
      if (!invitation) throw new NotFoundException('Ссылка недействительна или истекла');
      if (invitation.submittedAt)
        throw new ConflictException('Review invitation already submitted');
      if (
        invitation.appointment.status !== 'DONE' ||
        invitation.appointment.location.business.vertical !== 'BEAUTY' ||
        now >= invitation.expiresAt
      )
        throw new NotFoundException('Ссылка недействительна или истекла');
      const masters = uniqueMasters(invitation.appointment.lines);
      const byKey = new Map(
        masters.map((line) => [masterKey(invitation.tokenHash, line.employeeId), line.employeeId]),
      );
      const selected = parsed.map((review) => ({
        ...review,
        employeeId: byKey.get(review.masterKey),
      }));
      if (selected.some((review) => !review.employeeId))
        throw new BadRequestException('Выбранный мастер не относится к этой записи');
      await tx.beautyAppointmentReview.createMany({
        data: selected.map((review) => ({
          appointmentId: invitation.appointment.id,
          employeeId: review.employeeId!,
          stars: review.stars,
          comment: review.comment,
          submittedAt: now,
        })),
      });
      await tx.beautyReviewInvitation.update({
        where: { appointmentId: invitation.appointment.id },
        data: { submittedAt: now },
      });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.appointment.location.business.organizationId,
          userId: null,
          entityType: 'appointment',
          entityId: invitation.appointment.id,
          action: 'beauty.reviews.submitted',
          after: { count: selected.length, stars: selected.map((review) => review.stars) },
        },
      });
      return { status: 'SUBMITTED', submittedCount: selected.length };
    });
  }

  private tokenHash(token: string): string {
    if (!TOKEN.test(token)) throw new NotFoundException('Ссылка недействительна или истекла');
    return hashToken(token);
  }

  private invitation(token: string) {
    const tokenHash = this.tokenHash(token);
    return this.prisma.db.beautyReviewInvitation.findUnique({
      where: { tokenHash },
      select: {
        tokenHash: true,
        expiresAt: true,
        submittedAt: true,
        appointment: {
          select: {
            status: true,
            lines: {
              orderBy: { position: 'asc' as const },
              select: { employeeId: true, employee: { select: { name: true } } },
            },
          },
        },
      },
    });
  }

  private limit(windows: AttemptWindows, ip: string | null, now: Date, message: string): void {
    if (ip && !windows.allow(visitorKey(ip), now.getTime())) throw new HttpException(message, 429);
  }
}

@RequiresBusinessCapability('beauty.appointments')
@Access('desk')
@Controller('beauty/appointments')
export class BeautyReviewInvitationController {
  constructor(@Inject(BeautyReviewsService) private readonly service: BeautyReviewsService) {}
  @BeautyAccess('reviews', 'create')
  @Post(':id/review-invitation') issue(@Param('id') appointmentId: string) {
    return this.service.issue(appointmentId);
  }
}

@Public()
@Controller('beauty/reviews')
export class BeautyPublicReviewsController {
  constructor(@Inject(BeautyReviewsService) private readonly service: BeautyReviewsService) {}
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  read(
    @Param('token') token: string,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    return this.service.read(token, { ip: visitorIp(socketIp, cfConnectingIp) });
  }
  @Post(':token')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  submit(
    @Param('token') token: string,
    @Body() body: unknown,
    @Ip() socketIp: string,
    @Headers('cf-connecting-ip') cfConnectingIp?: string,
  ) {
    return this.service.submit(token, body, { ip: visitorIp(socketIp, cfConnectingIp) });
  }
}
