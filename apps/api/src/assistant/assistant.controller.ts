import 'reflect-metadata';
import {
  Controller,
  Get,
  Header,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { assistant } from '@pms/integrations';
import type { SignedInUser } from '../auth/auth.service';

export const IDENTITY_SIGNED_IN_ONLY = 'Подпись помощника выдаётся только вошедшему';
export const IDENTITY_NOT_CONFIGURED = 'Подпись помощника не настроена';

/**
 * ИИ-помощник в стойке (ТЗ ред. 1, ADR-075; контракт — docs/assistant/README.md).
 *
 * `GET /assistant/identity` (П1) — подпись вошедшего для тега виджета: сервер стойки берёт её при отрисовке
 * макета и кладёт в `data-identity`. Автор — `request.user`, который ставит замок `SessionGuard` по сессии
 * (`x-wetop-session`, `Bearer`, кука) и при выключенном `AUTH_REQUIRED` тоже. Не `currentActor()`: его
 * заполняет только вход по куке и `Bearer`, а стойка ходит заголовком — для её запросов он пуст.
 */
@Controller('assistant')
export class AssistantController {
  @Get('identity')
  @Header('Cache-Control', 'no-store')
  identity(@Req() request: { user?: SignedInUser }): { token: string; expiresAt: string } {
    const user = request.user;
    // Служебный ключ — не человек: подписывать нечего, и чат такого ходока не нужен
    if (!user) throw new UnauthorizedException(IDENTITY_SIGNED_IN_ONLY);
    const secret = process.env.WIDGET_IDENTITY_SECRET?.trim() ?? '';
    if (!secret) throw new ServiceUnavailableException(IDENTITY_NOT_CONFIGURED);

    const issuedAt = Math.floor(Date.now() / 1000);
    return {
      token: assistant.signIdentity(secret, {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        // Ролей нет (ADR-023, `memberships` без роли): придумывать её нельзя, бот пустую принимает
        role: '',
        issuedAt,
      }),
      expiresAt: new Date((issuedAt + assistant.IDENTITY_TTL_SECONDS) * 1000).toISOString(),
    };
  }
}
