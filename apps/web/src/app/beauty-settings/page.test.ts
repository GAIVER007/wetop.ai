import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  hours: vi.fn(), reminders: vi.fn(), bonuses: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); }, unstable_rethrow: vi.fn() }));
vi.mock('../../lib/vertical-guard', () => ({ requireFeature: vi.fn() }));
vi.mock('../../lib/desk-shell', () => ({ currentMe: async () => ({}), deskShell: async () => ({ readOnly: true, access: {} }) }));
vi.mock('../../lib/navigation', () => ({ mayBeautyAccess: () => false }));
vi.mock('../../i18n/server', () => ({ serverT: async () => (value: string) => value }));
vi.mock('../../lib/api', () => ({ beautyApi: { locationHours: mocks.hours, reminderSettings: mocks.reminders, bonusProgram: mocks.bonuses } }));
vi.mock('./hours-form', () => ({ SalonHoursForm: () => null }));
vi.mock('./loyalty-forms', () => ({ ReminderSettingsForm: () => null, BonusProgramForm: () => null }));
vi.mock('./settings-links', () => ({ SettingsLinks: () => null }));
import BeautySettingsPage from './page';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.hours.mockResolvedValue({ location: { name: 'Test salon' } });
  mocks.reminders.mockResolvedValue({});
  mocks.bonuses.mockResolvedValue({});
});
it.each([undefined, 'unknown'])('redirects the standalone entry %s to all settings', async (section) => {
  await expect(BeautySettingsPage({ searchParams: Promise.resolve(section === undefined ? {} : { section }) })).rejects.toThrow('redirect:/settings');
  for (const request of Object.values(mocks)) expect(request).not.toHaveBeenCalled();
});
it.each(['hours', 'reminders', 'bonuses'])('loads only the selected settings: %s', async (section) => {
  await BeautySettingsPage({ searchParams: Promise.resolve({ section }) });
  for (const [name, request] of Object.entries(mocks)) expect(request).toHaveBeenCalledTimes(name === section ? 1 : 0);
});
