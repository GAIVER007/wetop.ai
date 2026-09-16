import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { mail } from '@pms/integrations';
import { PrismaService } from '../database/prisma.provider';
import { AccountsController } from './accounts.controller';
import { ACCOUNTS_REPOSITORY, type AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { PrismaAccountsRepository } from './accounts.prisma-repository';

/**
 * Свои учётные записи и вход по одноразовому коду (срез 13, ADR-046, DATA_MODEL §13).
 *
 * Отправитель собирается из окружения на старте. Если `MAIL_*` не заданы, вместо боевого
 * подставляется заглушка, а служба знает, что почты нет, и пишет об этом в журнал: пусть
 * лучше в логе будет видно «письмо не отправлено», чем API упадёт целиком из-за одной
 * ненастроенной переменной.
 */
const mailProviders = [
  {
    provide: 'MAIL_CONFIG_PRESENT',
    useFactory: (): boolean => mail.mailConfigFromEnv(process.env) !== null,
  },
  {
    provide: 'MAIL_SENDER',
    useFactory: (): mail.MailSender => {
      const config = mail.mailConfigFromEnv(process.env);
      return config && config.provider === 'resend'
        ? new mail.ResendMailSender({ config })
        : new mail.StubMailSender();
    },
  },
];

@Module({
  controllers: [AccountsController],
  providers: [
    PrismaService,
    AccountsService,
    ...mailProviders,
    { provide: ACCOUNTS_REPOSITORY, useClass: PrismaAccountsRepository },
  ],
  exports: [AccountsService],
})
export class AccountsModule {}

export type { AccountsRepository };
