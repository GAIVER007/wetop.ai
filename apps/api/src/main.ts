/**
 * PMS API. Запуск из корня: `npm run dev -w apps/api` (порт API_PORT, по умолчанию 3001).
 * Слушает только 127.0.0.1: авторизации нет до решения Q-061…064 (plans/slice-1-inventory.md §7).
 * DATABASE_URL читает программа из .env — не агент (SECURITY.md §3).
 */
import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
const port = Number(process.env.API_PORT ?? 3001);
await app.listen(port, '127.0.0.1');
console.log(`PMS API: http://127.0.0.1:${port}/inventory/summary`);
