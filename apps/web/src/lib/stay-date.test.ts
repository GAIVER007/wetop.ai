import { describe, expect, it } from 'vitest';
import { isStayDate } from './stay-date';
describe('stay dates are calendar dates', () => {
  it.each(['2028-02-29', '2026-12-31', '2027-01-01', '2026-09-30'])('accepts %s', (date) =>
    expect(isStayDate(date)).toBe(true),
  );
  it.each(['', '2026-02-31', '2026-02-29', '2026-04-31', '2026-13-01', '2026-10-', '01.10.2026'])(
    'rejects %s',
    (date) => expect(isStayDate(date)).toBe(false),
  );
});
