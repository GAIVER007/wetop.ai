import { describe, expect, it } from 'vitest';
import { closesAfterSave, serviceFieldErrors } from './service-validation';

describe('«Новая услуга»: русские сообщения под полями (аудит салона 22.10.2026)', () => {
  it('пустая форма называет каждое пустое поле', () => {
    expect(serviceFieldErrors({ name: ' ', durationMinutes: '', price: '' })).toEqual({
      name: 'Укажите название услуги',
      durationMinutes: 'Укажите длительность в минутах, например 60',
      price: 'Укажите цену, например 5000',
    });
  });

  it('неверные числа называются словами', () => {
    expect(serviceFieldErrors({ name: 'Стрижка', durationMinutes: '0', price: 'abc' })).toEqual({
      durationMinutes: 'Длительность: целое число минут больше нуля',
      price: 'Цена: число, например 5000 или 5000,50',
    });
  });

  it('заполненная форма без ошибок', () => {
    expect(serviceFieldErrors({ name: 'Стрижка', durationMinutes: '60', price: '5000' })).toEqual({});
  });

  it('окно новой услуги закрывается, когда услуга создана и включена в филиале', () => {
    expect(closesAfterSave({ message: 'Услуга добавлена в филиал', resourceId: 's1', addedToBranch: true }, false)).toBe(true);
    // KK2: решает признак действия, а не текст: на казахском окно закрывается так же
    expect(closesAfterSave({ message: 'Қызмет филиалға қосылды', resourceId: 's1', addedToBranch: true }, false)).toBe(true);
    // без филиала следующий шаг в том же окне: «Сохранить для филиала»
    expect(closesAfterSave({ message: 'Услуга создана. Включите её в выбранном филиале ниже.', resourceId: 's1' }, false)).toBe(false);
    expect(closesAfterSave({ error: 'Ошибка', resourceId: 's1' }, false)).toBe(false);
    expect(closesAfterSave({ message: 'Услуга сохранена', resourceId: 's1' }, true)).toBe(false);
    expect(closesAfterSave(null, false)).toBe(false);
  });
});
