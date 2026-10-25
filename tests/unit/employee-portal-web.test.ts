import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = (path: string) => readFileSync(resolve('apps/web/src', path), 'utf8');
describe('employee portal frontend boundaries', () => {
  it('has independent self, manager and anonymous pages', () => {
    expect(source('app/my-work/page.tsx')).toContain('EmployeePortalScreen');
    expect(source('app/employees/[id]/profile/page.tsx')).toContain('EmployeePortalScreen');
    const publicPage = source('app/specialists/[slug]/page.tsx');
    expect(publicPage).toContain('publicEmployee');
    expect(publicPage).not.toMatch(/employeePortal\(|\.pay|\.phone|\.email|\.orders|\.appointments/);
    expect(source('lib/public-entry.ts')).toContain("'/specialists'");
  });
  it('uses server-only authenticated transport and anonymous public allowlist', () => {
    const api = source('lib/employee-portal-api.ts');
    expect(api).toContain("import 'server-only'");
    expect(api).toContain('portalTransport');
    expect(api).toContain('PublicEmployeeDto');
    const actions = source('app/my-work/actions.ts');
    expect(actions).toContain("'use server'");
    expect(actions).toContain('expectedRevision');
    expect(actions).toContain('parsePaySettings');
    expect(actions).toContain('requestScopeHeader');
  });
  it('shows the own week and absences read-only (S3, владелец 21.10.2026) and keeps affected appointments', () => {
    const ui = source('components/employee-portal/cabinet.tsx');
    // отсутствия видны списком, но сотрудник их не ставит: формы нет, график меняет руководитель
    expect(ui).toContain('data-testid="portal-time-offs"');
    expect(ui).toContain('portalAbsences(data.timeOffs');
    expect(ui).toContain('shortPeriod(');
    expect(ui).not.toContain('command="time-off"');
    expect(source('components/employee-portal/forms.tsx')).toContain("{hours || t('Выходной')}");
    expect(ui).toContain('<PortalWeekView');
    expect(ui).toContain('data.scheduleConflicts.items.map');
    // служебная фраза «Проверяем… Записи не отменены» снята (аудит салона 22.10.2026); конфликт назван словами
    expect(ui).toContain('Есть записи вне графика или в дни отсутствия');
    expect(ui).toContain('scheduleConflicts.truncated');
  });
  it('keeps self pay read-only and separates waiter orders from beauty services', () => {
    const ui = source('components/employee-portal/cabinet.tsx');
    expect(ui).toContain("data.access === 'MANAGER'");
    expect(ui).toContain("data.business.vertical === 'BEAUTY'");
    expect(ui).toContain('Мои заказы');
    expect(ui).toContain('NOT_CONFIGURED');
    expect(ui).not.toContain('URL.createObjectURL');
    expect(ui).not.toContain('roleSwitch');
    expect(source('components/employee-portal/forms.tsx')).toContain('onReset');
  });
});
describe('salon terminology regression', () => {
  it('does not represent service snapshots as cash receipts or loss', () => {
    const finance = source('app/finance/beauty-finance.tsx');
    expect(finance).toContain('Стоимость оказанных услуг');
    expect(finance).toContain('Средняя стоимость записи');
    expect(finance).toContain('href="/cashbox"');
    expect(finance).not.toContain('label="Потери"');
    expect(finance).not.toContain('label="Выручка за 7 дней"');
  });
  it('schedule is a week grid without the «Нерабочие дни» section; hours keep visible start/end labels', () => {
    const board = source('app/beauty/schedule/board.tsx');
    expect(board).not.toContain('Добавить нерабочие дни');
    expect(board).toContain('обычный недельный график');
    expect(board).toContain(">{t('С')}</span>");
    expect(board).toContain(">{t('До')}</span>");
    expect(board).toContain('beauty-week-grid');
    const masters = source('app/beauty/masters/board.tsx');
    expect(masters).not.toContain('Изменения на даты');
    expect(masters).not.toContain('<TimeOffForm');
  });

  it('exposes useful service search and category', () => {
    const services = source('app/beauty/services/board.tsx');
    expect(services).toContain('Поиск услуг');
    expect(services).toContain('Категория');
    expect(services).toContain('row.effective.priceMinor');
  });
});
