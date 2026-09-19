'use client';
import { useActionState, useState } from 'react';
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
import {
  assignUnitAction,
  extendStayAction,
  stayAction,
  cancelReservationAction,
  changeDatesAction,
  updateReservationAction,
  updateStayGuestsAction,
  type ActionResult,
} from '../actions';
import { SOURCES } from '../sources';
import { useConfirm } from '../../../components/use-confirm';
import { previewLine, sumPreviews } from '../../../lib/action-preview';
import { useToast } from '../../../components/toast';
import { displayDate } from '../../../lib/display-date';
import { previewAction } from '../actions';

const OPEN = new Set(['TENTATIVE', 'CONFIRMED']);

export function ReservationActions(props: {
  number: string;
  status: string;
  source: string;
  notes: string | null;
  arrivalDate: string;
  departureDate: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  items: Array<{
    id: string;
    status: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    unitCode: string | null;
    /** null — тариф неизвестен (перенесено из Exely): пересчёт цены без выбора тарифа невозможен */
    ratePlanCode: string | null;
    ratePlanName: string | null;
    adults: number;
    children: number;
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
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
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
        // «+ 1 ночь» или переселения форма показывала бы прежние даты, а сохранение молча укоротило
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
            <StayButtons number={props.number} item={it} ratePlans={props.ratePlans} />
            <GuestsForm number={props.number} item={it} />
            <AssignForm
              number={props.number}
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
              onClick={async () => {
                // Отменяются все живые проживания сразу — окно называет общую сумму (срез 7.3)
                const active = props.items.filter(
                  (it) => OPEN.has(it.status) || it.status === 'CHECKED_IN',
                );
                const previews = await Promise.all(
                  active.map((it) => previewAction(props.number, it.id, { action: 'cancel' })),
                );
                const ok = await ask({
                  title: `Отменить бронь ${props.number}?`,
                  body: `Проживания станут отменёнными, ячейки освободятся. ${previewLine(sumPreviews(previews))}`,
                  confirmLabel: 'Отменить бронь',
                });
                if (!ok) return;
                await cancel(async () => {
                  const r = await cancelReservationAction(props.number);
                  if (!r.error) toast({ text: `Бронь ${props.number} отменена`, tone: 'success' });
                  return r;
                });
              }}
            >
              Отменить бронь
            </Button>
          </div>
          {cancelState.error && <Alert>{cancelState.error}</Alert>}
        </div>
      )}
      {dialog}
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

function StayButtons(props: {
  number: string;
  item: {
    id: string;
    status: string;
    accommodationTypeName: string;
    unitCode: string | null;
    ratePlanCode: string | null;
  };
  ratePlans: Array<{ code: string; name: string }>;
}) {
  const { state, run: command, pending } = useCommand<ActionResult>({ error: null });
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
  // Б8: у проживания без тарифа цену новой ночи взять не из чего — тариф выбирает администратор
  const [extendPlan, setExtendPlan] = useState('');
  const needsPlan = !props.item.ratePlanCode;
  const run = (action: 'check-in' | 'check-out' | 'no-show') => async () => {
    if (action === 'no-show') {
      // Срез 7.3: штраф считает сервер теми же функциями, что и само действие, — окно называет число
      const preview = await previewAction(props.number, props.item.id, { action: 'no_show' });
      const ok = await ask({
        title: `Отметить незаезд — ${props.item.accommodationTypeName}?`,
        body: `Назначение ячейки ${props.item.unitCode ?? '—'} снимется, место вернётся в продажу. ${previewLine(preview)}`,
        confirmLabel: 'Отметить незаезд',
      });
      if (!ok) return;
    }
    await command(async () => {
      const r = await stayAction(props.number, props.item.id, action);
      // T3: выселение с долгом — показать сумму и переспросить, затем выселить с подтверждением
      if (action === 'check-out' && r.error && r.error.includes('долг')) {
        const ok = await ask({
          title: 'Выселить с долгом?',
          body: r.error,
          confirmLabel: 'Выселить с долгом',
        });
        if (ok) {
          const forced = await stayAction(props.number, props.item.id, action, true);
          if (!forced.error)
            toast({ text: `Выселен с долгом, ${props.item.unitCode ?? '—'}`, tone: 'warning' });
          return forced;
        }
      }
      // §8 «сделал — и что?»: карточка перерисовывается молча, уведомление называет итог и ячейку
      if (!r.error)
        toast({
          text:
            action === 'check-in'
              ? `Гость заселён, ${props.item.unitCode ?? '—'}`
              : action === 'check-out'
                ? `Гость выселен, ${props.item.unitCode ?? '—'}`
                : `Незаезд отмечен, место ${props.item.unitCode ?? '—'} вернулось в продажу`,
          tone: 'success',
        });
      return r;
    });
  };
  const expected = props.item.status === 'CONFIRMED' || props.item.status === 'TENTATIVE';
  return (
    <div className="panel">
      <PanelTitle>
        {props.item.accommodationTypeName} — {props.item.unitCode ?? 'ячейка не назначена'}
      </PanelTitle>
      <Row>
        {expected && (
          <Button
            type="button"
            data-testid={`check-in-${props.item.id}`}
            onClick={run('check-in')}
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
            onClick={run('check-out')}
          >
            Выселить
          </Button>
        )}
        {(expected || props.item.status === 'CHECKED_IN') && needsPlan && (
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
        {(expected || props.item.status === 'CHECKED_IN') && (
          <Button
            type="button"
            tone="info"
            data-testid={`extend-${props.item.id}`}
            disabled={pending || (needsPlan && !extendPlan)}
            onClick={async () => {
              // Продление добавляет деньги к счёту гостя — сумму называем до нажатия (срез 7.3)
              const plan = needsPlan ? extendPlan : undefined;
              const preview = await previewAction(props.number, props.item.id, {
                action: 'extend',
                nights: '1',
                ...(plan ? { ratePlanCode: plan } : {}),
              });
              const ok = await ask({
                title: `Продлить на ночь — ${props.item.accommodationTypeName}?`,
                body: previewLine(preview),
                confirmLabel: 'Продлить',
              });
              if (!ok) return;
              await command(async () => {
                const r = await extendStayAction(props.number, props.item.id, 1, plan);
                if (!r.error)
                  toast({
                    text: preview?.departureDate
                      ? `Продлено до ${displayDate(preview.departureDate)}`
                      : 'Продлено на ночь',
                    tone: 'success',
                  });
                return r;
              });
            }}
            title={
              needsPlan
                ? 'У проживания нет тарифа (перенесено из Exely): выберите тариф для новой ночи'
                : 'Выезд на сутки позже, цена пересчитается по календарю'
            }
          >
            + 1 ночь
          </Button>
        )}
        {expected && (
          <Button
            type="button"
            tone="warning"
            data-testid={`no-show-${props.item.id}`}
            disabled={pending}
            onClick={run('no-show')}
          >
            Незаезд
          </Button>
        )}
      </Row>
      {state.error && <Alert>{state.error}</Alert>}
      {dialog}
    </div>
  );
}

function AssignForm(props: {
  number: string;
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
  return (
    <form
      key={`${props.item.unitCode ?? '-'}-${props.arrivalDate}-${state.attempt ?? 0}`}
      action={action}
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
        на всё проживание целиком.
      </div>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}
