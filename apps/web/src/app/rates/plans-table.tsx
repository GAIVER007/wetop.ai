'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { CancellationPenaltyPolicy } from '@pms/domain';
import type { RatePlanRow } from '../../lib/api';
import { cancellationRuleLabel, cancellationRuleOptions } from '../../lib/penalty-text';
import { pluralRu } from '../../lib/plural';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Table } from '../../components/ui';
import { derivedRuleText } from '../../lib/rate-rule-text';
import { DerivedForm } from './derived-form';
import { saveRatePlanPenalty, setDerivedPlanActive, type RatePlanActionResult } from './actions';
import '../inventory/fund.css';

/**
 * «Тарифные планы» (SET4, дополнение 29.09 к ADR-115): тарифы объекта с правилом отмены словами; коды тарифов не
 * видны. Правило правят владелец и управляющий панелью справа; оно действует и для уже принятых броней (решение
 * владельца 29.09), поэтому панель называет, сколько будущих броней правка заденет. Без права записи или в «только
 * чтении» — таблица без кнопок.
 */
export function RatePlansTable({ plans, editable }: { plans: RatePlanRow[]; editable: boolean }) {
  const [editing, setEditing] = useState<RatePlanRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // родитель — обычный действующий тариф: производный от производного запрещён
  const parents = plans.filter((p) => !p.derived && p.active);
  return (
    <section className="settings-catalog rates-plans" aria-label="Тарифные планы">
      <span
        className="settings-save-state settings-save-state--saved"
        role="status"
        data-testid="rate-plan-saved"
      >
        {saved ? `✓ ${saved}` : ''}
      </span>
      {editable && parents.length > 0 && (
        <div className="rates-toolbar">
          <Button
            type="button"
            onClick={() => {
              setSaved(null);
              setCreating(true);
            }}
          >
            <Icon name="plus" />
            Добавить производный тариф
          </Button>
        </div>
      )}
      <Table data-testid="rate-plans-table" className="settings-table">
        <thead>
          <tr>
            <th>Тариф</th>
            <th className="settings-col-wide">Категории</th>
            <th className="settings-col-wide">Условия</th>
            <th>Правило отмены</th>
            <th className="num settings-col-wide">Брони впереди</th>
            <th className="settings-col-wide">Статус</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.code}>
              <td>
                {editable ? (
                  <button
                    type="button"
                    className="settings-service-name"
                    onClick={() => {
                      setSaved(null);
                      setEditing(p);
                    }}
                  >
                    {p.name}
                  </button>
                ) : (
                  p.name
                )}
                {/* на телефоне категории и статус скрыты — то же строкой под названием */}
                <span className="cell-sub rates-plans-sub">
                  {p.categories.length ? p.categories.join(', ') : 'Без категорий'}
                  {!p.active && <Badge tone="neutral">не действует</Badge>}
                </span>
                {p.derived && (
                  <span className="cell-sub rates-plans-sub rates-plans-rule">
                    {derivedRuleText(p.derived)}
                  </span>
                )}
              </td>
              <td className="settings-col-wide">
                {p.categories.length ? p.categories.join(', ') : '—'}
              </td>
              <td className="settings-col-wide">{p.derived ? derivedRuleText(p.derived) : '—'}</td>
              <td>{cancellationRuleLabel(p.cancellationPenalty)}</td>
              <td className="num settings-col-wide">{p.upcomingReservations}</td>
              <td className="settings-col-wide">
                <Badge tone={p.active ? 'ok' : 'neutral'}>
                  {p.active ? 'действует' : 'не действует'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={editing.name}
          onClose={() => setEditing(null)}
        >
          {editing.derived && (
            <DerivedForm
              key={`derived-${editing.code}`}
              plan={editing}
              parents={parents}
              onCancel={() => setEditing(null)}
              onSaved={(text) => {
                setSaved(text);
                setEditing(null);
              }}
            />
          )}
          <PenaltyForm
            key={editing.code}
            plan={editing}
            onCancel={() => setEditing(null)}
            onSaved={(text) => {
              setSaved(text);
              setEditing(null);
            }}
          />
          {editing.derived && (
            <RatePlanActiveForm
              plan={editing}
              onSaved={(text) => {
                setSaved(text);
                setEditing(null);
              }}
            />
          )}
        </Overlay>
      )}
      {creating && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title="Новый производный тариф"
          onClose={() => setCreating(false)}
        >
          <DerivedForm
            parents={parents}
            onCancel={() => setCreating(false)}
            onSaved={(text) => {
              setSaved(text);
              setCreating(false);
            }}
          />
        </Overlay>
      )}
    </section>
  );
}

function RatePlanActiveForm({
  plan,
  onSaved,
}: {
  plan: RatePlanRow;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState(setDerivedPlanActive, null);
  useEffect(() => {
    if (state?.saved) onSaved(state.saved.active ? 'Тариф включён' : 'Тариф отключён');
  }, [state, onSaved]);
  return (
    <form action={action} className="stack stack--sm">
      <input type="hidden" name="code" value={plan.code} />
      <input type="hidden" name="active" value={String(!plan.active)} />
      <p className="note">
        Отключённый тариф нельзя выбрать для новой брони. История сохраняется. При отключении
        проверяются действующие брони и сопоставления каналов.
      </p>
      {state?.error && (
        <Alert boxed tone="warning">
          {state.error}
        </Alert>
      )}
      <Button type="submit" tone="secondary" disabled={pending}>
        {pending ? 'Сохранение…' : plan.active ? 'Отключить тариф' : 'Включить тариф'}
      </Button>
    </form>
  );
}

function PenaltyForm({
  plan,
  onCancel,
  onSaved,
}: {
  plan: RatePlanRow;
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState<RatePlanActionResult | null, FormData>(
    saveRatePlanPenalty,
    null,
  );
  const [choice, setChoice] = useState<CancellationPenaltyPolicy>(plan.cancellationPenalty);
  // ответ приходит один раз, а родитель перерисовывается и после revalidatePath — об успехе сообщаем ровно раз
  const reported = useRef<RatePlanActionResult | null>(null);
  useEffect(() => {
    if (!state?.saved || reported.current === state) return;
    reported.current = state;
    onSaved(`Правило тарифа «${state.saved.name}» сохранено`);
  }, [state, onSaved]);
  const n = plan.upcomingReservations;
  return (
    <form action={action} className="settings-service-form" data-testid="rate-plan-form">
      <input type="hidden" name="code" value={plan.code} />
      {state?.error && <Alert boxed>{state.error}</Alert>}
      <fieldset className="fund-choice">
        <legend>Правило отмены</legend>
        {cancellationRuleOptions.map((o) => (
          <label key={o.value} className="fund-choice__option">
            <input
              type="radio"
              name="cancellationPenalty"
              value={o.value}
              checked={choice === o.value}
              onChange={() => setChoice(o.value)}
            />
            <span>
              {o.label}
              <small>{o.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="settings-note">
        Отмена заранее бесплатна при любом правиле: штраф считается только при отмене в день заезда
        и при незаезде.
      </p>
      {n > 0 ? (
        <Alert tone="warning" data-testid="rate-plan-affected">
          Правило действует и для уже принятых броней: по тарифу{' '}
          {pluralRu(n, ['будущая бронь', 'будущие брони', 'будущих броней'])}.
        </Alert>
      ) : (
        <p className="settings-note" data-testid="rate-plan-affected">
          Будущих броней по тарифу нет — правило коснётся новых.
        </p>
      )}
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="submit"
          disabled={pending || choice === plan.cancellationPenalty}
          aria-busy={pending}
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
