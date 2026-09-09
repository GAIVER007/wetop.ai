'use client';
import { useActionState, useState } from 'react';
import {
  assignUnitAction,
  stayAction,
  cancelReservationAction,
  changeDatesAction,
  type ActionResult,
} from '../actions';

const OPEN = new Set(['TENTATIVE', 'CONFIRMED']);

export function ReservationActions(props: {
  number: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  ratePlans: Array<{ code: string; name: string; currency: string }>;
  items: Array<{
    id: string;
    status: string;
    accommodationTypeName: string;
    unitCode: string | null;
    availableUnitCodes: string[];
  }>;
}) {
  const [cancelState, setCancelState] = useState<ActionResult>({ error: null });
  const [datesState, datesAction, datesPending] = useActionState<ActionResult, FormData>(
    changeDatesAction.bind(null, props.number),
    { error: null },
  );
  const canEdit = OPEN.has(props.status);
  return (
    <section data-testid="reservation-actions" style={{ marginTop: 20, display: 'grid', gap: 14 }}>
      {canEdit && (
        <form action={datesAction} style={box}>
          <b style={{ fontSize: 14 }}>Изменить даты</b>
          <div style={row}>
            <input type="date" name="arrivalDate" defaultValue={props.arrivalDate} style={inp} />
            <input
              type="date"
              name="departureDate"
              defaultValue={props.departureDate}
              style={inp}
            />
            <select name="ratePlanCode" style={inp}>
              {props.ratePlans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={datesPending} style={btn}>
              Пересчитать и сохранить
            </button>
          </div>
          {datesState.error && (
            <div role="alert" style={err}>
              {datesState.error}
            </div>
          )}
        </form>
      )}
      {props.items
        .filter(
          (it) =>
            it.status !== 'CANCELLED' && it.status !== 'CHECKED_OUT' && it.status !== 'NO_SHOW',
        )
        .map((it) => (
          <div key={it.id} style={{ display: 'grid', gap: 8 }}>
            <StayButtons number={props.number} item={it} />
            {it.status !== 'CHECKED_IN' && (
              <AssignForm number={props.number} item={it} arrivalDate={props.arrivalDate} />
            )}
            {it.status === 'CHECKED_IN' && (
              <AssignForm number={props.number} item={it} arrivalDate={props.arrivalDate} />
            )}
          </div>
        ))}
      {canEdit && (
        <form
          action={async () => {
            if (!window.confirm('Отменить бронь? Ячейки освободятся.')) return;
            setCancelState(await cancelReservationAction(props.number));
          }}
          style={box}
        >
          <button
            type="submit"
            data-testid="cancel-reservation"
            style={{ ...btn, background: '#b91c1c' }}
          >
            Отменить бронь
          </button>
          {cancelState.error && (
            <div role="alert" style={err}>
              {cancelState.error}
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function StayButtons(props: {
  number: string;
  item: { id: string; status: string; accommodationTypeName: string; unitCode: string | null };
}) {
  const [state, setState] = useState<ActionResult>({ error: null });
  const run = (action: 'check-in' | 'check-out' | 'no-show') => async () => {
    if (action === 'no-show' && !window.confirm('Отметить незаезд? Назначение ячейки снимется.'))
      return;
    setState(await stayAction(props.number, props.item.id, action));
  };
  const expected = props.item.status === 'CONFIRMED' || props.item.status === 'TENTATIVE';
  return (
    <div style={box}>
      <b style={{ fontSize: 14 }}>
        {props.item.accommodationTypeName} — {props.item.unitCode ?? 'ячейка не назначена'}
      </b>
      <div style={row}>
        {expected && (
          <button
            type="button"
            data-testid={`check-in-${props.item.id}`}
            onClick={run('check-in')}
            disabled={!props.item.unitCode}
            title={props.item.unitCode ? '' : 'Сначала назначьте ячейку'}
            style={btn}
          >
            Заселить
          </button>
        )}
        {props.item.status === 'CHECKED_IN' && (
          <button
            type="button"
            data-testid={`check-out-${props.item.id}`}
            onClick={run('check-out')}
            style={btn}
          >
            Выселить
          </button>
        )}
        {expected && (
          <button
            type="button"
            data-testid={`no-show-${props.item.id}`}
            onClick={run('no-show')}
            style={{ ...btn, background: '#b45309' }}
          >
            Незаезд
          </button>
        )}
      </div>
      {state.error && (
        <div role="alert" style={err}>
          {state.error}
        </div>
      )}
    </div>
  );
}

function AssignForm(props: {
  number: string;
  arrivalDate: string;
  item: {
    id: string;
    accommodationTypeName: string;
    unitCode: string | null;
    availableUnitCodes: string[];
  };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    assignUnitAction.bind(null, props.number, props.item.id),
    { error: null },
  );
  return (
    <form action={action} style={box} data-testid="assign-form">
      <b style={{ fontSize: 14 }}>
        {props.item.unitCode ? `Переселить из ${props.item.unitCode}` : 'Назначить ячейку'} —{' '}
        {props.item.accommodationTypeName}
      </b>
      <div style={row}>
        <select name="unitCode" required defaultValue="" style={inp}>
          <option value="" disabled>
            — свободная ячейка —
          </option>
          {props.item.availableUnitCodes.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <label
          style={{ fontSize: 12, color: '#555', display: 'flex', gap: 6, alignItems: 'center' }}
        >
          с даты
          <input type="date" name="fromDate" defaultValue={props.arrivalDate} style={inp} />
        </label>
        <button type="submit" disabled={pending} style={btn}>
          {props.item.unitCode ? 'Переселить' : 'Назначить'}
        </button>
      </div>
      {state.error && (
        <div role="alert" style={err}>
          {state.error}
        </div>
      )}
    </form>
  );
}
const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: 12,
  display: 'grid',
  gap: 8,
};
const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '7px 12px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const err: React.CSSProperties = { color: '#b91c1c', fontSize: 13 };
