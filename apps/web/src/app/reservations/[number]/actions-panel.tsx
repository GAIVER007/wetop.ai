'use client';
import { useActionState, useRef, useState } from 'react';
import { useCommand } from '../../../lib/use-command';
import { formatMoney } from '../../../lib/money';
import { displayDay, displayPeriod } from '../../../lib/display-date';
import { penaltyText } from '../../../lib/penalty-text';
import type { CancelPreview, ExtendPreview, MovePreview } from '../../../lib/api';
import {
  Alert,
  Button,
  Field,
  Input,
  Notice,
  PanelTitle,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import {
  assignUnitAction,
  cancelPreviewAction,
  extendStayAction,
  movePreviewAction,
  stayAction,
  cancelReservationAction,
  changeDatesAction,
  updateReservationAction,
  updateStayGuestsAction,
  type ActionResult,
} from '../actions';
import { SOURCES } from '../sources';

const OPEN = new Set(['TENTATIVE', 'CONFIRMED']);
const nightsWord = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ночь' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ночи' : 'ночей'}`;

export interface ActionItem {
  id: string;
  status: string;
  accommodationTypeCode: string;
  accommodationTypeName: string;
  unitCode: string | null;
  arrivalDate: string;
  departureDate: string;
  /** null — тариф неизвестен (перенесено из Exely): пересчёт цены без выбора тарифа невозможен */
  ratePlanCode: string | null;
  ratePlanName: string | null;
  adults: number;
  children: number;
  availableGroups: Array<{ code: string; name: string; units: string[] }>;
  /** Остаток счёта проживания (тиыны строкой) — для окна «Выселить с долгом» */
  balanceMinor: string | null;
  /** Предпросмотр продления на ночь (Д5): сумма и занята ли ячейка; null — не загрузился */
  extendPreview: ExtendPreview | null;
}

export function ReservationActions(props: {
  number: string;
  status: string;
  source: string;
  notes: string | null;
  arrivalDate: string;
  departureDate: string;
  guestLabel: string;
  currency: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  items: ActionItem[];
}) {
  // Как в API (changeDates): без явного выбора пересчёт идёт по тарифу первого неотменённого проживания (Б1)
  const current = props.items.find((it) => it.status !== 'CANCELLED' && it.ratePlanCode);
  const {
    state: cancelState,
    run: cancel,
    pending: cancelPending,
  } = useCommand<ActionResult>({ error: null });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null | undefined>(undefined);
  const openCancel = () => {
    setCancelPreview(undefined);
    setCancelOpen(true);
    void cancelPreviewAction(props.number, 'cancel').then((r) => setCancelPreview(r.preview));
  };
  const [datesState, datesAction, datesPending] = useActionState<ActionResult, FormData>(
    changeDatesAction.bind(null, props.number),
    { error: null },
  );
  const canEdit = OPEN.has(props.status);
  return (
    <section data-testid="reservation-actions" className="stack stack--mt">
      <EditForm number={props.number} source={props.source} notes={props.notes} />
      {canEdit && (
        // Поля неконтролируемые: defaultValue применяется только при монтировании, поэтому после
        // «Продлить на ночь» или переселения форма показывала бы прежние даты, а сохранение молча укоротило
        // бы проживание. Ключ по текущим датам отрисовывает поля заново.
        <form
          key={`${props.arrivalDate}-${props.departureDate}-${datesState.attempt ?? 0}`}
          action={datesAction}
          className="panel"
        >
          <PanelTitle>Изменить даты</PanelTitle>
          <Row>
            <Field label="Заезд">
              <Input
                type="date"
                name="arrivalDate"
                defaultValue={datesState.values?.arrivalDate ?? props.arrivalDate}
              />
            </Field>
            <Field label="Выезд">
              <Input
                type="date"
                name="departureDate"
                defaultValue={datesState.values?.departureDate ?? props.departureDate}
              />
            </Field>
            <Select
              name="ratePlanCode"
              aria-label="Тариф для пересчёта"
              defaultValue={datesState.values?.ratePlanCode ?? ''}
              required={!current}
            >
              {current ? (
                <option value="">
                  — оставить текущий тариф: {current.ratePlanName ?? current.ratePlanCode} —
                </option>
              ) : (
                <option value="" disabled>
                  — выберите тариф —
                </option>
              )}
              {props.ratePlans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={datesPending}>
              Пересчитать и сохранить
            </Button>
          </Row>
          {!current && (
            <p className="hint">
              У брони нет тарифа (перенесена из Exely) — выберите, по какому пересчитать цену.
            </p>
          )}
          {datesState.error && <Alert>{datesState.error}</Alert>}
        </form>
      )}
      {props.items
        .filter(
          (it) =>
            it.status !== 'CANCELLED' && it.status !== 'CHECKED_OUT' && it.status !== 'NO_SHOW',
        )
        .map((it) => (
          <Stack key={it.id} gap="sm">
            <StayButtons
              number={props.number}
              item={it}
              ratePlans={props.ratePlans}
              currency={props.currency}
              guestLabel={props.guestLabel}
            />
            <GuestsForm number={props.number} item={it} />
            <AssignForm
              number={props.number}
              item={it}
              arrivalDate={props.arrivalDate}
              ratePlans={props.ratePlans}
              currency={props.currency}
            />
          </Stack>
        ))}
      {canEdit && (
        <div className="panel">
          <div>
            <Button
              type="button"
              tone="danger"
              disabled={cancelPending}
              data-testid="cancel-reservation"
              onClick={openCancel}
            >
              Отменить бронь
            </Button>
          </div>
          {cancelState.error && !cancelOpen && <Alert>{cancelState.error}</Alert>}
          {/* Окно вместо window.confirm (DESIGN.md §15): вопрос с объектом, последствие и штраф до нажатия (Д5) */}
          <ConfirmDialog
            open={cancelOpen}
            title={`Отменить бронь ${props.number}?`}
            consequence="Место вернётся в продажу и уйдёт в каналы. Отмена необратима."
            amount={
              <span data-testid="cancel-penalty">
                {penaltyText(cancelPreview, 'cancel', props.currency)}
              </span>
            }
            confirmLabel="Отменить бронь"
            cancelLabel="Оставить"
            tone="danger"
            pending={cancelPending ? 'Отменяю…' : undefined}
            error={cancelState.error}
            onConfirm={() =>
              void cancel(async () => {
                const r = await cancelReservationAction(props.number);
                if (!r.error) setCancelOpen(false);
                return r;
              })
            }
            onCancel={() => setCancelOpen(false)}
          >
            <p>
              Гость {props.guestLabel}, {displayPeriod(props.arrivalDate, props.departureDate)}.
            </p>
          </ConfirmDialog>
        </div>
      )}
    </section>
  );
}

/** Правка готовой брони: заметки и источник. Ключ по текущим значениям — после сохранения поля перерисовываются. */
function EditForm(props: { number: string; source: string; notes: string | null }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateReservationAction.bind(null, props.number),
    { error: null },
  );
  return (
    <form
      key={`${props.source}|${props.notes ?? ''}|${state.attempt ?? 0}`}
      action={action}
      className="panel"
      data-testid="edit-reservation-form"
    >
      <PanelTitle>Заметки и источник</PanelTitle>
      <Row>
        <Field inline label="Источник">
          <Select name="source" defaultValue={state.values?.source ?? props.source}>
            {SOURCES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Textarea
          name="notes"
          rows={2}
          placeholder="Заметки"
          defaultValue={state.values?.notes ?? props.notes ?? ''}
          className="inp--grow"
        />
        <Button type="submit" disabled={pending}>
          Сохранить
        </Button>
      </Row>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/** Гостей на проживании (Q-102). Цена не меняется: перецена по календарю — «Изменить даты». */
function GuestsForm(props: {
  number: string;
  item: { id: string; adults: number; children: number; accommodationTypeName: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateStayGuestsAction.bind(null, props.number, props.item.id),
    { error: null },
  );
  return (
    <form
      key={`${props.item.adults}-${props.item.children}-${state.attempt ?? 0}`}
      action={action}
      className="panel"
      data-testid={`guests-form-${props.item.id}`}
    >
      <Row>
        <Field inline label="Гостей">
          <Input
            type="number"
            name="adults"
            min={1}
            defaultValue={state.values?.adults ?? props.item.adults}
            className="inp--w64"
          />
        </Field>
        <Field inline label="Детей">
          <Input
            type="number"
            name="children"
            min={0}
            defaultValue={state.values?.children ?? props.item.children}
            className="inp--w64"
          />
        </Field>
        <Button type="submit" tone="secondary" size="sm" disabled={pending}>
          Сохранить
        </Button>
        <span className="hint">цена не меняется; пересчитать по календарю — «Изменить даты»</span>
      </Row>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/**
 * Заезд, выезд, незаезд и продление. Окна подтверждения показывают сумму до нажатия (Д5): штраф за незаезд
 * и долг при выезде считает сервер; «Продлить на ночь» знает цену новой ночи и занята ли ячейка заранее.
 */
function StayButtons(props: {
  number: string;
  item: ActionItem;
  ratePlans: Array<{ code: string; name: string }>;
  currency: string;
  guestLabel: string;
}) {
  const { state, run: command, pending } = useCommand<ActionResult>({ error: null });
  // Б8: у проживания без тарифа цену новой ночи взять не из чего — тариф выбирает администратор
  const [extendPlan, setExtendPlan] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'no-show' | 'debt'>(null);
  const [noShowPreview, setNoShowPreview] = useState<CancelPreview | null | undefined>(undefined);
  const needsPlan = !props.item.ratePlanCode;
  const ext = props.item.extendPreview;
  const busyUnit = ext ? !ext.nextNightsFree : false;
  const it = props.item;
  const openNoShow = () => {
    setNoShowPreview(undefined);
    setDialog('no-show');
    void cancelPreviewAction(props.number, 'no_show', it.id).then((r) =>
      setNoShowPreview(r.preview),
    );
  };
  const checkOut = (withDebt: boolean) =>
    command(async () => {
      const r = await stayAction(props.number, it.id, 'check-out', withDebt);
      // T3: выселение с долгом — окно с суммой долга вместо второго вопроса
      if (!withDebt && r.error && r.error.includes('долг')) setDialog('debt');
      else if (!r.error) setDialog(null);
      return r;
    });
  const extend = () =>
    command(async () => {
      const r = await extendStayAction(props.number, it.id, 1, needsPlan ? extendPlan : undefined);
      if (!r.error)
        setDone(
          ext?.addedMinor
            ? `Проживание продлено до ${displayDay(ext.departureDate)}, +${formatMoney(ext.addedMinor, props.currency)} на счёт`
            : 'Проживание продлено на ночь',
        );
      return r;
    });
  const expected = it.status === 'CONFIRMED' || it.status === 'TENTATIVE';
  const extendHint = needsPlan
    ? 'У проживания нет тарифа (перенесено из Exely): выберите тариф для новой ночи'
    : !ext
      ? 'Выезд на сутки позже, цена новой ночи по календарю'
      : busyUnit
        ? `${ext.unitCode ?? 'Ячейка'} занята ${displayDay(it.departureDate)} — сначала переселите`
        : ext.problem
          ? ext.problem
          : `до ${displayDay(ext.departureDate)}, ${ext.addedMinor ? `+${formatMoney(ext.addedMinor, props.currency)} на счёт` : 'цена по календарю'}`;
  return (
    <div className="panel">
      <PanelTitle>
        {it.accommodationTypeName} — {it.unitCode ?? 'ячейка не назначена'}
      </PanelTitle>
      <Row>
        {expected && (
          <Button
            type="button"
            data-testid={`check-in-${it.id}`}
            onClick={() => void command(() => stayAction(props.number, it.id, 'check-in'))}
            disabled={pending || !it.unitCode}
            title={it.unitCode ? '' : 'Сначала назначьте ячейку'}
          >
            Заселить
          </Button>
        )}
        {it.status === 'CHECKED_IN' && (
          <Button
            type="button"
            data-testid={`check-out-${it.id}`}
            disabled={pending}
            onClick={() => void checkOut(false)}
          >
            Выселить
          </Button>
        )}
        {(expected || it.status === 'CHECKED_IN') && needsPlan && (
          <Select
            aria-label="Тариф для продления"
            value={extendPlan}
            onChange={(e) => setExtendPlan(e.target.value)}
          >
            <option value="" disabled>
              — тариф для новой ночи —
            </option>
            {props.ratePlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        {(expected || it.status === 'CHECKED_IN') && (
          <span className="row row--inline">
            <Button
              type="button"
              tone="info"
              data-testid={`extend-${it.id}`}
              disabled={pending || (needsPlan && !extendPlan) || busyUnit}
              onClick={() => void extend()}
              title={extendHint}
            >
              Продлить на ночь
            </Button>
            <span className="hint" data-testid={`extend-hint-${it.id}`}>
              {extendHint}
            </span>
          </span>
        )}
        {expected && (
          <Button
            type="button"
            tone="warning"
            data-testid={`no-show-${it.id}`}
            disabled={pending}
            onClick={openNoShow}
          >
            Незаезд
          </Button>
        )}
      </Row>
      {state.error && dialog === null && <Alert>{state.error}</Alert>}
      {done && !state.error && <Notice data-testid={`extend-done-${it.id}`}>{done}</Notice>}
      <ConfirmDialog
        open={dialog === 'no-show'}
        title={`Отметить незаезд по ${it.unitCode ?? it.accommodationTypeName}?`}
        consequence="Назначение ячейки снимется, место вернётся в продажу. Незаезд необратим."
        amount={
          <span data-testid="no-show-penalty">
            {penaltyText(noShowPreview, 'no_show', props.currency)}
          </span>
        }
        confirmLabel="Отметить незаезд"
        cancelLabel="Оставить"
        tone="danger"
        pending={pending ? 'Отмечаю…' : undefined}
        error={state.error}
        onConfirm={() =>
          void command(async () => {
            const r = await stayAction(props.number, it.id, 'no-show');
            if (!r.error) setDialog(null);
            return r;
          })
        }
        onCancel={() => setDialog(null)}
      >
        <p>
          Гость {props.guestLabel}, {displayPeriod(it.arrivalDate, it.departureDate)}.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'debt'}
        title="Выселить с долгом?"
        consequence="Счёт останется открытым, долг — за гостем."
        amount={
          <span data-testid="debt-amount">
            {it.balanceMinor
              ? `Долг ${formatMoney(it.balanceMinor, props.currency)} останется на счёте`
              : (state.error ?? 'На счёте есть долг')}
          </span>
        }
        confirmLabel="Выселить с долгом"
        cancelLabel="Оставить"
        tone="danger"
        pending={pending ? 'Выселяю…' : undefined}
        onConfirm={() => void checkOut(true)}
        onCancel={() => setDialog(null)}
      >
        <p>
          Гость {props.guestLabel}, {it.unitCode ?? it.accommodationTypeName}.
        </p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * Назначение и переселение. Ячейка другой категории — окно с новой суммой до подтверждения (05-1, Д5);
 * внутри категории — сразу, цена не меняется.
 */
function AssignForm(props: {
  number: string;
  arrivalDate: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  currency: string;
  item: ActionItem;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    assignUnitAction.bind(null, props.number, props.item.id),
    { error: null },
  );
  const form = useRef<HTMLFormElement>(null);
  const bypass = useRef(false);
  const [confirm, setConfirm] = useState<{
    unitCode: string;
    preview: MovePreview | null | undefined;
    error: string | null;
  } | null>(null);
  const preview = confirm?.preview;
  return (
    <>
      <form
        ref={form}
        key={`${props.item.unitCode ?? '-'}-${props.arrivalDate}-${state.attempt ?? 0}`}
        action={action}
        className="panel"
        data-testid="assign-form"
        onSubmit={(e) => {
          if (bypass.current) {
            bypass.current = false;
            return;
          }
          const fd = new FormData(e.currentTarget);
          const unitCode = String(fd.get('unitCode') ?? '');
          const ratePlanCode = String(fd.get('ratePlanCode') ?? '') || undefined;
          const group = props.item.availableGroups.find((g) => g.units.includes(unitCode));
          if (!group || group.code === props.item.accommodationTypeCode) return; // своя категория — сразу
          e.preventDefault();
          setConfirm({ unitCode, preview: undefined, error: null });
          void movePreviewAction(props.number, props.item.id, unitCode, ratePlanCode).then((r) =>
            setConfirm((c) => (c ? { ...c, preview: r.preview, error: r.error } : c)),
          );
        }}
      >
        <PanelTitle>
          {props.item.unitCode ? `Переселить из ${props.item.unitCode}` : 'Назначить ячейку'} —{' '}
          {props.item.accommodationTypeName}
        </PanelTitle>
        <Row>
          <Select
            name="unitCode"
            aria-label="Свободная ячейка"
            required
            defaultValue={state.values?.unitCode ?? ''}
          >
            <option value="" disabled>
              — свободная ячейка —
            </option>
            {props.item.availableGroups.map((g) => (
              <optgroup
                key={g.code}
                label={
                  g.code === props.item.accommodationTypeCode
                    ? g.name
                    : `${g.name} — с пересчётом цены`
                }
              >
                {g.units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Field label="Тариф при смене категории">
            <Select name="ratePlanCode" defaultValue={state.values?.ratePlanCode ?? ''}>
              <option value="">Тариф проживания</option>
              {props.ratePlans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} ({plan.currency})
                </option>
              ))}
            </Select>
          </Field>
          <Field inline label="с даты">
            <Input
              type="date"
              name="fromDate"
              defaultValue={state.values?.fromDate ?? props.arrivalDate}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {props.item.unitCode ? 'Переселить' : 'Назначить'}
          </Button>
        </Row>
        <div className="hint">
          Внутри категории цена не меняется. Ячейка другой категории пересчитает цену по её
          календарю на весь срок — сумму покажем до подтверждения.
        </div>
        {state.error && <Alert>{state.error}</Alert>}
      </form>
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm
            ? `Переселить в ${preview?.toCategory?.name.toLocaleLowerCase('ru') ?? 'другую категорию'} ${confirm.unitCode}?`
            : ''
        }
        consequence="Счёт будет пересчитан по тарифу новой категории на весь срок проживания."
        amount={
          <span data-testid="move-amount">
            {preview === undefined
              ? 'Считаю новую сумму…'
              : preview?.newMinor
                ? `Новая сумма за ${nightsWord(preview.nights)} ${formatMoney(preview.newMinor, props.currency)} (было ${formatMoney(preview.currentMinor, props.currency)})`
                : (preview?.problem ?? confirm?.error ?? 'Сумма не загрузилась')}
          </span>
        }
        confirmLabel="Переселить и пересчитать"
        pending={pending ? 'Переселяю…' : undefined}
        error={preview?.problem ?? confirm?.error ?? null}
        onConfirm={() => {
          bypass.current = true;
          form.current?.requestSubmit();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      >
        {confirm && (
          <p>
            Проживание {displayPeriod(props.item.arrivalDate, props.item.departureDate)}, сейчас{' '}
            {props.item.unitCode ?? 'без ячейки'} ({props.item.accommodationTypeName}).
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
