/**
 * PMS API. Запуск из корня: `npm run dev -w apps/api` или `npm run start -w apps/api`
 * (порт API_PORT, по умолчанию 3001). Именно через workspace-скрипт: tsx должен взять
 * apps/api/tsconfig.json с experimentalDecorators, из корня он берёт корневой и падает.
 * Слушает 127.0.0.1, пока не задан API_HOST: авторизации нет до решения Q-061…064
 * (plans/slice-1-inventory.md §7), наружу API выпускает только туннель. В контейнере адрес задаёт
 * compose при сети, закрытой наружу — иначе соседи по сети compose (стойка, туннель) API не увидят
 * (listen-address.ts).
 * DATABASE_URL читает программа из .env — не агент (SECURITY.md §3).
 */
import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { assertRlsAtStartup } from '@pms/database';
import { AppModule } from './app.module';
import { integrationBindingNotice } from './channels/integration-property';
import { turnstileConfigNotice } from './web-booking/turnstile';
import { listenHost, listenPort } from './listen-address';
import { apiSecurityHeaders } from './security-headers';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

// Аудит 29.09.2026, SEC-1a: production без роли с политиками RLS не стартует, а не молча идёт служебной ролью
try {
  await assertRlsAtStartup(process.env);
} catch (e) {
  console.error(`PMS API не запущен: ${(e as Error).message}`);
  process.exit(1);
}

// SEC-2: объект интеграции задаётся идентификатором; не задан — предупреждение, неверный — отказ старта
const binding = integrationBindingNotice(process.env);
if (binding?.level === 'error') {
  console.error(`PMS API не запущен: ${binding.message}`);
  process.exit(1);
}
if (binding) console.warn(binding.message);

// BOOK-SEC1: капча перед бронью с сайта; ничего не задано — предупреждение, задан один ключ из двух — отказ старта
const turnstile = turnstileConfigNotice(process.env);
if (turnstile?.level === 'error') {
  console.error(`PMS API не запущен: ${turnstile.message}`);
  process.exit(1);
}
if (turnstile) console.warn(turnstile.message);

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
// Аудит 29.09.2026, SEC-4: версия Express наружу не нужна, ответам — nosniff
app.getHttpAdapter().getInstance().disable('x-powered-by');
app.use(apiSecurityHeaders);
const port = listenPort();
const host = listenHost();
await app.listen(port, host);
console.log(`PMS API: http://${host}:${port}/health`);
