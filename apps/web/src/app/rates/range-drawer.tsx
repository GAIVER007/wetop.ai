'use client';
import { useState, useTransition } from 'react';
import { READ_ONLY_MESSAGE } from '@pms/domain';
import type { RateCalendarDay, RateChangeInput } from '../../lib/api';
import { displayDay, displayPeriod } from '../../lib/display-date';
import { formatMoney } from '../../lib/money';
import { pluralRu } from '../../lib/plural';
import { Alert, Button, Field, Input, Notice } from '../../components/ui';
import { Overlay } from '../../components/overlay';
import { useToast } from '../../components/toast';
import { bulkRatesAction } from './actions';
import { parseNewPrice, summarizePrices, type PriceSummary } from './range-summary';

const dates = (n: number) => pluralRu(n, ['дата', 'даты', 'дат']);
/** «Будет изменена 1 дата», «Будут изменены 8 дат»: сказуемое согласуется с числом */
const singular = (n: number) => n % 10 === 1 && n % 100 !== 11;
export const periodOf = (from: string, to: string) =>
  from === to ? displayDay(from) : displayPeriod(from, to);
export const selectedText = (n: number) => `${singular(n) ? 'Выбрана' : 'Выбрано'} ${dates(n)}`;

function currentText(s: PriceSummary, currency: string): string {
  if (s.kind === 'none') return 'нет цены';
  if (s.kind === 'same') return formatMoney(s.minor, currency);
  const range =
    s.min === s.max
      ? formatMoney(s.min, currency)
      : `отличаются: от ${formatMoney(s.min, currency)} до ${formatMoney(s.max, currency)}`;
  return s.missing ? `${range}, у ${pluralRu(s.missing, ['даты', 'дат', 'дат'])} цены нет` : range;
}

/**
 * «Изменить цены» выбранных в календаре дат (RT2, ADR-111, план §8): факты, текущая и новая цена по каждой
 * вместимости, предпросмотр до сохранения. Сохраняет существующий `bulkRatesAction` — одна строка на меняемую
 * вместимость, все одним запросом, то есть одной транзакцией с журналом и очередью каналов; своей логики
 * цен здесь нет. Меньшая вместимость по умолчанию «не менять», как у правки ячейки (`occupancy` в строке).
 */
export function RangeDrawer(props: {
  days: RateCalendarDay[];
  from: string;
  to: string;
  capacityAdults: number;
  currency: string;
  category: string;
  ratePlan: string;
  categoryName: string;
  planName: string;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = props.days.length;
  const period = periodOf(props.from, props.to);
  // полная вместимость — цена продажи, её первой; меньшие — следом
  const occupancies = Array.from({ length: props.capacityAdults }, (_, i) => props.capacityAdults - i);
  const rows = occupancies.map((occ) => ({
    occ,
    summary: summarizePrices(props.days, occ),
    parsed: parseNewPrice(values[occ] ?? ''),
  }));
  const changed = rows.filter(
    (r): r is typeof r & { parsed: { price: string; minor: bigint } } =>
      r.parsed !== null && 'price' in r.parsed,
  );
  const invalid = rows.some((r) => r.parsed !== null && 'error' in r.parsed);
  const label = (occ: number) =>
    props.capacityAdults > 1
      ? `Новая цена за ${pluralRu(occ, ['гостя', 'гостей', 'гостей'])}`
      : 'Новая цена';

  const apply = () =>
    start(async () => {
      setError(null);
      const changes: RateChangeInput[] = changed.map((r) => ({
        accommodationTypeCode: props.category,
        ratePlanCode: props.ratePlan,
        dateFrom: props.from,
        dateTo: props.to,
        occupancy: r.occ,
        price: r.parsed.price,
      }));
      const res = await bulkRatesAction(changes);
      if (res.error) {
        setError(res.error);
        return;
      }
      // «Ушло в каналы» — по ответу API, как у ячейки: несопоставленные с Channex категория и тариф пропускаются
      toast({
        tone: res.queued ? 'success' : 'warning',
        text: `Цены обновлены для ${pluralRu(n, ['даты', 'дат', 'дат'])}. ${
          res.queued
            ? 'Изменения поставлены в очередь каналов.'
            : 'В каналы не ушло: категория или тариф не сопоставлены с Channex.'
        }`,
      });
      props.onSaved();
    });

  return (
    <Overlay open onClose={props.onClose} title="Изменить цены" drawer className="rates-drawer">
      <div className="stack">
        {props.readOnly && (
          <Notice tone="muted" data-testid="range-read-only">
            {READ_ONLY_MESSAGE}
          </Notice>
        )}
        <dl className="range-facts" data-testid="range-facts">
          <div>
            <dt>Категория</dt>
            <dd>{props.categoryName}</dd>
          </div>
          <div>
            <dt>Тариф</dt>
            <dd>{props.planName}</dd>
          </div>
          <div>
            <dt>Выбранные даты</dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt>Количество дат</dt>
            <dd>{dates(n)}</dd>
          </div>
        </dl>
        {rows.map(({ occ, summary, parsed }) => (
          <fieldset key={occ} className="range-price">
            {props.capacityAdults > 1 && (
              <legend className="range-price__legend">
                {pluralRu(occ, ['гость', 'гостя', 'гостей'])}
              </legend>
            )}
            <div className="range-price__current">
              <span className="range-price__word">Текущая цена</span>
              <span data-testid={`range-current-${occ}`}>
                {currentText(summary, props.currency)}
              </span>
            </div>
            <Field label="Новая цена">
              <Input
                aria-label={label(occ)}
                inputMode="decimal"
                placeholder={occ === props.capacityAdults ? 'например, 12000' : 'не менять'}
                value={values[occ] ?? ''}
                aria-invalid={parsed !== null && 'error' in parsed ? true : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [occ]: e.target.value }))}
              />
            </Field>
            {parsed !== null && 'error' in parsed && (
              <p className="range-price__error danger-text">{parsed.error}</p>
            )}
          </fieldset>
        ))}
        {changed.length > 0 && (
          <div className="range-preview" role="status" data-testid="range-preview">
            <p className="range-preview__title">
              {singular(n) ? 'Будет изменена' : 'Будут изменены'} {dates(n)}
            </p>
            <p>{period}</p>
            {changed.map(({ occ, summary, parsed }) => {
              const next = formatMoney(parsed.minor, props.currency);
              return (
                <div key={occ} className="range-preview__line">
                  {props.capacityAdults > 1 && (
                    <p className="range-preview__who">
                      {pluralRu(occ, ['гость', 'гостя', 'гостей'])}
                    </p>
                  )}
                  {summary.kind === 'mixed' ? (
                    <>
                      <p>Текущие цены отличаются</p>
                      <p>Новая цена: {next}</p>
                    </>
                  ) : (
                    <p>
                      {summary.kind === 'same'
                        ? formatMoney(summary.minor, props.currency)
                        : 'Нет цены'}{' '}
                      → {next}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <div>
          <Button
            type="button"
            data-testid="range-apply"
            disabled={props.readOnly || pending || invalid || changed.length === 0}
            aria-busy={pending || undefined}
            onClick={apply}
          >
            {pending ? 'Сохраняю…' : `Применить к ${pluralRu(n, ['дате', 'датам', 'датам'])}`}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
