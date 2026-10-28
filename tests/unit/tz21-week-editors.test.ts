import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(path, 'utf8');
describe('TZ2.1 weekly editor wire contract', () => {
  it('Portal preserves original revision and only explicitly accepts the reread', () => {
    const form = source('apps/web/src/components/employee-portal/forms.tsx');
    expect(form).toContain('useState(revision)');
    // #721: the form remounts only on an explicit reread (key), and submits `base`: the server version is adopted
    // only while the hours on screen equal the server hours, so edited hours still hit the conflict.
    // руководитель сохраняет неделю командой week; мастер той же формой отправляет запрос (SCHEDULE-REQUESTS-20261028)
    expect(form).toContain("<PortalForm key={originalRevision} context={context} command={request ? 'request-week' : 'week'} revision={base}");
    expect(form).toContain('if (JSON.stringify(weekDays(week)) === JSON.stringify(hours.current)) setBase(revision);');
    expect(form).toContain('loadPortalWeek(context.target, context.scope)');
    expect(form).toContain('setOriginalRevision(comparison.weekRevision)');
    expect(form).toContain('Принять сохранённый график');
    const actions = source('apps/web/src/app/my-work/actions.ts');
    expect(actions).toContain('employeePortalApi.week(target, parsed.value, revision)');
    expect(actions).not.toContain('employeePortalApi.week(target, parsed.value, current.weekRevision)');
  });
  it('Beauty loader returns a string fallback without weakening optional-property types', () => {
    expect(source('apps/web/src/app/beauty/actions.ts')).toContain(".error ?? t('Не удалось загрузить график')");
    expect(source('apps/web/src/app/beauty/schedule/board.tsx')).not.toContain('error?: string | null | undefined');
  });
  it('Food carries the original read token through form, action and client, and uses its own reread', () => {
    expect(source('apps/web/src/app/food/shifts-board.tsx')).toContain('expectedRevision={editing.weekRevision}');
    expect(source('apps/web/src/app/food/shifts-board.tsx')).toContain('loadFoodShift');
    expect(source('apps/web/src/app/food/restaurant-actions.ts')).toContain("form.get('expectedRevision')");
    expect(source('apps/web/src/lib/food-api.ts')).toContain('{ intervals, expectedRevision }');
  });
  it('shared form never replaces a draft or revision on refusal and offers explicit comparison', () => {
    const form = source('apps/web/src/app/beauty/schedule/board.tsx');
    expect(form).toContain('loadCurrent');
    expect(form).toContain('Сравнить с актуальным графиком');
    expect(form).toContain('Принять сохранённый график');
    expect(form).toContain('if (state?.revision)');
  });
});
