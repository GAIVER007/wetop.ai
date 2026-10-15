import 'reflect-metadata';
import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Access } from '../auth/access.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import type { SignedInUser } from '../auth/auth.service';
import { SitesRuntimeService } from './sites-runtime.service';

export const RUNTIME_KEY_REQUIRED = 'Нужен ключ публичного рантайма сайтов';

type ServiceRequest = { headers: Record<string, unknown>; user?: SignedInUser };

/**
 * Служебный вход публичного рантайма `apps/sites` (MKT4). Только ключ `SITES_RUNTIME_KEY`: общий служебный ключ и
 * сессии сюда не входят, ключ рантайма никуда, кроме двух этих путей (текущая версия и превью по токену, MKT7), не
 * входит (замок входа). Ключ сверяется и здесь: без `AUTH_REQUIRED=1` замок молчит. Чтения версии по id у рантайма нет.
 */
@Access('service')
@Controller('sites-runtime')
export class SitesRuntimeController {
  constructor(@Inject(SitesRuntimeService) private readonly service: SitesRuntimeService) {}

  @Get('current')
  @Header('Cache-Control', 'no-store')
  current(@Req() request: ServiceRequest, @Query() query: { host?: unknown; knownSpecHash?: unknown }) {
    const key = serviceKeyKind(request.headers);
    if (key === null || key === 'unknown') throw new UnauthorizedException(RUNTIME_KEY_REQUIRED);
    if (key !== 'sites-runtime') throw new ForbiddenException(RUNTIME_KEY_REQUIRED);
    return this.service.current({ host: query.host, knownSpecHash: query.knownSpecHash });
  }

  /** MKT7: превью одной версии по подписанному токену; без действующего токена ключ рантайма ничего не читает */
  @Get('preview')
  @Header('Cache-Control', 'no-store')
  preview(@Req() request: ServiceRequest, @Query() query: { token?: unknown }) {
    const key = serviceKeyKind(request.headers);
    if (key === null || key === 'unknown') throw new UnauthorizedException(RUNTIME_KEY_REQUIRED);
    if (key !== 'sites-runtime') throw new ForbiddenException(RUNTIME_KEY_REQUIRED);
    return this.service.preview({ token: query.token });
  }
}
