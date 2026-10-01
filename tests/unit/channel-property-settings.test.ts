import { describe, expect, it } from 'vitest';
import { RECOMMENDED, settingsReport } from '../../scripts/reconciliation/src/channel-property-settings';

/**
 * Разбор 01.10.2026 (reports/order-2026-10-01, пункт 3): объект в Channex создавался с автообновлением остатка по
 * изменению и отмене брони, а документация Channex советует `false` для обоих. Скрипт cli-channex-property-settings.ts
 * показывает, что стоит у боевого объекта, и с `--apply` ставит рекомендованное; здесь проверяется его чистая часть.
 */
describe('настройки объекта Channex: что советует документация', () => {
  it('подтверждение брони остаётся true, изменение и отмена становятся false', () => {
    expect(RECOMMENDED).toEqual({
      allow_availability_autoupdate_on_confirmation: true,
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
    });
  });

  it('объект, созданный до 01.10.2026 (три true), отличается от рекомендации по двум полям', () => {
    const report = settingsReport({
      allow_availability_autoupdate_on_confirmation: true,
      allow_availability_autoupdate_on_modification: true,
      allow_availability_autoupdate_on_cancellation: true,
      min_stay_type: 'both',
    });
    expect(report.differs).toBe(true);
    expect(report.lines.filter((l) => l.includes('рекомендовано'))).toHaveLength(2);
  });

  it('объект без настроек: все три поля «не задано», отличие есть', () => {
    const report = settingsReport(undefined);
    expect(report.differs).toBe(true);
    expect(report.lines.every((l) => l.includes('не задано'))).toBe(true);
  });

  it('рекомендованные значения отличий не дают', () => {
    expect(settingsReport({ ...RECOMMENDED }).differs).toBe(false);
  });
});
