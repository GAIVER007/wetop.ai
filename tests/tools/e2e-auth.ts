/**
 * Вход в прогоне e2e при включённом замке API (`E2E_AUTH=1`; порядок включения — `plans/slice-13-accounts-saas.md` §7а).
 * Одни и те же значения читают конфиг Playwright, шаг входа `tests/e2e/_auth.setup.ts` и уборка.
 */
import { resolve } from 'node:path';

/** Замок стенда просят явно: по умолчанию прогон идёт как раньше, без входа. */
export const authRun = (): boolean => process.env['E2E_AUTH'] === '1';

/** Человек вымышленный (ADR-010), почта в несуществующем домене — письма ей уйти не могут. */
export const E2E_USER = { email: 'e2e-desk@example.invalid', name: 'Смена автотестов' };

/** Пароль и ключ живут только в стенде pms_test и меняются при каждом прогоне (`--auth-key`). */
export const E2E_PASSWORD = process.env['E2E_PASSWORD'] ?? 'e2e-Only-Password-2026';
export const SERVICE_KEY = process.env['E2E_SERVICE_KEY'] ?? 'e2e-only-service-key';

export const SESSION_COOKIE = 'wetop_session';
export const AUTH_STATE = resolve(import.meta.dirname, '../runs/.auth/desk.json');
