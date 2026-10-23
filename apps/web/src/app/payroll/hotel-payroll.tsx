'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, EmptyState, Field, Input, Select, Table } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { MonthInput } from '../../components/date-field';
import { Segmented } from '../../components/segmented';
import { currencySign, formatMoney } from '../../lib/money';
import type { PayModel } from '../../lib/food-types';
import type { HotelPayrollRow, HotelPayrollView } from '../../lib/hotel-staff-api';
import { payrollMinorToInput, payrollPositiveInputToMinor, payrollSalaryInputToMinor } from '../food/payroll-board';
import { hotelAdjustmentAction, hotelPaySettingsAction } from '../hotel-staff/actions';

/** У гостиницы процента нет: оклад, сдельно за уборки или только премии (решение 22.10.2026) */
const MODELS: Array<[PayModel, string]> = [
  ['FIXED', 'Оклад'],
  ['BONUS_ONLY', 'Без оклада'],
];
const modelLabel = (m: PayModel) => MODELS.find(([v]) => v === m)?.[1] ?? 'Оклад';

function PayDrawer({ scopeKey, row, currency, close }: { scopeKey: string; row: HotelPayrollRow; currency: string; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [model, setModel] = useState<PayModel>(row.model === 'BONUS_ONLY' ? 'BONUS_ONLY' : 'FIXED');
  const [fixed, setFixed] = useState(payrollMinorToInput(row.fixedMinor));
  const [piece, setPiece] = useState(payrollMinorToInput(row.perCleaningMinor));
  function submit() {
    setError('');
    let fixedMinor: number, perCleaningMinor: number;
    try {
      fixedMinor = model === 'FIXED' ? payrollSalaryInputToMinor(fixed, currency) : 0;
      perCleaningMinor = payrollSalaryInputToMinor(piece || '0', currency);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Некорректная сумма');
      return;
    }
    start(async () => {
      const result = await hotelPaySettingsAction(scopeKey, row.employeeId, { model, fixedMinor, percent: 0, perCleaningMinor });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={`Оплата: ${row.name}`} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="hotel-pay-settings">
        {error && <Alert>{error}</Alert>}
        <Field label="Оклад">
          <Select value={model} onChange={(e) => setModel(e.target.value as PayModel)}>
            {MODELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="food-form-row">
          {model === 'FIXED' && (
            <Field label={`Оклад за месяц, ${currencySign(currency)}`}>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </Field>
          )}
          <Field label={`За одну уборку, ${currencySign(currency)}`}>
            <Input name="perCleaning" type="number" inputMode="decimal" min={0} step="0.01" value={piece} onChange={(e) => setPiece(e.target.value)} />
          </Field>
        </div>
        <p className="hint">Уборка засчитывается, когда номер, где сотрудник «Кто убирает», отмечен «Убрано».</p>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            Сохранить
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            Отмена
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function AdjustmentDrawer({ scopeKey, month, currency, row, close }: { scopeKey: string; month: string; currency: string; row: HotelPayrollRow; close: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'bonus' | 'penalty'>('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  function submit() {
    setError('');
    let amountMinor: number;
    try {
      amountMinor = payrollPositiveInputToMinor(amount, currency);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Некорректная сумма');
      return;
    }
    if (!reason.trim()) {
      setError('Нужны сумма больше нуля и причина');
      return;
    }
    start(async () => {
      const result = await hotelAdjustmentAction(scopeKey, row.employeeId, {
        period: month,
        amountMinor: (kind === 'bonus' ? 1 : -1) * amountMinor,
        reason: reason.trim(),
      });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={`Начисление: ${row.name}`} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="hotel-pay-adjustment">
        {error && <Alert>{error}</Alert>}
        <Segmented
          label="Вид начисления"
          value={kind}
          options={[
            { value: 'bonus', label: 'Премия' },
            { value: 'penalty', label: 'Удержание' },
          ]}
          onChange={setKind}
        />
        <Field label={`Сумма, ${currencySign(currency)}`}>
          <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Причина">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            Начислить
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            Отмена
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

/**
 * «Зарплата» гостиницы (решение 22.10.2026): тот же расчёт, что у салона и ресторана; база гостиницы: оклад и уборки
 * сдельно. Выплаты из кассы у гостиницы пока нет, экран только начисляет; итоги одной строкой под таблицей.
 */
export function HotelPayrollBoard({ scopeKey, write, payroll }: { scopeKey: string; write: boolean; payroll: HotelPayrollView }) {
  const router = useRouter();
  const [settings, setSettings] = useState<HotelPayrollRow | null>(null);
  const [adjust, setAdjust] = useState<HotelPayrollRow | null>(null);
  const money = (minor: string) => formatMoney(minor, payroll.currency);
  const cleanings = payroll.rows.reduce((sum, r) => sum + r.cleanings, 0);
  return (
    <div className="food-workspace" data-testid="payroll-board">
      <div className="food-toolbar">
        <Field label="Месяц">
          <MonthInput
            value={payroll.month}
            onChange={(e) => {
              if (e.target.value) router.push(`/payroll?month=${e.target.value}`);
            }}
          />
        </Field>
      </div>
      <p className="hint" data-testid="hotel-payroll-note">
        Начисления за месяц. Выплату проведите в кассе объекта: выплата из этого экрана у гостиницы пока не подключена.
      </p>
      {payroll.rows.length === 0 ? (
        <EmptyState title="Сотрудников пока нет" details="Пригласите горничную или администратора в разделе «Персонал → Сотрудники»." />
      ) : (
        <Table>
          <thead>
            <tr>
              {['Сотрудник', 'Оплата', 'Уборок', 'За уборки', 'Премии', 'Удержания', 'Начислено'].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {payroll.rows.map((r) => (
              <tr key={r.employeeId} data-testid="hotel-payroll-row">
                <th scope="row">{r.name}</th>
                <td>
                  {modelLabel(r.model)}
                  {r.model === 'FIXED' && <small> {money(r.fixedMinor)}</small>}
                </td>
                <td>{r.cleanings}</td>
                <td>
                  {money(r.pieceMinor)}
                  {BigInt(r.perCleaningMinor) > 0n && <small> по {money(r.perCleaningMinor)}</small>}
                </td>
                <td>{money(r.bonusMinor)}</td>
                <td>{money(r.penaltyMinor)}</td>
                <td data-testid="payroll-remaining">
                  <strong>{money(r.totalMinor)}</strong>
                </td>
                <td>
                  {write && (
                    <ActionMenu
                      size="sm"
                      label={`Ещё: ${r.name}`}
                      items={[
                        { label: 'Условия оплаты', onSelect: () => setSettings(r) },
                        { label: 'Премия или удержание', onSelect: () => setAdjust(r) },
                      ]}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Итого</th>
              <td />
              <td>{cleanings}</td>
              <td />
              <td data-testid="payroll-bonus">{money(payroll.totals.bonusMinor)}</td>
              <td data-testid="payroll-penalty">{money(payroll.totals.penaltyMinor)}</td>
              <td data-testid="payroll-total">
                <strong>{money(payroll.totals.payoutMinor)}</strong>
              </td>
              <td />
            </tr>
          </tfoot>
        </Table>
      )}
      {settings && <PayDrawer scopeKey={scopeKey} row={settings} currency={payroll.currency} close={() => setSettings(null)} />}
      {adjust && <AdjustmentDrawer scopeKey={scopeKey} month={payroll.month} currency={payroll.currency} row={adjust} close={() => setAdjust(null)} />}
    </div>
  );
}
