import { describe, expect, it } from 'vitest';
import { matchImportedReservation } from './cutover-match';

/** ADR-024: подтянутая каналом бронь ищется среди перенесённых из Exely по составу проживаний. */
const single = {
  accommodationTypeId: 't1',
  arrivalDate: '2026-11-10',
  departureDate: '2026-11-12',
};
const dorm = { accommodationTypeId: 't3', arrivalDate: '2026-11-10', departureDate: '2026-11-12' };
const candidate = (id: string, items: (typeof single)[]) => ({
  id,
  confirmationNumber: `20260901-513903-${id}`,
  items,
});

describe('matchImportedReservation', () => {
  it('ровно один кандидат с тем же составом проживаний → one с его номером', () => {
    const r = matchImportedReservation(
      [single],
      [candidate('A', [single]), candidate('B', [dorm])],
    );
    expect(r).toEqual({ kind: 'one', id: 'A', confirmationNumber: '20260901-513903-A' });
  });

  it('кандидатов нет → none', () => {
    expect(matchImportedReservation([single], [])).toEqual({ kind: 'none' });
  });

  it('несколько одинаковых кандидатов → many со всеми номерами', () => {
    const r = matchImportedReservation(
      [single],
      [candidate('A', [single]), candidate('B', [single]), candidate('C', [dorm])],
    );
    expect(r).toEqual({
      kind: 'many',
      confirmationNumbers: ['20260901-513903-A', '20260901-513903-B'],
    });
  });

  it('кандидат с другим числом проживаний не подходит', () => {
    expect(matchImportedReservation([single], [candidate('A', [single, single])])).toEqual({
      kind: 'none',
    });
    expect(matchImportedReservation([single, single], [candidate('A', [single])])).toEqual({
      kind: 'none',
    });
  });

  it('та же категория, другие даты — не подходит', () => {
    const shifted = { ...single, arrivalDate: '2026-11-11', departureDate: '2026-11-13' };
    expect(matchImportedReservation([single], [candidate('A', [shifted])])).toEqual({
      kind: 'none',
    });
    const longer = { ...single, departureDate: '2026-11-13' };
    expect(matchImportedReservation([single], [candidate('A', [longer])])).toEqual({
      kind: 'none',
    });
  });

  it('две одинаковые комнаты в ревизии против кандидата с одной — не подходит; с двумя — подходит в любом порядке', () => {
    expect(matchImportedReservation([single, single], [candidate('A', [single])])).toEqual({
      kind: 'none',
    });
    expect(matchImportedReservation([single, dorm], [candidate('A', [dorm, single])])).toEqual({
      kind: 'one',
      id: 'A',
      confirmationNumber: '20260901-513903-A',
    });
  });
});
