'use client';
import { useState, useTransition } from 'react';
import { Button, Input, cx } from '../../components/ui';
import { Tooltip } from '../../components/tooltip';
import { formatMoney, minorToInput } from '../../lib/money';
import { bulkRatesAction } from './actions';

/**
 * Правка цены прямо в ячейке календаря (срез 7.2, сцена показа Channex).
 *
 * Панель массовой правки остаётся: она для «поднять выходные на месяц вперёд». Одна цена на одну
 * дату — это один клик, и путь у него тот же самый: `bulkRatesAction` на одну строку, то есть одна
 * транзакция в API и одно сообщение в очередь каналов. Своей логики цен здесь нет.
 */
export function PriceCell({
  date,
  occupancy,
  minor,
  currency,
  accommodationTypeCode,
  ratePlanCode,
}: {
  date: string;
  occupancy: number;
  minor: string | null;
  currency: string;
  accommodationTypeCode: string;
  ratePlanCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(minor ? minorToInput(minor) : '');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    if (pending) return;
    const price = value.trim().replace(',', '.');
    if (!price) {
      setResult({ ok: false, text: 'Введите цену в тенге' });
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(price)) {
      setResult({ ok: false, text: 'Введите цену числом' });
      return;
    }
    if (/^0+(\.0{1,2})?$/.test(price)) {
      setResult({ ok: false, text: 'Цена не может быть 0' });
      return;
    }
    start(async () => {
      const r = await bulkRatesAction([
        { accommodationTypeCode, ratePlanCode, dateFrom: date, dateTo: date, occupancy, price },
      ]);
      if (r.error) {
        setResult({ ok: false, text: r.error });
        return;
      }
      setOpen(false);
      setResult({
        ok: true,
        text: r.queued
          ? `Цена сохранена, ушло в очередь каналов: ${r.queued}`
          : 'Цена сохранена, но в очередь каналов не ушла: категория или тариф не сопоставлены с Channex',
      });
    });
  };

  const trigger = (
    <button
      type="button"
      className={cx('price-cell__value', !minor && 'price-cell__value--empty')}
      data-testid="price-cell-edit"
      aria-label={`Изменить цену на ${date}, гостей ${occupancy}`}
      onClick={() => {
        setValue(minor ? minorToInput(minor) : '');
        setResult(null);
        setOpen((v) => !v);
      }}
    >
      {/* «Нет цены» вместо «—» (ТЗ v2 §21, ADR-111): прочерк читался как пустая клетка, а не как «продажи нет» */}
      {minor ? formatMoney(minor, currency) : 'Нет цены'}
    </button>
  );
  return (
    <div className="price-cell">
      {minor ? (
        trigger
      ) : (
        <Tooltip text="Цена не задана: бронь на эту ночь создать нельзя, и в каналы она не уходит">
          {trigger}
        </Tooltip>
      )}
      {open && (
        <div className="price-editor" role="group" aria-label={`Цена на ${date}`}>
          <Input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            data-testid="price-cell-input"
            aria-label={`Цена в тенге на ${date}, гостей ${occupancy}`}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          <Button size="xs" type="button" onClick={save} disabled={pending}>
            Сохранить цену
          </Button>
          <Button size="xs" tone="ghost" type="button" onClick={() => setOpen(false)}>
            Отмена
          </Button>
        </div>
      )}
      {result && (
        <div
          className={cx('price-cell__result', result.ok ? 'ok-text' : 'danger-text')}
          data-testid="price-cell-result"
          role={result.ok ? undefined : 'alert'}
        >
          {result.text}
        </div>
      )}
    </div>
  );
}
