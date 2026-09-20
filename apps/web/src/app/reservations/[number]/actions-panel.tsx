'use client';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { useCommand } from '../../../lib/use-command';
import {
  Alert,
  Button,
  Field,
  Input,
  PanelTitle,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import type { CancelPreview, ExtendPreview, MovePreview } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { penaltyText } from '../../../lib/penalty-text';
import { pluralRu } from '../../../lib/plural';
import {
  assignUnitAction,
  cancelPreviewAction,
  cancelReservationAction,
  changeDatesAction,
  extendPreviewAction,
  extendStayAction,
  movePreviewAction,
  stayAction,
  updateReservationAction,
  updateStayGuestsAction,
  type ActionResult,
} from '../actions';
import { SOURCES } from '../sources';
import { useConfirm } from '../../../components/use-confirm';
import { previewLine } from '../../../lib/action-preview';
import { useToast } from '../../../components/toast';
import { previewAction } from '../actions';

const OPEN = new Set(['TENTATIVE', 'CONFIRMED']);
/** Дата словами стойки: 20.09.2026 (DESIGN.md §14) */
const dd = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const NIGHTS: [string, string, string] = ['ночь', 'ночи', 'ночей'];

export function ReservationActions(props: {
  number: string;
  status: string;
  source: string;
  notes: string | null;
  arrivalDate: string;
  departureDate: string;
  /** Валюта брони — для сумм в окнах подтверждения */
  currency: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  items: Array<{
    id: string;
    status: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    unitCode: string | null;
    /** null — тариф неизвестен (перенесено из Exely): пересчёт цены без выбора тарифа невозможен */
    ratePlanCode: string | null;
    ratePlanName: string | null;
    adults: number;
    children: number;
    /** Остаток по счёту проживания — для окна «Выселить с долгом»; null — счёт не загрузился */
    debtMinor: string | null;
    availableGroups: Array<{ code: string; name: string; units: string[] }>;
  }>;
}) {
  // Как в API (changeDates): без явного выбора пересчёт идёт по тарифу первого неотменённого проживания (Б1)
  const current = props.items.find((it) => it.status !== 'CANCELLED' && it.ratePlanCode);
  const {
    state: cancelState,
    run: cancel,
    pending: cancelPending,
  } = useCommand<ActionResult>({ error: null });
  const { toast } = useToast();
  const [datesState, datesAction, datesPending] = useActionState<ActionResult, FormData>(
    changeDatesAction.bind(null, props.number),
    { error: null },
  );
  // Окно отмены (срез 7.3, Д5): штраф считает сервер тем же кодом, что и начисление; «Оставить» ничего не пишет
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null | undefined>(undefined);
  const openCancel = () => {
    setCancelPreview(undefined);
    setCancelOpen(true);
    void cancelPreviewAction(props.number, 'cancel').then(setCancelPreview);
  };
  const canEdit = OPEN.has(props.status);
  return (
    <section data-testid="reservation-actions" className="stack stack--mt">
      <EditForm number={props.number} source={props.source} notes={props.notes} />
      {canEdit && (
        // Поля неконтролируемые: defaultValue применяется только при монтировании, поэтому после
        // «Продлить на ночь» или переселения форма показывала бы прежние даты, а сохранение молча
        // укоротило бы проживание. Ключ по текущим датам отрисовывает поля заново.
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
              currency={props.currency}
              item={it}
              ratePlans={props.ratePlans}
            />
            <GuestsForm number={props.number} item={it} />
            <AssignForm
              number={props.number}
              currency={props.currency}
              item={it}
              arrivalDate={props.arrivalDate}
              ratePlans={props.ratePlans}
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
          {cancelState.error && <Alert>{cancelState.error}</Alert>}
          <ConfirmDialog
            open={cancelOpen}
            title={`Отменить бронь ${props.number}?`}
            confirmLabel="Отменить бронь"
            cancelLabel="Оставить"
            pending={cancelPending}
            onCancel={() => setCancelOpen(false)}
            onConfirm={async () => {
              await cancel(async () => {
                const r = await cancelReservationAction(props.number);
                if (!r.error) toast({ text: `Бронь ${props.number} отменена`, tone: 'success' });
                return r;
              });
              setCancelOpen(false);
            }}
          >
            <p>Место вернётся в продажу и уйдёт в каналы.</p>
            <p data-testid="cancel-penalty">
              {penaltyText(cancelPreview, 'cancel', props.currency)}
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
 * Заселить, выселить, продлить, незаезд. Суммы до подтверждения (срез 7.3, Д5) приходят с сервера
 * предпросмотром — тем же кодом, что потом пишет начисление; здесь только слова и окна.
 */
function StayButtons(props: {
  number: string;
  currency: string;
  item: {
    id: string;
    status: string;
    accommodationTypeName: string;
    departureDate: string;
    unitCode: string | null;
    ratePlanCode: string | null;
    debtMinor: string | null;
  };
  ratePlans: Array<{ code: string; name: string }>;
}) {
  const { state, run: command, pending } = useCommand<ActionResult>({ error: null });
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
  // Б8: у проживания без тарифа цену новой ночи взять не из чего — тариф выбирает администратор
  const [extendPlan, setExtendPlan] = useState('');
  const needsPlan = !props.item.ratePlanCode;
  const expected = props.item.status === 'CONFIRMED' || props.item.status === 'TENTATIVE';
  const live = expected || props.item.status === 'CHECKED_IN';

  // Продление: сумма и занятость следующей ночи известны до нажатия
  const [preview, setPreview] = useState<ExtendPreview | null | undefined>(undefined);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    setPreview(undefined);
    void extendPreviewAction(
      props.number,
      props.item.id,
      needsPlan ? extendPlan || undefined : undefined,
    ).then((p) => {
      if (alive) setPreview(p);
    });
    return () => {
      alive = false;
    };
  }, [
    props.number,
    props.item.id,
    props.item.departureDate,
    props.item.unitCode,
    needsPlan,
    extendPlan,
    live,
  ]);
  // без тарифа сервер называет и причину, и `ratePlanRequired`: администратору нужно второе — выбрать тариф
  const extendBlocked =
    !!preview && (!preview.nextNightsFree || (!!preview.problem && !preview.ratePlanRequired));
  const extendHint =
    preview === undefined
      ? 'Считаю сумму…'
      : preview === null
        ? 'Сумма не загрузилась — цена появится на счёте после продления'
        : !preview.nextNightsFree
          ? `${preview.unitCode ?? 'Ячейка'} занята ${dd(props.item.departureDate)} — сначала переселите`
          : preview.ratePlanRequired
            ? 'выберите тариф для новой ночи'
            : preview.problem
              ? preview.problem
              : `до ${dd(preview.departureDate)}${
                  preview.addedMinor
                    ? `, +${formatMoney(preview.addedMinor, props.currency)} на счёт`
                    : ''
                }`;
  const extend = async () => {
    const summary = await previewAction(props.number, props.item.id, {
      action: 'extend',
      nights: '1',
      ...(extendPlan ? { ratePlanCode: extendPlan } : {}),
    });
    if (
      !(await ask({
        title: `Продлить на ночь — ${props.item.accommodationTypeName}?`,
        body: previewLine(summary),
        confirmLabel: 'Продлить',
      }))
    )
      return;
    return command(async () => {
      const p = preview;
      const r = await extendStayAction(
        props.number,
        props.item.id,
        1,
        needsPlan ? extendPlan : undefined,
      );
      if (!r.error && p)
        setDone(
          `Проживание продлено до ${dd(p.departureDate)}${
            p.addedMinor ? `, +${formatMoney(p.addedMinor, props.currency)} на счёт` : ''
          }`,
        );
      return r;
    });
  };

  // Незаезд: окно со штрафом вместо window.confirm
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowPreview, setNoShowPreview] = useState<CancelPreview | null | undefined>(undefined);
  const openNoShow = () => {
    setNoShowPreview(undefined);
    setNoShowOpen(true);
    void cancelPreviewAction(props.number, 'no_show', props.item.id).then(setNoShowPreview);
  };

  // Выселение с долгом (T3): первое нажатие показывает сумму, второе — с подтверждением
  const [debt, setDebt] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });
  const checkOut = () =>
    command(async () => {
      const r = await stayAction(props.number, props.item.id, 'check-out');
      if (r.error && r.error.includes('долг')) {
        setDebt({ open: true, message: r.error });
        return { error: null };
      }
      // §8 «сделал — и что?»: карточка перерисовывается молча, уведомление называет итог и ячейку
      if (!r.error)
        toast({
          text: `Гость выселен, ${props.item.unitCode ?? '—'}`,
          tone: 'success',
        });
      return r;
    });

  return (
    <div className="panel">
      {dialog}
      <PanelTitle>
        {props.item.accommodationTypeName} — {props.item.unitCode ?? 'ячейка не назначена'}
      </PanelTitle>
      <Row>
        {expected && (
          <Button
            type="button"
            data-testid={`check-in-${props.item.id}`}
            onClick={() =>
              command(async () => {
                const r = await stayAction(props.number, props.item.id, 'check-in');
                if (!r.error)
                  toast({ text: `Гость заселён, ${props.item.unitCode ?? '—'}`, tone: 'success' });
                return r;
              })
            }
            disabled={pending || !props.item.unitCode}
            title={props.item.unitCode ? '' : 'Сначала назначьте ячейку'}
          >
            Заселить
          </Button>
        )}
        {props.item.status === 'CHECKED_IN' && (
          <Button
            type="button"
            data-testid={`check-out-${props.item.id}`}
            disabled={pending}
            onClick={checkOut}
          >
            Выселить
          </Button>
        )}
        {live && needsPlan && (
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
        {live && (
          <Button
            type="button"
            tone="info"
            data-testid={`extend-${props.item.id}`}
            disabled={pending || extendBlocked || (needsPlan && !extendPlan)}
            onClick={extend}
            title={
              needsPlan
                ? 'У проживания нет тарифа (перенесено из Exely): выберите тариф для новой ночи'
                : 'Выезд на сутки позже, цена по календарю'
            }
          >
            Продлить на ночь
          </Button>
        )}
        {live && (
          <span className="hint" data-testid={`hint-extend-${props.item.id}`}>
            {extendHint}
          </span>
        )}
        {expected && (
          <Button
            type="button"
            tone="warning"
            data-testid={`no-show-${props.item.id}`}
            disabled={pending}
            onClick={openNoShow}
          >
            Незаезд
          </Button>
        )}
      </Row>
      {done && (
        <Alert tone="success" data-testid={`done-extend-${props.item.id}`}>
          {done}
        </Alert>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <ConfirmDialog
        open={noShowOpen}
        title={`Отметить незаезд по ${props.item.unitCode ?? props.item.accommodationTypeName}?`}
        confirmLabel="Отметить незаезд"
        cancelLabel="Оставить"
        tone="warning"
        pending={pending}
        onCancel={() => setNoShowOpen(false)}
        onConfirm={async () => {
          await command(async () => {
            const r = await stayAction(props.number, props.item.id, 'no-show');
            if (!r.error)
              toast({
                text: `Незаезд отмечен, место ${props.item.unitCode ?? '—'} вернулось в продажу`,
                tone: 'success',
              });
            return r;
          });
          setNoShowOpen(false);
        }}
      >
        <p>Назначение ячейки снимется, место вернётся в продажу.</p>
        <p data-testid="no-show-penalty">{penaltyText(noShowPreview, 'no_show', props.currency)}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={debt.open}
        title="Выселить с долгом?"
        confirmLabel="Выселить с долгом"
        cancelLabel="Оставить"
        pending={pending}
        onCancel={() => setDebt({ open: false, message: '' })}
        onConfirm={async () => {
          await command(() => stayAction(props.number, props.item.id, 'check-out', true));
          setDebt({ open: false, message: '' });
        }}
      >
        <p data-testid="debt-amount">
          {props.item.debtMinor && BigInt(props.item.debtMinor) > 0n
            ? `Долг ${formatMoney(props.item.debtMinor, props.currency)} останется на счёте`
            : 'Долг останется на счёте'}
        </p>
        <p className="hint">{debt.message}</p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * Назначить или переселить. Ячейка своей категории — сразу; чужой — окно с новой суммой на весь
 * срок (срез 7.3, Д5): сумму считает сервер, форма отправляется только после «Переселить и пересчитать».
 */
function AssignForm(props: {
  number: string;
  currency: string;
  arrivalDate: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  item: {
    id: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    unitCode: string | null;
    availableGroups: Array<{ code: string; name: string; units: string[] }>;
  };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    assignUnitAction.bind(null, props.number, props.item.id),
    { error: null },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [move, setMove] = useState<{
    unitCode: string;
    groupName: string;
    preview: MovePreview | null | undefined;
  } | null>(null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    const fd = new FormData(e.currentTarget);
    const unitCode = String(fd.get('unitCode') ?? '');
    const ratePlanCode = String(fd.get('ratePlanCode') ?? '') || undefined;
    const group = props.item.availableGroups.find((g) => g.units.includes(unitCode));
    // своя категория: цена не меняется, окно не нужно
    if (!unitCode || !group || group.code === props.item.accommodationTypeCode) return;
    e.preventDefault();
    setMove({ unitCode, groupName: group.name, preview: undefined });
    void movePreviewAction(props.number, props.item.id, unitCode, ratePlanCode).then((p) =>
      setMove((m) => (m && m.unitCode === unitCode ? { ...m, preview: p } : m)),
    );
  };
  const confirmMove = () => {
    confirmed.current = true;
    setMove(null);
    formRef.current?.requestSubmit();
  };
  const lower = (s: string) => s.charAt(0).toLocaleLowerCase('ru') + s.slice(1);
  const moveText = !move
    ? ''
    : move.preview === undefined
      ? 'Считаю новую сумму…'
      : move.preview === null
        ? 'Сумма не загрузилась — цена пересчитается при переселении'
        : move.preview.ratePlanRequired
          ? 'Выберите тариф при смене категории: без него цену не посчитать'
          : move.preview.newMinor === null
            ? (move.preview.problem ?? 'Сумма не посчитана — цена пересчитается при переселении')
            : move.preview.problem
              ? move.preview.problem
              : `Новая сумма за ${pluralRu(move.preview.nights, NIGHTS)} ${formatMoney(
                  move.preview.newMinor,
                  props.currency,
                )} (было ${formatMoney(move.preview.currentMinor, props.currency)})`;
  return (
    <form
      key={`${props.item.unitCode ?? '-'}-${props.arrivalDate}-${state.attempt ?? 0}`}
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      className="panel"
      data-testid="assign-form"
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
        Ячейка другой категории пересчитает цену по её календарю; такое переселение возможно только
        на всё проживание целиком — сумму покажем до подтверждения.
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <ConfirmDialog
        open={!!move}
        title={
          move
            ? `Переселить в ${lower(move.preview?.toCategory?.name ?? move.groupName)} ${move.unitCode}?`
            : ''
        }
        confirmLabel="Переселить и пересчитать"
        tone="info"
        pending={pending}
        onCancel={() => setMove(null)}
        onConfirm={confirmMove}
      >
        <p>Счёт будет пересчитан по тарифу новой категории на весь срок проживания.</p>
        <p data-testid="move-amount">{moveText}</p>
      </ConfirmDialog>
    </form>
  );
}
