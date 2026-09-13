/**
 * Что уборка автотестов считает своим мусором (cli-e2e-cleanup, globalTeardown Playwright).
 * Вынесено из скрипта, чтобы правило отбора было проверяемым.
 */

/** Метка в заметке брони или в имени сайта — её ставят сами тесты */
export const E2E_NOTE = 'E2E-АВТОТЕСТ';
/** Имя сайта счётчика, который заводит интеграционный тест аналитики (с суффиксом прогона) */
export const INTEGRATION_SITE_NAME = 'ИНТЕГРАЦИОННЫЙ ТЕСТ';
/** Номер, выданный PMS: ГГГГММДД + шесть знаков. У Exely и каналов формат другой — они не попадут */
export const OWN_NUMBER = /^\d{8}-[A-Z0-9]{6}$/;

export interface CleanupReservation {
  confirmationNumber: string;
  notes: string | null;
  createdAt: Date;
}
export interface CleanupSite {
  name: string;
  publicKey: string;
  createdAt: Date;
}

/** Бронь автотеста: метка в заметке либо номер PMS у гостя «Тест-» (прогоны до появления метки) */
export function isTestReservation(r: CleanupReservation): boolean {
  return (r.notes?.includes(E2E_NOTE) ?? false) || OWN_NUMBER.test(r.confirmationNumber);
}

/** Сайт автотеста: e2e с меткой в имени либо интеграционный тест */
export function isTestSite(s: CleanupSite): boolean {
  return (
    s.name.startsWith(E2E_NOTE) ||
    s.name.startsWith(INTEGRATION_SITE_NAME) ||
    s.publicKey === 'pms_e2e000000000'
  );
}

/**
 * Сколько минут объект автотеста считается «живым». Уборка идёт после каждого прогона Playwright,
 * а на одной dev-БД работают две сессии: без порога уборка одной сносила бронь и сайт, которые тест
 * другой использовал в эту минуту (плавающие падения web-analytics.test.ts 12–13.09.2026).
 * Один тест длится до 90 с (playwright.config), так что 15 минут — десятикратный запас. Мусор сорванного
 * прогона всё равно уберётся: следующей уборкой, когда станет старше порога.
 */
export const STALE_AFTER_MINUTES = 15;

/** Создан раньше порога — ни один идущий тест им уже не пользуется */
export function isStale(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= STALE_AFTER_MINUTES * 60_000;
}

/** Граница для запроса к базе: всё, что создано раньше, — кандидат на уборку */
export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_AFTER_MINUTES * 60_000);
}

/** Брони, которые уборка отменяет: брони автотестов, созданные дольше порога назад */
export function reservationsToCancel(
  rows: readonly CleanupReservation[],
  now: Date,
): CleanupReservation[] {
  return rows.filter((r) => isTestReservation(r) && isStale(r.createdAt, now));
}

/** Сайты, которые уборка удаляет: сайты автотестов, созданные дольше порога назад */
export function sitesToDelete(rows: readonly CleanupSite[], now: Date): CleanupSite[] {
  return rows.filter((s) => isTestSite(s) && isStale(s.createdAt, now));
}
