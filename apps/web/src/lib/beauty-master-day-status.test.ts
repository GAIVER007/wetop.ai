import { describe, expect, it } from 'vitest';
import { beautyMasterDayStatus } from './beauty-master-day-status';

describe('beauty master day status', () => {
  it('distinguishes unavailable, off and working states from one day projection', () => {
    expect(beautyMasterDayStatus(null, 'master-1')).toEqual({
      state: 'UNAVAILABLE',
      hours: null,
    });
    expect(beautyMasterDayStatus({ columns: [] }, 'master-1')).toEqual({
      state: 'OFF',
      hours: null,
    });
    expect(beautyMasterDayStatus({
      columns: [{
        id: 'master-1',
        name: 'Synthetic Master',
        intervals: [{ timeFrom: '10:00', timeTo: '18:00' }],
        timeOff: false,
        timeOffReason: null,
        serviceIds: [],
      }],
    }, 'master-1')).toEqual({
      state: 'ON_SHIFT',
      hours: '10:00–18:00',
    });
  });
});
