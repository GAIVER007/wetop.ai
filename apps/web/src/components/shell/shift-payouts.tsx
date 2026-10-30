'use client';
import { useEffect, useState, useTransition } from 'react';
import { Button, Table } from '../ui';
import { mutateStaff } from '../../app/food/restaurant-actions';
import type { FoodPaymentMethod, PayFrequency } from '../../lib/food-types';
import { useT } from '../../i18n/locale-provider';

/** Ответ GET /food-service/payroll/day (PAYROLL-DAILY-20261030) */
export interface PayrollDayView {
  date: string;
  currency: string;
  payouts: boolean;
  totals: { accruedMinor: string; paidMinor: string; remainingMinor: string };
  rows: Array<{
    employeeId: string;
    name: string;
    status: string;
    payFrequency: PayFrequency;
    payWeekday: number | null;
    payMethod: FoodPaymentMethod | null;
    salesMinor: string;
    clients: number;
    percent: number;
    accruedMinor: string;
    paidMinor: string;
    remainingMinor: string;
    due: boolean;
  }>;
}
export type ShiftPayoutRow = PayrollDayView['rows'][number] & { state: 'due' | 'paid' };

/**
 * Кто в окне закрытия смены (владелец 30.10.2026): сегодня день выплаты (ежедневная всегда, недельная в свой день,
 * месячная и оклад никогда) и за день что-то начислено. Нет таких: раздела нет совсем.
 */
export function shiftPayoutRows(v: PayrollDayView): ShiftPayoutRow[] {
  if (!v.payouts) return [];
  return v.rows
    .filter((r) => r.due && r.payFrequency !== 'MONTHLY' && BigInt(r.accruedMinor) > 0n)
    .map((r) => ({ ...r, state: BigInt(r.remainingMinor) > 0n ? 'due' : 'paid' }));
}

async function loadDay(scopeKey: string): Promise<PayrollDayView | null> {
  const response = await fetch(`/api/payroll-day?scope=${encodeURIComponent(scopeKey)}`, { cache: 'no-store' });
  // нет права «Зарплата» или старый API: окно закрытия работает как раньше, без раздела
  if (!response.ok) return null;
  return (await response.json()) as PayrollDayView;
}

/**
 * Раздел «Выплаты мастерам» окна «Закрыть смену», вариант A: клиенты, выручка, процент, к выплате, кнопки
 * «Выплатить» и «Не забрал». Выплата идёт тем же расходом кассы, что и в «Зарплате» (§35.3), с днём выплаты.
 * «Не забрал» ничего не пишет: сумма остаётся к выплате и копится в «Зарплате» мастера.
 */
export function ShiftPayouts({
  scopeKey,
  money,
  disabled,
  onPaid,
  onLeft,
}: {
  scopeKey: string;
  money: (minor: string) => string;
  disabled: boolean;
  /** касса изменилась: окно закрытия перечитывает «должно быть в кассе» */
  onPaid: () => void;
  /** кто сегодня не забрал: строка в окне закрытия */
  onLeft: (rows: Array<{ name: string; amountMinor: string }>) => void;
}) {
  const t = useT();
  const [day, setDay] = useState<PayrollDayView | null>(null);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [keys] = useState(() => new Map<string, string>());
  useEffect(() => {
    let live = true;
    loadDay(scopeKey).then((d) => live && setDay(d)).catch(() => live && setDay(null));
    return () => {
      live = false;
    };
  }, [scopeKey]);
  const rows = day ? shiftPayoutRows(day) : [];
  // кто ещё не получил деньги сегодня: строка «Не забрали» внизу окна закрытия
  const unpaid = rows.filter((r) => r.state === 'due').map((r) => `${r.name}\u0000${r.remainingMinor}`).join('\u0001');
  useEffect(() => {
    onLeft(unpaid ? unpaid.split('\u0001').map((x) => { const [name, amountMinor] = x.split('\u0000'); return { name: name!, amountMinor: amountMinor! }; }) : []);
  }, [unpaid, onLeft]);
  if (!day || rows.length === 0) return null;
  function pay(r: ShiftPayoutRow) {
    setError('');
    // одно нажатие одной выплаты: повтор после сбоя сети идёт с тем же ключом
    const key = keys.get(r.employeeId) ?? crypto.randomUUID();
    keys.set(r.employeeId, key);
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'payout',
        id: r.employeeId,
        body: {
          period: day!.date.slice(0, 7),
          payDate: day!.date,
          method: r.payMethod ?? 'CASH',
          amount: Number(r.remainingMinor),
          idempotencyKey: key,
        },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      keys.delete(r.employeeId);
      setLeft((s) => {
        const n = new Set(s);
        n.delete(r.employeeId);
        return n;
      });
      setDay(await loadDay(scopeKey));
      onPaid();
    });
  }
  return (
    <section className="cash-header__summary" data-testid="shift-payouts" aria-label={t('Выплаты мастерам')}>
      <h3>{t('Выплаты мастерам')}</h3>
      {error && (
        <p role="alert" className="cash-shift-diff" data-tone="short">
          {error}
        </p>
      )}
      <Table className="payroll-table">
        <thead>
          <tr>
            <th>{t('Мастер')}</th>
            <th className="num">{t('Клиенты')}</th>
            <th className="num">{t('Выручка')}</th>
            <th className="num">{t('Процент')}</th>
            <th className="num">{t('К выплате')}</th>
            <th>
              <span className="sr-only">{t('Действия')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employeeId} data-testid="shift-payout-row">
              <th scope="row">{r.name}</th>
              <td className="num">{r.clients}</td>
              <td className="num">{money(r.salesMinor)}</td>
              <td className="num">{r.percent ? `${r.percent} %` : <span className="muted">—</span>}</td>
              <td className="num">
                <strong>{money(r.remainingMinor)}</strong>
              </td>
              <td>
                {r.state === 'paid' ? (
                  <span className="payroll-done">{t('Выплачено')}</span>
                ) : left.has(r.employeeId) ? (
                  <span className="food-inline-actions">
                    <span className="payroll-due">{t('Не забрал')}</span>
                    <Button size="sm" tone="secondary" disabled={pending || disabled} onClick={() => pay(r)}>
                      {t('Выплатить')}
                    </Button>
                  </span>
                ) : (
                  <span className="food-inline-actions">
                    <Button size="sm" disabled={pending || disabled} onClick={() => pay(r)}>
                      {t('Выплатить {sum}', { sum: money(r.remainingMinor) })}
                    </Button>
                    <Button
                      size="sm"
                      tone="secondary"
                      disabled={pending}
                      onClick={() => setLeft((s) => new Set(s).add(r.employeeId))}
                    >
                      {t('Не забрал')}
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
