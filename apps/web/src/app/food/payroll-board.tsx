'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Stat,
  Stats,
  Table,
} from '../../components/ui';
import { Tabs } from '../../components/tabs';
import { Segmented } from '../../components/segmented';
import { wholeTenge } from '../../lib/dashboard-format';
import type { PayModel, PayrollRow, PayrollView } from '../../lib/food-types';
import { mutateStaff } from './restaurant-actions';

const MODEL_LABEL: Record<PayModel, string> = {
  FIXED: 'Оклад',
  PERCENT: 'Процент от заказов',
  FIXED_PLUS_PERCENT: 'Оклад + процент',
  BONUS_ONLY: 'Только премии',
};

function PayDrawer({
  scopeKey,
  row,
  close,
}: {
  scopeKey: string;
  row: PayrollRow;
  close: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [model, setModel] = useState<PayModel>(row.model);
  const [fixed, setFixed] = useState(String(BigInt(row.fixedMinor) / 100n));
  const [percent, setPercent] = useState(String(row.percent));
  function submit() {
    setError('');
    const fixedMinor = Math.round(Number(fixed)) * 100;
    const pct = Math.round(Number(percent));
    if (!Number.isFinite(fixedMinor) || fixedMinor < 0 || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('Оклад — целое число, процент 0..100');
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'pay-settings',
        id: row.employeeId,
        body: { model, fixedMinor, percent: pct },
      });
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay open onClose={close} title={`Оплата: ${row.name}`} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="pay-settings">
        {error && <Alert>{error}</Alert>}
        <Field label="Модель оплаты">
          <Select value={model} onChange={(e) => setModel(e.target.value as PayModel)}>
            {Object.entries(MODEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="food-form-row">
          <Field label="Оклад за месяц, ₸">
            <Input type="number" min={0} value={fixed} onChange={(e) => setFixed(e.target.value)} />
          </Field>
          <Field label="Процент от заказов">
            <Input
              type="number"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </Field>
        </div>
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

function AdjustmentDrawer({
  scopeKey,
  month,
  row,
  close,
}: {
  scopeKey: string;
  month: string;
  row: PayrollRow;
  close: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<'bonus' | 'penalty'>('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  function submit() {
    setError('');
    const tenge = Math.round(Number(amount));
    if (!Number.isFinite(tenge) || tenge <= 0 || !reason.trim()) {
      setError('Нужны сумма больше нуля и причина');
      return;
    }
    start(async () => {
      const result = await mutateStaff(scopeKey, {
        kind: 'adjustment',
        id: row.employeeId,
        body: {
          period: month,
          amountMinor: (kind === 'bonus' ? 1 : -1) * tenge * 100,
          reason: reason.trim(),
        },
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
      <div className="food-form" data-testid="pay-adjustment">
        {error && <Alert>{error}</Alert>}
        <Segmented
          label="Вид начисления"
          value={kind}
          options={[
            { value: 'bonus', label: 'Премия' },
            { value: 'penalty', label: 'Штраф' },
          ]}
          onChange={setKind}
        />
        <Field label="Сумма, ₸">
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
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

/** «Зарплата и финансы» по макету (ADR-159): фонд, премии, штрафы, к выплате; расчёт не хранится (§33.4) */
export function PayrollBoard({
  scopeKey,
  write,
  payroll,
}: {
  scopeKey: string;
  write: boolean;
  payroll: PayrollView;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<PayrollRow | null>(null);
  const [adjust, setAdjust] = useState<PayrollRow | null>(null);
  const names = new Map(payroll.rows.map((r) => [r.employeeId, r.name]));
  const staffTable = payroll.rows.length === 0 ? (
    <EmptyState title="Сотрудников пока нет" />
  ) : (
    <Table>
      <thead>
        <tr>
          {['Сотрудник', 'Модель', 'Ставка', 'Продажи', 'Премии', 'Штрафы', 'К выплате'].map(
            (h) => (
              <th key={h}>{h}</th>
            ),
          )}
          <th>
            <span className="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {payroll.rows.map((r) => (
          <tr key={r.employeeId}>
            <td>{r.name}</td>
            <td className="rest-pay-model">
              {MODEL_LABEL[r.model]}
              {r.percent > 0 && <small>{r.percent} % от заказов</small>}
            </td>
            <td>{wholeTenge(r.fixedMinor, payroll.currency)}</td>
            <td>{wholeTenge(r.salesMinor, payroll.currency)}</td>
            <td>{wholeTenge(r.bonusMinor, payroll.currency)}</td>
            <td>{wholeTenge(r.penaltyMinor, payroll.currency)}</td>
            <td>
              <strong>{wholeTenge(r.totalMinor, payroll.currency)}</strong>
            </td>
            <td>
              {write && (
                <span className="food-inline-actions">
                  <Button tone="ghost" onClick={() => setSettings(r)}>
                    Оплата
                  </Button>
                  <Button tone="ghost" onClick={() => setAdjust(r)}>
                    Начислить
                  </Button>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
  const adjustments =
    payroll.adjustments.length === 0 ? (
      <EmptyState title="Начислений в этом месяце нет" />
    ) : (
      <Table>
        <thead>
          <tr>
            {['Сотрудник', 'Сумма', 'Причина'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payroll.adjustments.map((a) => (
            <tr key={a.id}>
              <td>{names.get(a.employeeId) ?? '—'}</td>
              <td>{wholeTenge(a.amountMinor, payroll.currency)}</td>
              <td>{a.reason}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  return (
    <div className="food-workspace" data-testid="payroll-board">
      <div className="food-toolbar">
        <Field label="Месяц">
          <Input
            type="month"
            value={payroll.month}
            onChange={(e) => {
              if (e.target.value) router.push(`/payroll?month=${e.target.value}`);
            }}
          />
        </Field>
      </div>
      <Stats min={190}>
        <Stat
          label="Фонд ЗП"
          value={wholeTenge(payroll.totals.fundMinor, payroll.currency)}
          hint="оклады и проценты"
          testId="payroll-fund"
        />
        <Stat
          label="Премии"
          value={wholeTenge(payroll.totals.bonusMinor, payroll.currency)}
          tone="success"
          testId="payroll-bonus"
        />
        <Stat
          label="Штрафы"
          value={wholeTenge(payroll.totals.penaltyMinor, payroll.currency)}
          tone="danger"
          testId="payroll-penalty"
        />
        <Stat
          label="К выплате"
          value={wholeTenge(payroll.totals.payoutMinor, payroll.currency)}
          tone="info"
          testId="payroll-total"
        />
      </Stats>
      <Tabs
        label="Зарплата"
        panels={[
          { id: 'staff', label: 'Сотрудники', content: staffTable },
          { id: 'adjustments', label: 'Начисления', content: adjustments },
        ]}
      />
      {settings && <PayDrawer scopeKey={scopeKey} row={settings} close={() => setSettings(null)} />}
      {adjust && (
        <AdjustmentDrawer
          scopeKey={scopeKey}
          month={payroll.month}
          row={adjust}
          close={() => setAdjust(null)}
        />
      )}
    </div>
  );
}
