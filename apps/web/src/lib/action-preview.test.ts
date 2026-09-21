import { describe, expect, it } from 'vitest';
import { previewLine, sumPreviews, type ActionPreview } from './action-preview';

/**
 * Срез 7.3 (Д5): окно подтверждения обязано называть сумму словами администратора, а не показывать
 * число без подписи. Строку считает одна функция — её же зовут карточка брони и шахматка.
 */
describe('строка суммы в окне подтверждения', () => {
  const base = { currentPriceMinor: '3300000', currency: 'KZT' };

  it('переселение в другую категорию: новая цена и разница', () => {
    const p: ActionPreview = {
      ...base,
      action: 'move',
      changesCategory: true,
      categoryName: 'Двухместный',
      newPriceMinor: '4500000',
      differenceMinor: '1200000',
    };
    expect(previewLine(p)).toBe(
      'Цена проживания станет 45 000 ₸ вместо 33 000 ₸ — дороже на 12 000 ₸ (пересчёт по календарю категории «Двухместный»).',
    );
  });

  it('переселение внутри категории: цена не меняется — это сказано, а не показано нулём', () => {
    expect(
      previewLine({ ...base, action: 'move', changesCategory: false, differenceMinor: '0' }),
    ).toBe('Цена не меняется: та же категория.');
  });

  it('переселение дешевле: разница со словом «дешевле», минус не пропадает', () => {
    const p: ActionPreview = {
      ...base,
      action: 'move',
      changesCategory: true,
      categoryName: 'Мужская общая',
      newPriceMinor: '2100000',
      differenceMinor: '-1200000',
    };
    expect(previewLine(p)).toContain('дешевле на 12 000 ₸');
  });

  it('продление: цена новых ночей, новый счёт и дата выезда', () => {
    expect(
      previewLine({
        ...base,
        action: 'extend',
        nights: 1,
        departureDate: '2026-09-19',
        newPriceMinor: '4400000',
        differenceMinor: '1100000',
      }),
    ).toBe('Новая ночь — 11 000 ₸. Проживание станет 44 000 ₸, выезд 19 сент.');
  });

  it('отмена со штрафом: сумма штрафа и что начисление сторнируется', () => {
    expect(
      previewLine({
        ...base,
        action: 'cancel',
        penaltyMinor: '1100000',
        voidedMinor: '3300000',
        policy: 'FIRST_NIGHT',
      }),
    ).toBe('Начисление 33 000 ₸ сторнируется, вместо него штраф 11 000 ₸.');
  });

  it('отмена без штрафа: сказано прямо, а не «может начислиться»', () => {
    expect(
      previewLine({
        ...base,
        action: 'cancel',
        penaltyMinor: '0',
        voidedMinor: '3300000',
        policy: 'FIRST_NIGHT',
      }),
    ).toBe('Начисление 33 000 ₸ сторнируется, штрафа не будет.');
  });

  it('бронь из нескольких проживаний: суммы складываются, одно неизвестное делает неизвестной всю сумму', () => {
    const one: ActionPreview = {
      ...base,
      action: 'cancel',
      penaltyMinor: '1100000',
      voidedMinor: '3300000',
    };
    const two: ActionPreview = {
      ...base,
      action: 'cancel',
      penaltyMinor: '0',
      voidedMinor: '1500000',
    };
    expect(previewLine(sumPreviews([one, two]))).toBe(
      'Начисление 48 000 ₸ сторнируется, вместо него штраф 11 000 ₸.',
    );
    expect(sumPreviews([one, null])).toBeNull();
    expect(sumPreviews([])).toBeNull();
  });

  it('сумму посчитать не удалось — окно всё равно открывается и говорит об этом', () => {
    expect(previewLine(null)).toBe('Сумму посчитать не удалось — проверьте счёт после действия.');
  });
});
