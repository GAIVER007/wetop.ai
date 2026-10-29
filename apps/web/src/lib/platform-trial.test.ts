import { describe, expect, it } from 'vitest';
import { accessTrialUntil } from './platform-trial';

// «Пробный 14 дней» в «Подписках клиентов»: день считается по Алматы (пояс платформы), а не по UTC. Вечером после
// 19:00 UTC в Алматы уже завтра: гейт #950 поймал расхождение на день (12.11 вместо 13.11).
describe('последний день пробного по Алматы', () => {
  it('днём UTC и Алматы совпадают', () => {
    expect(accessTrialUntil(new Date('2026-10-29T10:00:00Z'))).toBe('2026-11-12');
  });
  it('вечером UTC в Алматы уже завтра: срок от завтрашнего дня', () => {
    expect(accessTrialUntil(new Date('2026-10-29T20:00:00Z'))).toBe('2026-11-13');
  });
  it('через конец месяца и года', () => {
    expect(accessTrialUntil(new Date('2026-12-25T21:00:00Z'))).toBe('2027-01-09');
  });
});
