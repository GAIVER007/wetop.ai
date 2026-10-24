/**
 * «График работы» гостиницы (жалоба владельца 23.10.2026: «почему в графике работы у отелей пусто, хотя сотрудники
 * добавлены»): сотрудники гостиницы приглашаются в «Персонал → Сотрудники» входом (администратор, руководитель), карточки
 * сотрудника у них не было, и график их не видел. График показывает каждого, у кого есть доступ к этому филиалу,
 * карточка заводится сама и привязана ко входу; чужой филиал и чужая организация в график не попадают.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildScopeWorld, OWN_SCOPE, type ScopeWorld } from './scope-world';

const ENABLED = !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)('«График работы» гостиницы видит приглашённых сотрудников (HTTP + база)', () => {
  let w: ScopeWorld;
  beforeAll(async () => {
    w = await buildScopeWorld();
  }, 180_000);
  afterAll(async () => {
    if (w) {
      const rows = await w.db.employee.findMany({ where: { businessId: w.ids.hot! }, select: { id: true } });
      const ids = rows.map((r) => r.id);
      await w.db.workingHours.deleteMany({ where: { employeeId: { in: ids } } });
      await w.db.employeeLocation.deleteMany({ where: { employeeId: { in: ids } } });
      await w.db.employee.deleteMany({ where: { id: { in: ids } } });
      await w.close();
    }
  }, 60_000);

  it('руководитель филиала видит в графике себя и сотрудника своего филиала, без чужого филиала', async () => {
    const res = await w.call('H1_MGR', 'get', '/hotel-staff/shifts', { scope: OWN_SCOPE.H1_MGR! });
    expect(res.status, res.text).toBe(200);
    const names = (res.json as { employees: Array<{ name: string }> }).employees.map((e) => e.name);
    const mail = async (part: string) =>
      `s2-${part}-${w.ids.m}@example.invalid`;
    // без имени во входе карточка называется почтой: человек виден, имя можно поправить
    expect(names).toContain(await mail('h1mgr'));
    expect(names).toContain(await mail('h1staff'));
    expect(names).not.toContain(await mail('h2staff'));
    expect(names).not.toContain(await mail('foreign'));
    // повторный заход не плодит карточки
    const again = await w.call('H1_MGR', 'get', '/hotel-staff/shifts', { scope: OWN_SCOPE.H1_MGR! });
    expect((again.json as { employees: unknown[] }).employees).toHaveLength(names.length);
  });
});
