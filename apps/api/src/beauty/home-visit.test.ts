import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { homeVisitPatch } from './appointments';

/** Выезд на дом при изменении записи (владелец 27.10.2026): галочка и адрес меняются вместе */
describe('homeVisitPatch', () => {
  it('поле не прислали: выезд записи не трогаем', () => {
    expect(homeVisitPatch({ startsAt: '2026-10-27T10:00:00Z' })).toBeNull();
  });
  it('поставили галочку с адресом', () => {
    expect(homeVisitPatch({ atHome: 'on', homeAddress: ' Lusail, villa 7 ' })).toEqual({ atHome: true, homeAddress: 'Lusail, villa 7' });
  });
  it('сняли галочку: адрес стирается', () => {
    expect(homeVisitPatch({ atHome: '', homeAddress: 'Lusail' })).toEqual({ atHome: false, homeAddress: null });
  });
  it('галочка без адреса: 400 со словами', () => {
    expect(() => homeVisitPatch({ atHome: true, homeAddress: '' })).toThrow(new BadRequestException('Укажите адрес выезда'));
  });
});
