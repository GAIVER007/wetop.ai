import { describe, it, expect } from 'vitest';
import { validateSettingsObservation } from '../../scripts/ci/check-settings-observation.mjs';

// SYNTHETIC parser fixtures only; these are not Next/CI observation evidence.
const fixture = () => Array.from({ length: 3 }, (_, i) => {
  const id = `12345678-1234-4234-8234-123456789ab${i}`;
  return [
    { event: 'settings-diag-incoming', id, route: 'today' },
    { event: 'settings-diag-transport', id, phase: 'start' },
    { event: 'settings-diag-transport', id, phase: 'end', status: 200 },
  ];
}).flat();
const log = (events: unknown[] = fixture()) => events.map(event => `[WebServer] ${JSON.stringify(event)}`).join('\n');
describe('settings observation acceptance (synthetic fixtures)', () => {
  it('rejects empty logs and echoed source without emitted events', () => {
    expect(validateSettingsObservation('').ok).toBe(false);
    expect(validateSettingsObservation("console.info({ event: 'settings-diag-incoming' })").ok).toBe(false);
  });
  it('accepts three resolved today groups', () => {
    expect(validateSettingsObservation(log())).toEqual({ ok: true, groups: 3 });
  });
  it('rejects missing, duplicate, throwing, unsuccessful and unresolved transports', () => {
    for (const events of [fixture().slice(0, -1), [...fixture(), fixture()[1]],
      fixture().map((event, i) => i === 2 ? { ...event, status: 500 } : event),
      fixture().map((event, i) => i === 1 ? { ...event, id: 'unbound' } : event),
      [...fixture(), { ...fixture()[1], phase: 'throw' }], fixture().slice(0, 6),
      [...fixture(), fixture()[0]]]) {
      expect(validateSettingsObservation(log(events)).ok).toBe(false);
    }
  });
  it('rejects malformed tagged JSON and oversized logs', () => {
    expect(validateSettingsObservation(log() + '\n[WebServer] {"event":"settings-diag-transport",').ok).toBe(false);
    expect(validateSettingsObservation('x'.repeat(16 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});
