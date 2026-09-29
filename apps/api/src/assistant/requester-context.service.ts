import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { buildRequesterContext, type RequesterContext } from '@pms/domain';
import { withSignedInUser } from '../auth/request-context';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
} from './requester-context.repository';

/** Псевдоним человека для модели: стабильный внутри платформы, id не раскрывает */
export function requesterRef(userId: string): string {
  return `u_${createHash('sha256').update(`requester:${userId}`).digest('hex').slice(0, 12)}`;
}

/**
 * Контекст обратившегося для помощника поддержки (S4). Пара «человек, организация» приходит из подписи, которую бот
 * проверил сам; здесь она сверяется ещё раз с членством в базе. Чтение идёт от имени этой организации, поэтому при
 * включённой защите строк (RLS, §17) база и сама не отдаст чужого.
 */
@Injectable()
export class RequesterContextService {
  constructor(
    @Inject(REQUESTER_CONTEXT_REPOSITORY) private readonly repo: RequesterContextRepository,
  ) {}

  async resolve(
    userId: string,
    organizationId: string,
    now: Date = new Date(),
  ): Promise<RequesterContext | null> {
    const facts = await withSignedInUser({ userId, organizationId }, () =>
      this.repo.facts(userId, organizationId),
    );
    if (!facts) return null;
    return buildRequesterContext({ userRef: requesterRef(userId), ...facts, now });
  }
}
