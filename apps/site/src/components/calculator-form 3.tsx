'use client';

import { useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { directSaving, MAX_ADR, MAX_NIGHTS, parseWhole } from '../lib/calculator';

type Props = { t: Dictionary['calculator'] };

type Key = 'nights' | 'adr' | 'commission' | 'shift';

const FORMAT = new Intl.NumberFormat('ru-RU');
const money = (value: number) => `${FORMAT.format(value)}\u00a0₸`;

/*
 * Форма калькулятора (клиентский код: сайт статический, считает браузер). Ошибка показывается только у непустого
 * поля; результат — только когда все четыре значения верны.
 */
export function CalculatorForm({ t }: Props) {
  const [values, setValues] = useState<Record<Key, string>>({ nights: '', adr: '', commission: '', shift: '' });

  const parsed = {
    nights: parseWhole(values.nights),
    adr: parseWhole(values.adr),
    commission: parseWhole(values.commission),
    shift: parseWhole(values.shift),
  };

  const errorFor = (key: Key): string | null => {
    if (values[key].trim() === '') return null;
    const value = parsed[key];
    if (value === null) return t.errors.whole;
    if (key === 'nights' && value > MAX_NIGHTS) return t.errors.nights;
    if (key === 'adr' && value > MAX_ADR) return t.errors.adr;
    if ((key === 'commission' || key === 'shift') && value > 100) return t.errors.percent;
    return null;
  };

  const result =
    parsed.nights !== null && parsed.adr !== null && parsed.commission !== null && parsed.shift !== null
      ? directSaving({
          nights: parsed.nights,
          adr: parsed.adr,
          commissionPct: parsed.commission,
          shiftPct: parsed.shift,
        })
      : null;

  const keys: Key[] = ['nights', 'adr', 'commission', 'shift'];

  return (
    <div className="calc">
      <div className="calc__fields">
        {keys.map((key) => {
          const error = errorFor(key);
          const field = t.fields[key];
          return (
            <div key={key} className="calc__field">
              <label className="calc__label" htmlFor={`calc-${key}`}>
                {field.label}
              </label>
              <input
                id={`calc-${key}`}
                className="calc__input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={values[key]}
                onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
                aria-invalid={error ? true : undefined}
                aria-describedby={`calc-${key}-note`}
              />
              <p id={`calc-${key}-note`} className={error ? 'calc__error' : 'calc__hint'}>
                {error ?? field.hint}
              </p>
            </div>
          );
        })}
      </div>

      <div className="calc__output" aria-live="polite">
        {result ? (
          <div data-calc-result>
            <p className="calc__title">{t.result.title}</p>
            <dl className="calc__numbers">
              <div>
                <dt>{t.result.commission}</dt>
                <dd>{money(result.commissionMonth)}</dd>
              </div>
              <div>
                <dt>{t.result.savedMonth}</dt>
                <dd>{money(result.savedMonth)}</dd>
              </div>
              <div>
                <dt>{t.result.savedYear}</dt>
                <dd>{money(result.savedYear)}</dd>
              </div>
            </dl>
            <p className="calc__note">{t.result.note}</p>
          </div>
        ) : (
          <p className="calc__note">{t.empty}</p>
        )}
      </div>
    </div>
  );
}
