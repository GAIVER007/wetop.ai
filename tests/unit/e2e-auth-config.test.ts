/**
 * Конфиг прогона e2e: замок API включается только по `E2E_AUTH=1` и включается целиком.
 *
 * Зачем проверка: включение замка (`plans/slice-13-accounts-saas.md` §7а) касается четырёх мест разом —
 * стенд API, стойка, вход в фикстуре и служебный ключ для прямых запросов спеков. Забыть одно из них
 * значит получить либо 401 на каждом спеке, либо зелёный прогон, который ничего не доказал. И наоборот:
 * обычный прогон без переменной должен остаться таким, каким был до 16.09.2026.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaywrightTestConfig } from '@playwright/test';

interface Stand {
  command: string;
  env?: Record<string, string>;
}

async function config(auth: boolean): Promise<PlaywrightTestConfig> {
  vi.resetModules();
  if (auth) process.env['E2E_AUTH'] = '1';
  else delete process.env['E2E_AUTH'];
  const loaded = (await import('../../playwright.config')) as { default: PlaywrightTestConfig };
  return loaded.default;
}

const stands = (c: PlaywrightTestConfig): Stand[] => (c.webServer as Stand[] | undefined) ?? [];
const api = (c: PlaywrightTestConfig): Stand | undefined => stands(c).find((s) => s.command.includes('apps/api'));
const web = (c: PlaywrightTestConfig): Stand | undefined => stands(c).find((s) => s.command.includes('next start'));

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env['E2E_AUTH'];
  delete process.env['SERVICE_API_KEY'];
});

describe('конфиг e2e и замок API', () => {
  it('изолированный API проверяет сессии без рабочего SESSION_SECRET', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    vi.stubEnv('E2E_SESSION_SECRET', '');
    const c = await config(true);
    expect(api(c)?.env?.['SESSION_SECRET']).toBeTruthy();
  });

  it('без переменной прогон идёт как раньше: замка нет, шага входа нет', async () => {
    const c = await config(false);
    expect(c.projects?.map((p) => p.name)).toEqual(['schema-guard', 'isolated']);
    expect(api(c)?.env?.['AUTH_REQUIRED']).toBeUndefined();
    expect(web(c)?.env?.['APP_AUTH_REQUIRED']).toBeUndefined();
    expect(c.use?.storageState).toBeUndefined();
    expect(c.use?.extraHTTPHeaders).toBeUndefined();
  });

  it('E2E_AUTH=1 включает замок на стенде, вход перед спеками и служебный ключ', async () => {
    const c = await config(true);
    const projects = c.projects ?? [];
    expect(projects.map((p) => p.name)).toEqual(['schema-guard', 'auth', 'isolated']);
    // вход идёт после предохранителя схемы и до спеков — иначе сотрудник уехал бы в рабочие данные
    expect(projects.find((p) => p.name === 'auth')?.dependencies).toEqual(['schema-guard']);
    expect(projects.find((p) => p.name === 'isolated')?.dependencies).toEqual(['schema-guard', 'auth']);
    expect(api(c)?.env?.['AUTH_REQUIRED']).toBe('1');
    expect(api(c)?.env?.['SERVICE_API_KEY']).toBeTruthy();
    expect(web(c)?.env?.['APP_AUTH_REQUIRED']).toBe('1');
    // cookie просит только проект со спеками: у самого шага входа её ещё нет, и файла на диске тоже
    expect(c.use?.storageState).toBeUndefined();
    expect(projects.find((p) => p.name === 'auth')?.use?.storageState).toBeUndefined();
    expect(projects.find((p) => p.name === 'isolated')?.use?.storageState).toMatch(/runs\/\.auth\/desk\.json$/);
    expect((c.use?.extraHTTPHeaders ?? {})['x-wetop-service-key']).toBe(api(c)?.env?.['SERVICE_API_KEY']);
    // тот же ключ виден шагу входа: он проверяет им, что замок и правда включён
    expect(process.env['SERVICE_API_KEY']).toBe(api(c)?.env?.['SERVICE_API_KEY']);
  });
});
