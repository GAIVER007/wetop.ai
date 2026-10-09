'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { formatOccupancy, formatPoints } from '@pms/domain';
import { useRouter } from 'next/navigation';
import type { MarketCell, MarketCompetitor, MarketNightHistory, MarketRates } from '../../lib/api';
import { minorToInput } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { pluralRu } from '../../lib/plural';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { useToast } from '../../components/toast';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select, Table, Textarea, cx } from '../../components/ui';
import {
  archiveCompetitorAction,
  saveCompetitorAction,
  writeOccupancyAction,
  writeRatesAction,
  type MarketActionResult,
} from './actions';

const NONE: MarketActionResult = { error: null, ok: 0 };

/**
 * Действие формы раздела: уведомление об успехе ставится сразу по ответу, до перерисовки (DESIGN.md §8). Иначе оно
 * терялось: после добавления первого конкурента или «убрать из списка» кнопка с панелью исчезает со страницы вместе
 * со своим эффектом. Панель закрывается эффектом, если кнопка осталась.
 */
function useMarketAction(
  serverAction: (prev: MarketActionResult, fd: FormData) => Promise<MarketActionResult>,
  close: () => void,
) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (prev: MarketActionResult, fd: FormData) => {
      const next = await serverAction(prev, fd);
      if (next.ok) toast({ text: next.message ?? 'Сохранено', tone: 'success' });
      return next;
    },
    NONE,
  );
  const seen = useRef(0);
  useEffect(() => {
    if (!state.ok || state.ok === seen.current) return;
    seen.current = state.ok;
    close();
  }, [state, close]);
  return [state, action, pending] as const;
}

/** «Добавить конкурента» и «Изменить»: одна форма; при правке внизу «Убрать из списка» */
export function CompetitorButton({
  competitor,
  primary,
  defaultOpen,
}: {
  competitor?: MarketCompetitor | undefined;
  primary?: boolean | undefined;
  /** Хаб «Продажи» ведёт сюда ссылкой `/market?add=1`: окно нового конкурента открыто сразу */
  defaultOpen?: boolean | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen === true);
  const label = competitor ? 'Изменить' : 'Добавить конкурента';
  return (
    <>
      <Button
        type="button"
        tone={competitor ? 'ghost' : primary ? undefined : 'secondary'}
        size={competitor ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={competitor ? `market-edit-${competitor.id}` : 'market-add'}
        aria-label={competitor ? `Изменить: ${competitor.name}` : undefined}
      >
        {!competitor && <Icon name="plus" />}
        {label}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={competitor ? competitor.name : 'Новый конкурент'}
          onClose={() => setOpen(false)}
        >
          <CompetitorForm competitor={competitor} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function CompetitorForm({
  competitor,
  onClose,
}: {
  competitor?: MarketCompetitor | undefined;
  onClose: () => void;
}) {
  const [state, action, pending] = useMarketAction(saveCompetitorAction, onClose);
  const [archived, archive, archiving] = useMarketAction(archiveCompetitorAction, onClose);
  const { ask, dialog } = useConfirm();
  const archiveForm = useRef<HTMLFormElement>(null);
  const error = state.error ?? archived.error;
  /** После отказа поля берут введённое, иначе сохранённое */
  const v = (name: keyof MarketCompetitor, fallback: string | number | null | undefined) =>
    state.values?.[name] ?? (fallback === null || fallback === undefined ? '' : String(fallback));
  return (
    <>
      <form action={action} className="settings-service-form" data-testid="market-competitor-form">
        {error && <Alert boxed>{error}</Alert>}
        {competitor && <input type="hidden" name="id" value={competitor.id} />}
        <p className="settings-note">
          Обязательно только название. По расстоянию список идёт от ближайших; ссылка, страница
          отеля, где вы смотрите его загрузку (например, на Booking.com).
        </p>
        <Field label="Название отеля">
          <Input
            name="name"
            required
            maxLength={120}
            autoFocus
            defaultValue={v('name', competitor?.name)}
            data-testid="market-name"
          />
        </Field>
        <Field label="Район">
          <Input name="district" maxLength={80} defaultValue={v('district', competitor?.district)} data-testid="market-district" />
        </Field>
        <Field label="Тип объекта">
          <Input
            name="category"
            maxLength={60}
            list="market-categories"
            placeholder="Отель, хостел, апартаменты"
            defaultValue={v('category', competitor?.category)}
            data-testid="market-category"
          />
          <datalist id="market-categories">
            {['Отель 5★', 'Отель 4★', 'Отель 3★', 'Мини-отель', 'Хостел', 'Апартаменты'].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field label="Адрес">
          <Input name="address" maxLength={200} defaultValue={v('address', competitor?.address)} />
        </Field>
        <Field label="Расстояние, метров">
          <Input
            name="distanceM"
            inputMode="numeric"
            defaultValue={v('distanceM', competitor?.distanceM)}
            data-testid="market-distance"
          />
        </Field>
        <Field label="Номеров у конкурента">
          <Input name="unitsTotal" inputMode="numeric" defaultValue={v('unitsTotal', competitor?.unitsTotal)} />
        </Field>
        <Field label="Ссылка на страницу отеля">
          <Input name="url" type="url" defaultValue={v('url', competitor?.url)} placeholder="https://" />
        </Field>
        <Field label="Заметка">
          <Textarea name="note" rows={2} maxLength={500} defaultValue={v('note', competitor?.note)} />
        </Field>
        <fieldset className="market-monitoring" data-testid="market-monitoring">
          <legend>Мониторинг</legend>
          <Field label="Что отслеживать">
            <Select name="monitoring" defaultValue={v('monitoring', competitor?.monitoring ?? 'BOTH')} data-testid="market-monitoring-kind">
              <option value="BOTH">Загрузку и цены</option>
              <option value="OCCUPANCY">Только загрузку</option>
              <option value="PRICE">Только цены</option>
            </Select>
          </Field>
          <Field label="Источник данных">
            <Input
              name="dataSource"
              maxLength={40}
              list="market-sources"
              placeholder="Откуда берёте цифры"
              defaultValue={v('dataSource', competitor?.dataSource)}
            />
            <datalist id="market-sources">
              {['Вручную', 'Файл CSV', 'Поставщик данных'].map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
          <Field label="Как часто обновлять">
            <Select name="refreshHours" defaultValue={v('refreshHours', competitor?.refreshHours)}>
              <option value="">Не задано</option>
              {[1, 2, 6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  Раз в {pluralRu(h, ['час', 'часа', 'часов'])}
                </option>
              ))}
            </Select>
          </Field>
          <label className="market-check">
            <input
              type="checkbox"
              name="autoRefresh"
              defaultChecked={state.values ? state.values['autoRefresh'] === 'on' : (competitor?.autoRefresh ?? false)}
            />
            Обновлять автоматически
          </label>
          <p className="settings-note" data-testid="market-auto-note">
            Автоматическое обновление включится, когда подключён разрешённый источник данных. Площадки
            бронирования мы сами не читаем: их условия это запрещают. Сейчас значения вносите вы, из файла
            или от поставщика данных.
          </p>
        </fieldset>
        <div className="settings-service-actions">
          <Button type="button" tone="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="market-save">
            {pending ? 'Сохраняю…' : competitor ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>
      {competitor && (
        <form ref={archiveForm} action={archive} className="market-archive">
          <input type="hidden" name="id" value={competitor.id} />
          <p className="settings-note">
            Убранный конкурент пропадёт из таблицы; внесённая загрузка сохранится в истории.
          </p>
          <Button
            type="button"
            tone="danger"
            disabled={archiving}
            data-testid="market-archive"
            onClick={async () => {
              const yes = await ask({
                title: `Убрать «${competitor.name}» из списка?`,
                body: 'Внесённая загрузка останется в истории.',
                confirmLabel: 'Убрать',
                tone: 'danger',
              });
              if (yes) archiveForm.current?.requestSubmit();
            }}
          >
            {archiving ? 'Убираю…' : 'Убрать из списка'}
          </Button>
          {dialog}
        </form>
      )}
    </>
  );
}

/** «Внести загрузку»: поле процента на каждую ночь окна; пустое поле снимает сегодняшнее значение */
export function OccupancyButton({
  competitor,
  cells,
}: {
  competitor: { id: string; name: string };
  cells: MarketCell[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="xs"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid={`market-enter-${competitor.id}`}
        aria-label={`Внести загрузку: ${competitor.name}`}
      >
        Внести загрузку
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={`Загрузка: ${competitor.name}`}
          onClose={() => setOpen(false)}
        >
          <OccupancyForm competitor={competitor} cells={cells} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

/** «Внести цены»: поле цены на каждую ночь окна, в валюте объекта; пустое поле снимает сегодняшнее значение */
export function RatesButton({
  competitor,
  cells,
  currency,
}: {
  competitor: { id: string; name: string };
  cells: MarketRates['board']['competitors'][number]['cells'];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="xs"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid={`market-rates-${competitor.id}`}
        aria-label={`Внести цены: ${competitor.name}`}
      >
        Внести цены
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={`Цены: ${competitor.name}`}
          onClose={() => setOpen(false)}
        >
          <RatesForm competitor={competitor} cells={cells} currency={currency} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function RatesForm({
  competitor,
  cells,
  currency,
  onClose,
}: {
  competitor: { id: string; name: string };
  cells: MarketRates['board']['competitors'][number]['cells'];
  currency: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useMarketAction(writeRatesAction, onClose);
  const sign = currency === 'KZT' ? '₸' : currency;
  return (
    <form action={action} className="settings-service-form" data-testid="market-rates-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="id" value={competitor.id} />
      <p className="settings-note">
        Цена за ночь в {sign}, например 42 000. Запишется снимком сегодняшнего дня: завтра увидите, как
        изменилась цена. Очистите поле, чтобы снять сегодняшнее значение.
      </p>
      <div className="market-entry-grid">
        {cells.map((c) => {
          const was = c.priceMinor === null ? '' : minorToInput(c.priceMinor);
          return (
            <label key={c.date} className="market-entry">
              <span className="market-entry__date">{dayLabel(c.date)}</span>
              <input type="hidden" name={`was:${c.date}`} value={was} />
              <span className="market-entry__field">
                <Input
                  name={`r:${c.date}`}
                  inputMode="decimal"
                  defaultValue={state.values?.[`r:${c.date}`] ?? was}
                  aria-label={`Цена на ${displayDate(c.date, 'numeric')}, ${sign}`}
                  data-testid={`market-r-${c.date}`}
                />
                <span aria-hidden="true">{sign}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="market-rates-save">
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

/** «Суббота, 3 октября»: день недели с большой буквы, без года */
const dayLabel = (date: string) => {
  const text = displayDate(date, 'full').replace(/ \d{4} г\.$/, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Значение поля из базисных пунктов: «85», «85,5» (без знака процента: он подписан у поля) */
const percentText = (bp: number | null) =>
  bp === null ? '' : formatOccupancy(bp).replace(' %', '');

function OccupancyForm({
  competitor,
  cells,
  onClose,
}: {
  competitor: { id: string; name: string };
  cells: MarketCell[];
  onClose: () => void;
}) {
  const [state, action, pending] = useMarketAction(writeOccupancyAction, onClose);
  const form = useRef<HTMLFormElement>(null);
  const [all, setAll] = useState('');
  /** Одно число во все ночи окна: соседи часто заполнены ровно, вводить 14 раз одно и то же незачем */
  const fillAll = () => {
    if (!all.trim()) return;
    form.current
      ?.querySelectorAll<HTMLInputElement>('input[name^="p:"]')
      .forEach((input) => (input.value = all.trim()));
  };
  return (
    <form ref={form} action={action} className="settings-service-form" data-testid="market-occupancy-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="id" value={competitor.id} />
      <p className="settings-note">
        Процент занятых номеров на ночь, от 0 до 100. Запишется снимком сегодняшнего дня: завтра
        увидите, как изменилась загрузка. Заполненные поля сохраняются все: так вы подтверждаете,
        что сегодня проверили и значение то же. Очистите поле, чтобы снять сегодняшнее значение.
      </p>
      <div className="market-fill">
        <Field inline label="Все ночи">
          <span className="market-entry__field">
            <Input
              inputMode="decimal"
              value={all}
              onChange={(e) => setAll(e.target.value)}
              aria-label="Одно значение для всех ночей, процентов"
              data-testid="market-fill-value"
            />
            <span aria-hidden="true">%</span>
          </span>
        </Field>
        <Button type="button" size="sm" tone="secondary" onClick={fillAll} data-testid="market-fill">
          Заполнить все ночи
        </Button>
      </div>
      <div className="market-entry-grid">
        {cells.map((c) => (
          <label key={c.date} className="market-entry">
            <span className="market-entry__date">{dayLabel(c.date)}</span>
            <input type="hidden" name={`was:${c.date}`} value={percentText(c.bp)} />
            <span className="market-entry__field">
              <Input
                name={`p:${c.date}`}
                inputMode="decimal"
                defaultValue={state.values?.[`p:${c.date}`] ?? percentText(c.bp)}
                aria-label={`Загрузка на ${displayDate(c.date, 'numeric')}, процентов`}
                data-testid={`market-p-${c.date}`}
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
        ))}
      </div>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="market-occupancy-save">
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

const pct = (bp: number | null) => (bp === null ? '–' : formatOccupancy(Math.round(bp / 100) * 100));

/**
 * «История ночи» (ADR-142, M1.2): как заполнялись соседи на одну ночь по дням снимков. Значение без нового снимка в этот
 * день перенесено с прошлого и показано бледнее; строка «Рынок» и темп за показанные дни. Закрытие убирает `?night=`.
 */
export function NightDrawer({
  date,
  history,
  closeHref,
}: {
  date: string;
  history: MarketNightHistory | null;
  closeHref: string;
}) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <Overlay
      open
      drawer
      className="settings-service-drawer market-night"
      title={`История ночи: ${dayLabel(date)}`}
      onClose={close}
    >
      {!history ? (
        <Alert boxed>История ночи не загрузилась. Закройте панель и откройте снова.</Alert>
      ) : history.days.length === 0 ? (
        <p className="settings-note" data-testid="market-night-empty">
          На эту ночь снимков ещё нет. Внесите загрузку соседей, и здесь появится, как они заполняются
          день за днём.
        </p>
      ) : (
        <>
          <p className="settings-note" data-testid="market-night-pickup">
            {history.pickupBp === null
              ? 'Пока один день снимков: темп рынка появится со вторым.'
              : `Рынок за ${pluralRu(history.days.length, ['день', 'дня', 'дней'])} снимков: ${formatPoints(Math.round(history.pickupBp / 100) * 100)}`}
            {' '}
            Бледным: значение перенесено с прошлого снимка, в этот день соседа не проверяли.
          </p>
          <Table size="sm" className="market-night-table" aria-label="Загрузка ночи по дням снимков" data-testid="market-night-table">
            <thead>
              <tr>
                <th scope="col">Снимок</th>
                {history.competitors.map((c) => (
                  <th key={c.id} scope="col">
                    {c.name}
                  </th>
                ))}
                <th scope="col">Рынок</th>
              </tr>
            </thead>
            <tbody>
              {[...history.days].reverse().map((d) => (
                <tr key={d.observedOn}>
                  <th scope="row">{displayDate(d.observedOn, 'numeric')}</th>
                  {d.values.map((v) => (
                    <td key={v.competitorId} className={cx(!v.observed && 'market-night__carried')}>
                      {pct(v.bp)}
                    </td>
                  ))}
                  <td className="market-night__market">{pct(d.marketBp)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Overlay>
  );
}
