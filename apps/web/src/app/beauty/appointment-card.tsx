'use client';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { METHOD_RU } from '../../lib/dashboard-format';
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../../lib/food-types';
import { moveAppointment, payAppointment, setAppointmentStatus } from './journal-actions';
import { clock, instantOf, localInput } from './time';
import { ACTION_WORD } from './appointment-status';
import { beautyStatus } from '../../lib/status/beauty';

export function AppointmentCard({
  day,
  row,
  canEdit,
  onDone,
}: {
  day: BeautyDay;
  row: BeautyAppointmentRow;
  canEdit: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(moveAppointment, null);
  const { ask, dialog } = useConfirm();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const master = day.columns.find((c) => c.id === row.employeeId);
  // поле datetime-local показывает местное время филиала, а на сервер уходит момент: без перевода
  // «13:00» уехало бы в часовом поясе того, кто открыл страницу
  const [localStart, setLocalStart] = useState(() =>
    localInput(row.startsAt, day.location.timezone),
  );
  const moved = Boolean(state?.message) && !state?.error;
  // оплата в кассу филиала (§49): у отменённой и незаезда не принимается
  const remaining = BigInt(row.priceMinor) - BigInt(row.paidMinor);
  const payable = canEdit && row.status !== 'CANCELLED' && row.status !== 'NO_SHOW' && remaining > 0n;
  const [method, setMethod] = useState<FoodPaymentMethod>('CASH');
  const [amount, setAmount] = useState(() => String(remaining / 100n));
  const pay = () => {
    const tenge = Number(amount);
    if (!Number.isInteger(tenge) || tenge <= 0) return setError('Сумма в тенге, целое число больше нуля');
    startTransition(async () => {
      const result = await payAppointment(row.id, method, tenge * 100, crypto.randomUUID());
      if (result.error) setError(result.error);
      else onDone();
    });
  };
  useEffect(() => {
    if (moved) onDone();
  }, [moved, onDone]);

  const change = async (status: BeautyAppointmentRow['status']) => {
    if (status === 'CANCELLED') {
      const ok = await ask({
        title: `Отменить запись: ${row.customer.name}, ${clock(row.startMinutes)}?`,
        body: 'Время мастера освободится.',
        confirmLabel: 'Отменить запись',
        tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await setAppointmentStatus(row.id, status);
      if (result.error) setError(result.error);
      else onDone();
    });
  };

  return (
    <div className="beauty-form">
      <dl className="beauty-facts">
        <div>
          <dt>Клиент</dt>
          <dd>
            {row.customer.name}
            {row.customer.phone ? `, ${row.customer.phone}` : ''}
          </dd>
        </div>
        <div>
          <dt>Услуга</dt>
          <dd>{row.serviceName}</dd>
        </div>
        <div>
          <dt>Мастер</dt>
          <dd>{master?.name ?? 'не найден'}</dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>
            {day.date}, {clock(row.startMinutes)} до {clock(row.endMinutes)}
          </dd>
        </div>
        <div>
          <dt>Цена</dt>
          <dd>{formatMoney(row.priceMinor, row.currency)}</dd>
        </div>
        <div>
          <dt>Оплачено</dt>
          <dd data-testid="beauty-card-paid">
            {formatMoney(row.paidMinor, row.currency)} из {formatMoney(row.priceMinor, row.currency)}
          </dd>
        </div>
        <div>
          <dt>Состояние</dt>
          <dd data-testid="beauty-card-status">{beautyStatus[row.status].label}</dd>
        </div>
        {row.notes && (
          <div>
            <dt>Заметка</dt>
            <dd>{row.notes}</dd>
          </div>
        )}
      </dl>

      {canEdit && row.next.length > 0 && (
        <div className="beauty-bar">
          {row.next.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              tone={status === 'CANCELLED' ? 'danger' : 'secondary'}
              disabled={busy}
              onClick={() => void change(status)}
            >
              {ACTION_WORD[status]}
            </Button>
          ))}
        </div>
      )}

      {payable && (
        <section className="beauty-form" aria-label="Оплата записи">
          <h3>Оплата</h3>
          <Field label="Способ">
            <Select value={method} onChange={(e) => setMethod(e.target.value as FoodPaymentMethod)}>
              {FOOD_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_RU[m] ?? m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сумма, ₸">
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Button type="button" disabled={busy} onClick={pay}>
            Принять оплату
          </Button>
          {BigInt(row.paidMinor) > 0n && <p className="muted">Аннулировать оплату можно в «Кассе».</p>}
        </section>
      )}

      {canEdit && row.next.length > 0 && (
        <form action={action} className="beauty-form">
          <input type="hidden" name="id" value={row.id} />
          <h3>Перенести</h3>
          <Field label="Мастер">
            <Select name="employeeId" defaultValue={row.employeeId}>
              {day.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Начало">
            <Input
              type="datetime-local"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              data-testid="beauty-move-start"
            />
          </Field>
          <input
            type="hidden"
            name="startsAt"
            value={instantOf(localStart, day.location.timezone)}
          />
          {state?.error && <Alert>{state.error}</Alert>}
          <Button type="submit" tone="secondary" disabled={pending}>
            {pending ? 'Переносим…' : 'Перенести'}
          </Button>
        </form>
      )}

      {error && <Alert>{error}</Alert>}
      {state?.message && !state.error && <p role="status">{state.message}</p>}
      {dialog}
    </div>
  );
}
