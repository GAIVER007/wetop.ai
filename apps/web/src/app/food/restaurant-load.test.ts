import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api-error';

const me = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const shell = vi.hoisted(() => ({ role: 'EMPLOYEE' as string | null }));

vi.mock('../../lib/vertical-guard', () => ({ requireVertical: vi.fn(async () => me.value) }));
vi.mock('../../lib/desk-shell', () => ({
  deskShell: vi.fn(async () => ({ readOnly: false, access: { role: shell.role } })),
}));
vi.mock('../../lib/workspace-context', () => ({ selectedWorkspaceBranch: vi.fn(async () => null) }));
vi.mock('../../lib/navigation', () => ({ mayAccess: () => true }));
vi.mock('../beauty/time', () => ({ localInput: () => '2026-10-22T10:00' }));

import { restaurantShell } from './restaurant-load';

/**
 * «Личный кабинет» (EMPLOYEE) без филиала на /payroll и /cashbox видел «Проверьте подключение» и кнопку
 * «Подключения API» (аудит 22.10.2026, P1-2): обвязка бросала обычную ошибку, экран считал её сбоем связи.
 * Отказ в доступе теперь приходит как 403, и экран ошибки пишет «Этот раздел вам недоступен».
 */
describe('restaurantShell: нет доступа к разделу', () => {
  beforeEach(() => {
    me.value = { context: null };
    shell.role = 'EMPLOYEE';
  });
  it('сотрудник с личным кабинетом без филиала: отказ 403, а не сбой связи', async () => {
    const error = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });
  it('выбранный филиал больше недоступен: тоже 403', async () => {
    me.value = { context: { vertical: 'BEAUTY', businessId: 'b', locationId: 'l' } };
    shell.role = 'MANAGER';
    const error = await restaurantShell(undefined, ['FOOD_SERVICE', 'BEAUTY']).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
  });
});
