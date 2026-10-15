import { describe, expect, it } from 'vitest';
import { channelStatusView, matchesChannel, outsideLabel } from './channel-list-format';

const row = {
  channelTitle: 'Booking.com',
  connectionTitle: 'Luxx Booking',
  channelPropertyId: '14087887',
  status: 'WORKING' as const,
  removalDate: null,
  lastEventAt: '2026-10-01T08:00:00Z',
  failedEvents7d: 0,
};

describe('раздел «Каналы»: слова статуса и поиск', () => {
  it('статус словами и тоном; «Работает» только у подтверждённого фактами', () => {
    expect(channelStatusView(row)).toEqual({ label: 'Работает', tone: 'ok', note: null });
    expect(channelStatusView({ ...row, status: 'ENABLED', lastEventAt: null })).toEqual({
      label: 'Включён',
      tone: 'neutral',
      note: 'броней из канала не было 30 дней',
    });
    expect(channelStatusView({ ...row, status: 'ERRORS', failedEvents7d: 2 })).toEqual({
      label: 'Ошибки броней',
      tone: 'danger',
      note: '2 брони с ошибкой за 7 дней',
    });
    expect(channelStatusView({ ...row, status: 'OFF' })).toMatchObject({
      label: 'Выключен',
      tone: 'neutral',
    });
    expect(channelStatusView({ ...row, status: 'REMOVING', removalDate: '2026-10-20' })).toEqual({
      label: 'Удаляется 20.10',
      tone: 'warn',
      note: 'Менеджер каналов удалит выключенное подключение 20.10.2026',
    });
  });

  it('поиск по названию канала, подключения и ID в канале, без регистра', () => {
    expect(matchesChannel(row, '')).toBe(true);
    expect(matchesChannel(row, 'booking')).toBe(true);
    expect(matchesChannel(row, 'luxx')).toBe(true);
    expect(matchesChannel(row, '1408')).toBe(true);
    expect(matchesChannel(row, 'agoda')).toBe(false);
  });

  it('источник вне Channex: канал — его именем, прямые источники — словами стойки', () => {
    expect(outsideLabel({ source: 'OTA', label: 'OneTwoTrip' })).toBe('OneTwoTrip');
    expect(outsideLabel({ source: 'WEBSITE', label: null })).toBe('Сайт');
    expect(outsideLabel({ source: 'DESK', label: null })).toBe('Стойка');
    expect(outsideLabel({ source: 'OTA', label: null })).toBe('Канал продаж');
  });
});
