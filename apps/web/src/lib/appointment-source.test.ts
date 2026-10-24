import { describe, expect, it } from 'vitest';
import { appointmentSourceLabel } from './appointment-source';

/** Аудит салона 22.10.2026 P2: «Источник: Стойка» это слово гостиничной стойки, в салоне запись сделал администратор */
describe('источник записи салона словами', () => {
  it('сайт и администратор, без «Стойка»', () => {
    expect(appointmentSourceLabel('WEBSITE')).toBe('Сайт');
    expect(appointmentSourceLabel('DESK')).toBe('Администратор');
    expect(appointmentSourceLabel(undefined)).toBe('Администратор');
    // голосовой агент (DATA_MODEL VOICE-BOOKING): запись внёс он, а не администратор
    expect(appointmentSourceLabel('VOICE')).toBe('Голосовой агент');
  });
});
