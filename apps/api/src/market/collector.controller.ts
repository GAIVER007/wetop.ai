import 'reflect-metadata';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import type { SignedInUser } from '../auth/auth.service';
import { MarketCollectorService } from './collector.service';

export const COLLECT_KEY_REQUIRED = 'Нужен ключ сборщика загрузки конкурентов';

type ServiceRequest = { headers: Record<string, unknown>; user?: SignedInUser };

/**
 * Служебный вход ИИ-сборщика (M2a, ADR-142, Q-260): только ключ `MARKET_COLLECT_KEY` или общий служебный. Человек
 * сюда не входит; ключ сборщика никуда, кроме этих двух адресов, не входит (замок входа). Ключ сверяется и здесь:
 * без `AUTH_REQUIRED=1` замок молчит.
 */
@Access('service')
@Controller('market/collector')
export class MarketCollectorController {
  constructor(@Inject(MarketCollectorService) private readonly service: MarketCollectorService) {}

  @Get('competitors')
  competitors(@Req() request: ServiceRequest) {
    collectKeyOnly(request);
    return this.service.competitors();
  }

  @Put('competitors/:id/occupancy')
  @HttpCode(200)
  collect(
    @Req() request: ServiceRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { entries?: unknown },
  ) {
    collectKeyOnly(request);
    return this.service.collect(id, dto ?? {});
  }
}

function collectKeyOnly(request: ServiceRequest): void {
  const key = serviceKeyKind(request.headers);
  if (key === null && !request.user) throw new UnauthorizedException(COLLECT_KEY_REQUIRED);
  if (key !== 'market-collect' && key !== 'service') throw new ForbiddenException(COLLECT_KEY_REQUIRED);
}
