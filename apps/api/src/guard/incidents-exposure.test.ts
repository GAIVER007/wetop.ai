import 'reflect-metadata';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { IntegrationOwnerGuard } from '../channels/integration-owner';
import { GuardController } from './guard.controller';

/**
 * SEC-1b, стадия B, условие B2: у `system_incidents` нет `property_id`, инциденты сторожа — на всю установку (ADR-124). Чтение
 * служебной ролью допустимо, только пока ни один путь, доступный обычной организации, не отдаёт эти строки. Тест держит поверхность:
 *
 * 1. таблицу читает и правит только сторож (`guard/`), а из публичного пути бронирования с сайта идёт одна запись (`record`);
 * 2. сторож отдаёт инциденты лишь через контроллер под `IntegrationOwnerGuard` (организация подключённого объекта и главный
 *    администратор; другой гостинице — 403, `channels/integration-owner.test.ts`);
 * 3. помощник поддержки (`assistant/`) и его доменная часть об инцидентах не знают вообще: организация A не получает
 *    инциденты, не относящиеся к ней, а организация B — тем более.
 *
 * Если понадобится показывать организации её инциденты, сначала нужна привязка инцидента к объекту (миграция), а не фильтр по тексту.
 */
const API_SRC = join(import.meta.dirname, '..');
const DOMAIN_ASSISTANT = join(import.meta.dirname, '../../../../packages/domain/src/assistant');

function sources(dir: string): Array<{ rel: string; text: string }> {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sources(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts')
      ? [{ rel: relative(API_SRC, p), text: readFileSync(p, 'utf8') }]
      : [];
  });
}

const TOUCHES = /INCIDENTS_REPOSITORY|IncidentsRepository|systemIncident|system_incidents/;

describe('инциденты сторожа не доходят до обычной организации', () => {
  it('таблицу читают только сторож и ворота служебной роли, из бронирования с сайта — одна запись', () => {
    const touching = sources(API_SRC)
      .filter((f) => TOUCHES.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(touching).toEqual([
      'database/integration-tables.ts',
      'guard/guard.controller.ts',
      'guard/guard.module.ts',
      'guard/guard.service.ts',
      'guard/incidents.repository.ts',
      'health/health.module.ts',
      'web-booking/web-booking.module.ts',
      'web-booking/web-booking.service.ts',
    ]);
    const booking = sources(API_SRC).find((f) => f.rel === 'web-booking/web-booking.service.ts')!.text;
    const calls = [...booking.matchAll(/this\.incidents\.(\w+)\(/g)].map((m) => m[1]);
    expect(new Set(calls)).toEqual(new Set(['record']));
    // Страница статуса сервиса (H14, ADR-143) публичная: читает открытые неисправности, но наружу отдаёт только виды,
    // сведённые доменной `publicStatus` в четыре слова. Ни заголовков, ни подробностей, ни объекта в ответе нет.
    const health = sources(API_SRC).find((f) => f.rel === 'health/health.module.ts')!.text;
    expect(new Set([...health.matchAll(/this\.incidents\.(\w+)\(/g)].map((m) => m[1]))).toEqual(
      new Set(['open']),
    );
    expect(health).toMatch(/openKinds: open\.map\(\(i\) => i\.kind\)/);
  });

  it('контроллер сторожа, отдающий инциденты, закрыт защитником организации подключённого объекта', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, GuardController) ?? [];
    expect(guards).toContain(IntegrationOwnerGuard);
  });

  it('помощник поддержки и его доменная часть об инцидентах не знают', () => {
    const files = [
      ...sources(join(API_SRC, 'assistant')),
      ...sources(DOMAIN_ASSISTANT).map((f) => ({ ...f })),
    ];
    const offenders = files.filter((f) => /incident|system_incidents/i.test(stripImports(f.text)));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});

/** Импорт `redactText` из `../incidents/redact` — путь папки, а не обращение к таблице */
function stripImports(text: string): string {
  return text.replace(/^import .*$/gm, '');
}
