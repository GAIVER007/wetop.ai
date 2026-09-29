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
import { AppModule } from './app.module';
import { listenHost, listenPort } from './listen-address';
import { apiSecurityHeaders } from './security-headers';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
// Аудит 29.09.2026, SEC-4: версия Express наружу не нужна, ответам — nosniff
app.getHttpAdapter().getInstance().disable('x-powered-by');
app.use(apiSecurityHeaders);
const port = listenPort();
const host = listenHost();
await app.listen(port, host);
console.log(`PMS API: http://${host}:${port}/health`);
