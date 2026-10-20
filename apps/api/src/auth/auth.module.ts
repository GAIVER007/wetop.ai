import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { PlatformModule } from '../platform/platform.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { APP_URL, MAILER, PasswordResetService, appUrlFromEnv, type Mailer } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';

/**
 * Вход в стойку (DATA_MODEL §13 шаг 1, ADR-046). Отправка писем настраивается ключом в окружении:
 * без `MAIL_API_KEY` система работает, но приглашения и сброс пароля письмом недоступны — ссылку выдаёт
 * владелец командой `npm run accounts -- invite` (docs/mail/README.md).
 */
@Module({
  // расширения организации — для `/auth/me` (ADR-083)
  imports: [PlatformModule],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    PasswordResetService,
    EmailVerificationService,
    {
      provide: MAILER,
      useFactory: (): Mailer | null => {
        const config = mail.mailConfigFromEnv(process.env);
        return config ? new mail.ResendMailSender({ config }) : null;
      },
    },
    {
      provide: APP_URL,
      useFactory: (): string => appUrlFromEnv(),
    },
  ],
  exports: [AuthService, PasswordResetService, EmailVerificationService],
})
export class AuthModule {}
