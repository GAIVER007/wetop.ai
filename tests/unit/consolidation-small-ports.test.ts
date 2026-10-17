import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (p: string) => readFileSync(p, 'utf8');
describe('approved stay count UI source contract (not browser behavior)', () => {
  it('mounts the existing action form inside the unchanged eligible item loop', () => {
    const source = read('apps/web/src/app/reservations/[number]/actions-panel.tsx');
    expect(source).toContain('<StayGuestsForm number={props.number} item={it} />');
    expect(source).toContain("it.status !== 'CANCELLED' && it.status !== 'CHECKED_OUT' && it.status !== 'NO_SHOW'");
    expect(source.indexOf('<StayGuestsForm')).toBeGreaterThan(source.indexOf('.filter('));
    expect(source).toContain('updateStayGuestsAction.bind(null, number, item.id)');
    expect(source).toContain('state.values?.adults ?? item.adults');
    expect(source).toContain('state.values?.children ?? item.children');
    expect(source).toContain('${state.attempt ?? 0}');
    const page = read('apps/web/src/app/reservations/[number]/page.tsx');
    expect(page).toContain("mayAccess(desk.access, 'desk') && !desk.readOnly");
    expect(page).toContain('canMutate && <ReservationActions');
  });
});
