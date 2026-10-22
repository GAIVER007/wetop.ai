import 'reflect-metadata';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { monthPeriod, periodBoundsUtc, todayAt } from '@pms/domain';
import { currentUserId } from '../auth/request-context';
import {
  MARKETING_VOICE_REPOSITORY,
  type CallbackRecord,
  type MarketingVoiceRepository,
  type ReadScope,
} from './marketing-voice.repository';

export const VOICE_USER_ID = Symbol('VOICE_USER_ID');
export const VOICE_NOW = Symbol('VOICE_NOW');

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;

export interface VoiceSummaryView {
  month: string;
  timezone: string;
  hasData: boolean;
  totals: {
    calls: number;
    answered: number;
    ended: number;
    rejected: number;
    failed: number;
    callbacks: number;
    transfers: number;
    /** null: нет ни одного звонка с длительностью, а не ноль */
    avgDurationSeconds: number | null;
  };
}

export interface VoiceCallView {
  id: string;
  receivedAt: string;
  callerMasked: string | null;
  state: string;
  direction: string;
  durationSeconds: number | null;
  transferRequested: boolean;
  callbackRequested: boolean;
  endReason: string | null;
}

export interface VoiceCallbackView {
  id: string;
  callId: string;
  phone: string;
  name: string;
  note: string;
  status: 'NEW' | 'DONE';
  createdAt: string;
  doneAt: string | null;
}

const callbackView = (r: CallbackRecord): VoiceCallbackView => ({
  id: r.id, callId: r.callId, phone: r.phone, name: r.name, note: r.note, status: r.status,
  createdAt: r.createdAt.toISOString(), doneAt: r.doneAt ? r.doneAt.toISOString() : null,
});

/** Целое из строки запроса в пределах; пусто даёт умолчание */
function intParam(value: unknown, name: string, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) throw new BadRequestException(`${name}: ожидалось целое число`);
  if (n < min) throw new BadRequestException(`${name}: не меньше ${min}`);
  return Math.min(n, max);
}

/** Журнал звонков голосового агента и очередь просьб перезвонить (право `marketing`, филиал строго из указателя) */
@Injectable()
export class MarketingVoiceService {
  private readonly userId: () => string | null;
  private readonly now: () => Date;

  constructor(
    @Inject(MARKETING_VOICE_REPOSITORY) private readonly repo: MarketingVoiceRepository,
    @Optional() @Inject(VOICE_USER_ID) userId?: () => string | null,
    @Optional() @Inject(VOICE_NOW) now?: () => Date,
  ) {
    this.userId = userId ?? currentUserId;
    this.now = now ?? (() => new Date());
  }

  private window(scope: ReadScope, month: unknown): { month: string; start: Date; end: Date } {
    let ym: string;
    if (month === undefined || month === null || month === '') ym = todayAt(scope.timezone, this.now()).slice(0, 7);
    else if (typeof month === 'string' && MONTH.test(month)) ym = month;
    else throw new BadRequestException('month: ожидался формат ГГГГ-ММ');
    const { from, to } = monthPeriod(ym);
    const { startUtc, endUtcExclusive } = periodBoundsUtc(from, to, scope.timezone);
    return { month: ym, start: startUtc, end: endUtcExclusive };
  }

  async summary(month: unknown): Promise<VoiceSummaryView> {
    const scope = await this.repo.scope();
    const w = this.window(scope, month);
    const d = await this.repo.summary(scope, w.start, w.end);
    return {
      month: w.month,
      timezone: scope.timezone,
      hasData: d.total > 0,
      totals: {
        calls: d.total,
        answered: d.answered,
        ended: d.byState.ENDED,
        rejected: d.byState.REJECTED,
        failed: d.byState.FAILED,
        callbacks: d.withCallback,
        transfers: d.withTransfer,
        avgDurationSeconds: d.durationCount > 0 ? Math.round(d.durationSum / d.durationCount) : null,
      },
    };
  }

  async calls(query: { month?: unknown; limit?: unknown; offset?: unknown }) {
    const scope = await this.repo.scope();
    const w = this.window(scope, query.month);
    const limit = intParam(query.limit, 'limit', 1, MAX_LIMIT, DEFAULT_LIMIT);
    const offset = intParam(query.offset, 'offset', 0, MAX_OFFSET, 0);
    const { rows, total } = await this.repo.calls(scope, w.start, w.end, limit, offset);
    return {
      month: w.month,
      timezone: scope.timezone,
      total,
      rows: rows.map(
        (r): VoiceCallView => ({
          id: r.id,
          receivedAt: r.receivedAt.toISOString(),
          callerMasked: r.callerMasked,
          state: r.state,
          direction: r.direction,
          durationSeconds: r.durationSeconds,
          transferRequested: r.transferRequested,
          callbackRequested: r.callbackRequested,
          endReason: r.endReason,
        }),
      ),
    };
  }

  async callbacks(query: { status?: unknown; limit?: unknown }): Promise<VoiceCallbackView[]> {
    const scope = await this.repo.scope();
    const status = query.status;
    if (status !== undefined && status !== '' && status !== 'NEW' && status !== 'DONE')
      throw new BadRequestException('status: NEW или DONE');
    const limit = intParam(query.limit, 'limit', 1, MAX_LIMIT, MAX_LIMIT);
    const rows = await this.repo.callbacks(scope, status === 'NEW' || status === 'DONE' ? status : null, limit);
    return rows.map(callbackView);
  }

  async closeCallback(id: string, dto: Record<string, unknown>): Promise<VoiceCallbackView> {
    if (dto?.status !== 'DONE') throw new BadRequestException('status: допустимо только DONE');
    const scope = await this.repo.scope();
    await this.repo.assertWritable(scope.organizationId);
    const row = await this.repo.closeCallback(scope, id, this.userId());
    if (!row) throw new NotFoundException('Просьба не найдена');
    return callbackView(row);
  }
}
