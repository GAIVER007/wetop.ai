import { describe, expect, it } from 'vitest';
import { guessRegional } from './regional';

describe('умолчания валюты и часового пояса мастера', () => {
  it('домен .kz и пояс Алматы дают тенге', () => {
    expect(guessRegional('https://hostel.kz/', 'Europe/Berlin')).toEqual({
      currency: 'KZT',
      timezone: 'Asia/Almaty', // tz-allow: ожидаемое значение теста
    });
    expect(guessRegional('', 'Asia/Almaty')?.currency).toBe('KZT');
  });
  it('домен .ru и пояс Москвы дают рубли', () => {
    expect(guessRegional('https://hotel.ru', 'Asia/Almaty')?.currency).toBe('RUB');
    expect(guessRegional('', 'Europe/Moscow')).toEqual({
      currency: 'RUB',
      timezone: 'Europe/Moscow',
    });
  });
  it('Дубай даёт пояс без угадывания валюты, чужой пояс не угадываем', () => {
    expect(guessRegional('', 'Asia/Dubai')).toEqual({ timezone: 'Asia/Dubai' });
    expect(guessRegional('', 'America/Lima')).toBeNull();
    expect(guessRegional('не адрес', undefined)).toBeNull();
  });
});
