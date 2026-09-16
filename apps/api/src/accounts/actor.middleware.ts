import 'reflect-metadata';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AccountsService } from './accounts.service';
import { tokenFrom } from './accounts.controller';
import { runAsActor } from './actor';

/**
 * Узнаёт автора запроса по куке или `Bearer` и кладёт его в `AsyncLocalStorage` на время запроса.
 * Не охрана: чужого не выгоняет, только подписывает. Без сессии запрос идёт дальше без автора —
 * стойка за Cloudflare Access и служебные вызовы работают как прежде.
 */
@Injectable()
export class ActorMiddleware implements NestMiddleware {
  constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const cookie = req.headers['cookie'];
    const authorization = req.headers['authorization'];
    const token = tokenFrom(
      Array.isArray(cookie) ? cookie.join('; ') : cookie,
      Array.isArray(authorization) ? authorization[0] : authorization,
    );
    const actor = token ? await this.accounts.actorFor(token) : null;
    if (actor) runAsActor(actor, () => next());
    else next();
  }
}
