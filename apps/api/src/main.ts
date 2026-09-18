/**
 * PMS API. Запуск из корня: `npm run dev -w apps/api` или `npm run start -w apps/api`
 * (порт API_PORT, по умолчанию 3001). Именно через workspace-скрипт: tsx должен взять
 * apps/api/tsconfig.json с experimentalDecorators, из корня он берёт корневой и падает.
 * Слушает 127.0.0.1 (plans/slice-1-inventory.md §7): наружу API выпускает только туннель. В контейнере
 * compose задаёт API_HOST=0.0.0.0 — иначе соседи по сети compose (стойка, туннель) его не увидят (listen-host.ts).
 * DATABASE_URL читает программа из .env — не агент (SECURITY.md §3).
 */
import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { listenHost } from './listen-host';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
const port = Number(process.env.API_PORT ?? 3001);
const host = listenHost();
await app.listen(port, host);
console.log(`PMS API: http://${host}:${port}/inventory/summary`);
