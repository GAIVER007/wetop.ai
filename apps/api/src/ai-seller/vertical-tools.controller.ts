import 'reflect-metadata';
import { BadRequestException, Controller, ForbiddenException, Get, Header, Inject, Query, Req } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { serviceKeyKind } from '../auth/auth.guard';
import { VerticalToolsService } from './vertical-tools.service';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
@Public()
@Controller('bot')
export class VerticalToolsController {
  constructor(@Inject(VerticalToolsService) private readonly service: VerticalToolsService) {}
  private agent(request: { headers: Record<string, unknown> }, query: Record<string, unknown>) {
    if (serviceKeyKind(request.headers) !== 'seller-quote')
      throw new ForbiddenException('Этот контракт доступен только продавцу по своему ключу');
    if (Object.keys(query).some(key => key !== 'agent') || typeof query.agent !== 'string' || !UUID.test(query.agent))
      throw new BadRequestException('Укажите только agent: UUID');
    return query.agent.toLowerCase();
  }
  @Get('agent-context') @Header('Cache-Control', 'no-store')
  context(@Req() r: { headers: Record<string, unknown> }, @Query() q: Record<string, unknown>) {
    return this.service.context(this.agent(r, q));
  }
  @Get('beauty-services') @Header('Cache-Control', 'no-store')
  beauty(@Req() r: { headers: Record<string, unknown> }, @Query() q: Record<string, unknown>) {
    return this.service.beauty(this.agent(r, q));
  }
  @Get('food-service-periods') @Header('Cache-Control', 'no-store')
  food(@Req() r: { headers: Record<string, unknown> }, @Query() q: Record<string, unknown>) {
    return this.service.food(this.agent(r, q));
  }
}
