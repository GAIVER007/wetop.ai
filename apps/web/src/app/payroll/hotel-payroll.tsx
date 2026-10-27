'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, EmptyState, Field, Input, Table } from '../../components/ui';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { Segmented } from '../../components/segmented';
import { currencySign, formatMoney } from '../../lib/money';
import type { PayModel } from '../../lib/food-types';
import type { HotelPayrollRow, HotelPayrollView } from '../../lib/hotel-staff-api';
import { payrollMinorToInput, payrollPositiveInputToMinor, payrollSalaryInputToMinor } from '../food/payroll-board';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
import { hotelAdjustmentAction, hotelPaySettingsAction } from '../hotel-staff/actions';

/** У гостиницы процента нет: оклад, сдельно за уборки или только премии (решение 22.10.2026) */
const MODELS: Array<[PayModel, string]> = [
  ['FIXED', msg('Оклад')],
  ['BONUS_ONLY', msg('Без оклада')],
];
const modelLabel = (m: PayModel) => MODELS.find(([v]) => v === m)?.[1] ?? msg('Оклад');
/** Строки способа в окне «Оплата» (вариант B, общий вид всех направлений 26.10.2026) */
const CHOICES = [
  { value: 'FIXED' as PayModel, title: msg('Оклад'), note: msg('Оклад в месяц плюс уборки'), icon: 'coins' as const },
  { value: 'BONUS_ONLY' as PayModel, title: msg('Без оклада'), note: msg('Только за уборки и премии'), icon: 'clean' as const },
];

export function HotelPayDrawer({ scopeKey, row, currency, close }: { scopeKey: string; row: HotelPayrollRow; currency: string; close: () => void }) {
  const t = useT();
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
      setError(cause instanceof Error ? t(cause.message) : t('Некорректная сумма'));
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
    <Overlay open onClose={close} title={t('Оплата: {name}', { name: row.name })} drawer className="food-drawer pay-drawer" trapFocus>
      <div className="food-form pay-form" data-testid="hotel-pay-settings">
        {error && <Alert>{error}</Alert>}
        <fieldset className="pay-choices">
          <legend>{t('Как платим')}</legend>
          {CHOICES.map((c) => (
            <label key={c.value} className="pay-choice">
              <input type="radio" name="hotel-pay-model" value={c.value} checked={model === c.value} onChange={() => setModel(c.value)} />
              <span className="pay-choice__icon" aria-hidden="true">
                <Icon name={c.icon} width={20} />
              </span>
              <span className="pay-choice__text">
                <span className="pay-choice__title">{t(c.title)}</span>
                <span className="pay-choice__note">{t(c.note)}</span>
              </span>
              <span className="pay-choice__mark" aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        <div className="pay-fields">
          {model === 'FIXED' && (
            <Field label={t('Оклад в месяц')} controlId={`hotel-pay-fixed-${row.employeeId}`}>
              <span className="pay-input" id={`hotel-pay-fixed-${row.employeeId}-box`}>
                <Input id={`hotel-pay-fixed-${row.employeeId}`} type="number" inputMode="decimal" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
                <span className="pay-unit">{currencySign(currency)}</span>
              </span>
            </Field>
          )}
          <Field label={t('За одну уборку')} controlId={`hotel-pay-piece-${row.employeeId}`}>
            <span className="pay-input" id={`hotel-pay-piece-${row.employeeId}-box`}>
              <Input id={`hotel-pay-piece-${row.employeeId}`} name="perCleaning" type="number" inputMode="decimal" min={0} step="0.01" value={piece} onChange={(e) => setPiece(e.target.value)} />
              <span className="pay-unit">{currencySign(currency)}</span>
            </span>
          </Field>
        </div>
        <p className="hint">{t('Уборка засчитывается, когда номер, где сотрудник «Кто убирает», отмечен «Убрано».')}</p>
        <div className="food-actions pay-form__actions">
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
          </Button>
          <Button disabled={pending} onClick={submit}>
            {t('Сохранить')}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

function AdjustmentDrawer({ scopeKey, month, currency, row, close }: { scopeKey: string; month: string; currency: string; row: HotelPayrollRow; close: () => void }) {
  const t = useT();
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
      setError(cause instanceof Error ? t(cause.message) : t('Некорректная сумма'));
      return;
    }
    if (!reason.trim()) {
      setError(t('Нужны сумма больше нуля и причина'));
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
    <Overlay open onClose={close} title={t('Начисление: {name}', { name: row.name })} drawer className="food-drawer" trapFocus>
      <div className="food-form" data-testid="hotel-pay-adjustment">
        {error && <Alert>{error}</Alert>}
        <Segmented
          label={t('Вид начисления')}
          value={kind}
          options={[
            { value: 'bonus', label: t('Премия') },
            { value: 'penalty', label: t('Удержание') },
          ]}
          onChange={setKind}
        />
        <Field label={t('Сумма, {currency}', { currency: currencySign(currency) })}>
          <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('Причина')}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            {t('Начислить')}
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            {t('Отмена')}
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
  const t = useT();
  const [settings, setSettings] = useState<HotelPayrollRow | null>(null);
  const [adjust, setAdjust] = useState<HotelPayrollRow | null>(null);
  const money = (minor: string) => formatMoney(minor, payroll.currency);
  const cleanings = payroll.rows.reduce((sum, r) => sum + r.cleanings, 0);
  return (
    <div className="food-workspace" data-testid="payroll-board">
      <p className="hint" data-testid="hotel-payroll-note">
        {t('Начисления за месяц. Выплату проведите в кассе объекта: выплата из этого экрана у гостиницы пока не подключена.')}
      </p>
      {payroll.rows.length === 0 ? (
        <EmptyState title={t('Сотрудников пока нет')} details={t('Пригласите горничную или администратора в разделе «Персонал → Сотрудники».')} />
      ) : (
        <Table>
          <thead>
            <tr>
              {['Сотрудник', 'Уборок', 'За уборки', 'Модель', 'Премии', 'Удержания', 'Начислено'].map((h) => ( // kk-allow: payroll-wording.test.ts сверяет эту строку исходника, перевод t(h) при показе
                <th key={h} scope="col">
                  {t(h)}
                </th>
              ))}
              <th scope="col">
                <span className="sr-only">{t('Действия')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {payroll.rows.map((r) => (
              <tr key={r.employeeId} data-testid="hotel-payroll-row">
                <th scope="row">{r.name}</th>
                {/* база оплаты первой (владелец 26.10.2026, как «Доход» салона и ресторана): уборки и сумма за них */}
                <td>{r.cleanings}</td>
                <td data-testid="payroll-piece">
                  <strong>{money(r.pieceMinor)}</strong>
                  {BigInt(r.perCleaningMinor) > 0n && <small> {t('по {amount}', { amount: money(r.perCleaningMinor) })}</small>}
                </td>
                <td>
                  {t(modelLabel(r.model))}
                  {r.model === 'FIXED' && <small> {money(r.fixedMinor)}</small>}
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
                      label={t('Ещё: {name}', { name: r.name })}
                      items={[
                        { label: t('Условия оплаты'), onSelect: () => setSettings(r) },
                        { label: t('Премия или удержание'), onSelect: () => setAdjust(r) },
                      ]}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('Итого')}</th>
              <td>{cleanings}</td>
              <td data-testid="payroll-piece-total">
                <strong>{money(payroll.rows.reduce((sum, r) => sum + BigInt(r.pieceMinor), 0n).toString())}</strong>
              </td>
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
      {settings && <HotelPayDrawer scopeKey={scopeKey} row={settings} currency={payroll.currency} close={() => setSettings(null)} />}
      {adjust && <AdjustmentDrawer scopeKey={scopeKey} month={payroll.month} currency={payroll.currency} row={adjust} close={() => setAdjust(null)} />}
    </div>
  );
}
