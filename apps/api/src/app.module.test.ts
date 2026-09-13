import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { PrismaService } from './database/prisma.provider';
import { AppModule } from './app.module';

/**
 * Приложение собирается целиком: у каждого провайдера каждого модуля есть все зависимости.
 *
 * 13.09.2026 API под launchd три минуты падал по кругу: сторож (GuardModule) попросил шлюз Channex, а модуль
 * каналов его наружу не отдавал. Модульные тесты сторожа были зелёными — они собирают его на подделках, —
 * и ошибка вылезла только на живом старте. Этот тест собирает настоящий AppModule без базы и без сети:
 * PrismaService подменён пустышкой, фоновые таймеры в NODE_ENV=test не запускаются.
 */
describe('AppModule', () => {
  it('все модули API собираются: зависимости сходятся', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ db: {} })
      .compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
