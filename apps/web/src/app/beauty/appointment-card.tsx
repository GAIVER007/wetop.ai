'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import { formatMoney, inputToMinor, minorToInput } from '../../lib/money';
import { METHOD_RU } from '../../lib/dashboard-format';
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../../lib/food-types';
import {
  customerBonusQuote,
  lookupCertificate,
  moveAppointment,
  payAppointment,
  refundAppointment,
  setAppointmentStatus,
} from './journal-actions';
import { clock, instantOf, localInput } from './time';
import { AppointmentEditor } from './appointment-editor';
import { AppointmentHistoryPanel } from './appointment-history-panel';
import { ReviewInvitation } from './review-invitation';
import { ACTION_WORD } from './appointment-status';
import { beautyStatus } from '../../lib/status/beauty';
import { NO_SHOW_BEFORE_START_MESSAGE, maxRedeem, normalizeCertificateCode } from '@pms/domain';
import { AppointmentMoneyOperation, type PreparedMoneyRequest } from './appointment-money-operation';
import type { JournalResult } from './journal-actions';
import { formatPhone } from '../../lib/phone';
import { useBranchPaymentMethods } from '../branch-payment-methods/use-branch-methods';
import { branchMethodsShown } from '../branch-payment-methods/shown';

type PayMethod = FoodPaymentMethod | 'BONUS' | 'GIFT_CERTIFICATE';

export function AppointmentCard(props: Parameters<typeof AppointmentCardBody>[0]) {
  return <AppointmentCardBody key={`${props.scopeKey}:${props.row.id}`} {...props} />;
}

function AppointmentCardBody({
  day,
  row,
  canEdit,
  canCreate = canEdit ?? false,
  canUpdate = canEdit ?? false,
  canPay = canEdit ?? false,
  canRefund = false,
  canIssueReview = false,
  canAdjustPrice = false,
  scopeKey = '',
  onDone,
}: {
  day: BeautyDay;
  row: BeautyAppointmentRow;
  canEdit?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canPay?: boolean;
  /** возврат по выполненной записи (§54): право `refunds` */
  canRefund?: boolean;
  canIssueReview?: boolean;
  canAdjustPrice?: boolean;
  scopeKey?: string;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [state, action, pending] = useActionState(moveAppointment, null);
  const { ask, dialog } = useConfirm();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const money = useRef<AppointmentMoneyOperation | null>(null);
  const mounted = useRef(false);
  const [moneyStatus, setMoneyStatus] = useState<AppointmentMoneyOperation['status'] | 'confirmed'>('blocked');
  const [moneyKind, setMoneyKind] = useState<'pay' | 'refund' | null>(null);
  useEffect(() => {
    mounted.current = true;
    money.current = new AppointmentMoneyOperation(scopeKey, row.id);
    setMoneyStatus(money.current.status);
    return () => { mounted.current = false; };
  }, [scopeKey, row.id]);
  const moneyLocked = busy || moneyStatus !== 'idle';
  const runMoney = (request: PreparedMoneyRequest, operation: AppointmentMoneyOperation) => {
    setMoneyKind(request.kind);
    setMoneyStatus('pending');
    setError(null);
    startTransition(async () => {
      let result: JournalResult;
      try {
        result = request.kind === 'pay'
          ? await payAppointment(row.id, request.method, request.amountMinor, request.idempotencyKey, scopeKey, request.certificateCode)
          : await refundAppointment(row.id, request.method, request.amountMinor, request.reason!, request.idempotencyKey, scopeKey);
      } catch {
        result = { outcome: 'unknown', error: 'Ответ потерян. Результат операции не подтверждён.' };
      }
      const confirmed = operation.settle(result);
      // A late response belongs to the original keyed card, not the next appointment/scope.
      if (!mounted.current) return;
      setMoneyStatus(confirmed ? 'confirmed' : operation.status);
      if (!confirmed) {
        setError(result?.error ?? 'Результат операции не подтверждён.');
        return;
      }
      try { onDone(); } catch {
        setError('Операция подтверждена. Обновите страницу, чтобы увидеть актуальный остаток.');
      }
    });
  };
  const retryMoney = () => {
    if ((moneyKind === 'pay' && !canPay) || (moneyKind === 'refund' && !canRefund)) return;
    const operation = money.current;
    const request = operation?.retry();
    if (operation && request) runMoney(request, operation);
  };
  const master = day.columns.find((c) => c.id === row.employeeId);
  // поле datetime-local показывает местное время филиала, а на сервер уходит момент: без перевода
  // «13:00» уехало бы в часовом поясе того, кто открыл страницу
  const [localStart, setLocalStart] = useState(() =>
    localInput(row.startsAt, day.location.timezone),
  );
  const moved = Boolean(state?.message) && !state?.error;
  // оплата в кассу филиала (§49): у отменённой и незаезда не принимается; доплату ограничивает чистая оплата (§54)
  const net = BigInt(row.paidMinor) - BigInt(row.refundedMinor);
  const remaining = BigInt(row.priceMinor) - net;
  const refundable = canRefund && row.status === 'DONE' && net > 0n;
  const currencyLabel = row.currency === 'KZT' ? '₸' : row.currency;
  const [refundMethod, setRefundMethod] = useState<FoodPaymentMethod>('CASH');
  const [refundAmount, setRefundAmount] = useState(() => minorToInput(net.toString()));
  const [reason, setReason] = useState('');
  const refund = () => {
    const minorText = inputToMinor(refundAmount);
    if (minorText === null) return setError('Введите сумму, не больше двух знаков после запятой');
    const minor = BigInt(minorText || '0');
    if (minor <= 0n) return setError('Сумма должна быть больше нуля');
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return setError('Сумма слишком большая');
    if (!reason.trim()) return setError('Укажите причину возврата');
    const operation = money.current;
    const request = operation?.begin({ kind: 'refund', method: refundMethod, amountMinor: Number(minor), reason: reason.trim() });
    if (operation && request) runMoney(request, operation);
    else if (operation) setMoneyStatus(operation.status);
  };
  const payable =
    canPay && row.status !== 'CANCELLED' && row.status !== 'NO_SHOW' && remaining > 0n;
  const [method, setMethod] = useState<PayMethod>('CASH');
  // §21.7: оплата записи деньгами только включёнными в филиале способами; бонусы и сертификат отдельно, возврат всеми
  const accepted = useBranchPaymentMethods(scopeKey);
  const [amount, setAmount] = useState(() => minorToInput(remaining.toString()));
  // бонусы: баланс клиента и сколько можно списать в этот чек (решение 21.10.2026 §2)
  const [bonus, setBonus] = useState<{ balanceMinor: string; maxRedeemPercent: number } | null | 'loading' | 'none'>(null);
  const paidByBonus = (row.payments ?? []).reduce(
    (sum, p) => (p.method === 'BONUS' ? (p.kind === 'INCOME' ? sum + BigInt(p.amountMinor) : sum - BigInt(p.amountMinor)) : sum),
    0n,
  );
  const minOf = (...values: bigint[]) => values.reduce((a, b) => (a < b ? a : b));
  // доля чека минус уже оплаченное бонусами, не больше баланса и остатка к оплате (тот же расчёт, что у API)
  const bonusMaxRaw = bonus && bonus !== 'loading' && bonus !== 'none'
    ? minOf(
        maxRedeem(BigInt(row.priceMinor), BigInt(bonus.balanceMinor), bonus.maxRedeemPercent),
        (BigInt(row.priceMinor) * BigInt(bonus.maxRedeemPercent)) / 100n - paidByBonus,
        remaining,
      )
    : 0n;
  const bonusMax = bonusMaxRaw > 0n ? bonusMaxRaw : 0n;
  const bonusAvailable = Boolean(bonus && bonus !== 'loading' && bonus !== 'none' && BigInt(bonus.balanceMinor) > 0n);
  // баланс бонусов читается сразу при открытии оплаты: способ показывается только при балансе больше нуля
  useEffect(() => {
    if (!payable || bonus !== null) return;
    setBonus('loading');
    let active = true;
    Promise.resolve()
      .then(() => customerBonusQuote(row.customer.id))
      .then((quote) => { if (active && mounted.current) setBonus(quote ?? 'none'); }, () => { if (active && mounted.current) setBonus('none'); });
    return () => { active = false; };
  }, [payable, row.customer.id]);
  // сертификат: код и остаток по нему (решение 21.10.2026 §3)
  const [certCode, setCertCode] = useState('');
  const [cert, setCert] = useState<{ balanceMinor: string; status: string; expiresAt: string } | { error: string } | null>(null);
  const chooseMethod = (next: PayMethod) => {
    setMethod(next);
    setCert(null);
    if (next === 'BONUS' && bonus && bonus !== 'loading' && bonus !== 'none') {
      const max = minOf(
        maxRedeem(BigInt(row.priceMinor), BigInt(bonus.balanceMinor), bonus.maxRedeemPercent),
        (BigInt(row.priceMinor) * BigInt(bonus.maxRedeemPercent)) / 100n - paidByBonus,
        remaining,
      );
      setAmount(minorToInput((max > 0n ? max : 0n).toString()));
    }
  };
  const checkCertificate = () => {
    const code = normalizeCertificateCode(certCode);
    if (!code) return setCert({ error: 'Код сертификата: 8 знаков' });
    void lookupCertificate(code).then((found) => {
      if (!mounted.current) return;
      setCert(found);
      if (!('error' in found)) {
        const balance = BigInt(found.balanceMinor);
        setAmount(minorToInput((balance < remaining ? balance : remaining).toString()));
      }
    });
  };
  const pay = () => {
    const minorText = inputToMinor(amount);
    if (minorText === null) return setError('Введите сумму, не больше двух знаков после запятой');
    const minor = BigInt(minorText || '0');
    if (minor <= 0n) return setError('Сумма должна быть больше нуля');
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return setError('Сумма слишком большая');
    if (method === 'BONUS' && minor > bonusMax) return setError(`Бонусами можно оплатить не больше ${formatMoney(bonusMax.toString(), row.currency)}`);
    const certificateCode = method === 'GIFT_CERTIFICATE' ? normalizeCertificateCode(certCode) : null;
    if (method === 'GIFT_CERTIFICATE' && !certificateCode) return setError('Введите код сертификата: 8 знаков');
    const operation = money.current;
    const request = operation?.begin({
      kind: 'pay', method, amountMinor: Number(minor), ...(certificateCode ? { certificateCode } : {}),
    });
    if (operation && request) runMoney(request, operation);
    else if (operation) setMoneyStatus(operation.status);
  };
  useEffect(() => {
    if (moved) onDone();
  }, [moved, onDone]);

  const change = async (status: BeautyAppointmentRow['status']) => {
    if (status === 'CANCELLED') {
      const ok = await ask({
        title: `Отменить запись: ${row.customer.name}, ${clock(row.startMinutes)}?`,
        body: 'Время специалиста освободится.',
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
            {row.customer.phone ? `, ${formatPhone(row.customer.phone)}` : ''}
          </dd>
        </div>
        {row.items?.length ? (
          row.items.map((item) => (
            <div key={item.id} className="appointment-card-line">
              <dt>{item.serviceName}</dt>
              <dd>
                <p>
                  {item.employeeName}, {clock(item.startMinutes)}–{clock(item.endMinutes)} ·{' '}
                  {item.durationMinutes} мин
                </p>
                {/* цена один раз (аудит салона 22.10.2026): база и итог строки только при скидке, наценке или
                    нескольких услугах; итог записи в строке «Оплачено» */}
                {(BigInt(item.discountMinor) > 0n || BigInt(item.surchargeMinor) > 0n) && (
                  <p>Цена: {formatMoney(item.basePriceMinor, item.currency)}</p>
                )}
                {BigInt(item.discountMinor) > 0n && (
                  <p>Скидка: {formatMoney(item.discountMinor, item.currency)}</p>
                )}
                {BigInt(item.surchargeMinor) > 0n && (
                  <p>Наценка: {formatMoney(item.surchargeMinor, item.currency)}</p>
                )}
                {(row.items!.length > 1 || BigInt(item.discountMinor) > 0n || BigInt(item.surchargeMinor) > 0n) && (
                  <strong>{formatMoney(item.priceMinor, item.currency)}</strong>
                )}
              </dd>
            </div>
          ))
        ) : (
          <>
            <div>
              <dt>Услуга</dt>
              <dd>{row.serviceName}</dd>
            </div>
            <div>
              <dt>Специалист</dt>
              <dd>{master?.name ?? 'не найден'}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Время</dt>
          <dd>
            {day.date}, {clock(row.startMinutes)} до {clock(row.endMinutes)}
          </dd>
        </div>
        <div>
          <dt>Оплачено</dt>
          <dd data-testid="beauty-card-paid">
            {formatMoney(row.paidMinor, row.currency)} из{' '}
            {formatMoney(row.priceMinor, row.currency)}
          </dd>
        </div>
        {(row.payments?.length ?? 0) > 0 && (
          <div>
            <dt>Платежи</dt>
            <dd data-testid="beauty-card-payments">
              {/* A4 (паритет с zapis.kz): каждый платёж строкой; аннулирование по-прежнему в «Кассе» */}
              <ul className="beauty-card-payments">
                {row.payments!.map((payment) => (
                  <li key={payment.id}>
                    {localInput(payment.at, day.location.timezone).slice(11, 16)},{' '}
                    {METHOD_RU[payment.method as keyof typeof METHOD_RU] ?? payment.method},{' '}
                    {formatMoney(payment.amountMinor, row.currency)}
                    {payment.kind === 'EXPENSE' ? ' (Возврат)' : ''}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {BigInt(row.refundedMinor) > 0n && (
          <div>
            <dt>Возвращено</dt>
            <dd data-testid="beauty-card-refunded">
              {formatMoney(row.refundedMinor, row.currency)}
            </dd>
          </div>
        )}
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

      <AppointmentHistoryPanel
        key={`${scopeKey}:${row.id}`}
        appointmentId={row.id}
        scopeKey={scopeKey}
      />
      {canIssueReview && row.status === 'DONE' && (
        <ReviewInvitation appointmentId={row.id} scopeKey={scopeKey} />
      )}
      {canCreate && (
        <section aria-label="Повторная запись">
          <Button type="button" tone="secondary" onClick={() => setRepeating(true)}>
            Повторить запись
          </Button>
          <AppointmentEditor
            open={repeating}
            onClose={() => setRepeating(false)}
            day={day}
            customers={[]}
            employeeId={row.employeeId}
            repeatFrom={row}
            canAdjustPrice={canAdjustPrice}
            scopeKey={scopeKey}
            onDone={onDone}
          />
        </section>
      )}
      {canUpdate && canAdjustPrice && row.next.length > 0 && (
        <section aria-label="Редактирование услуг">
          <Button type="button" tone="secondary" onClick={() => setEditing(true)}>
            Изменить услуги
          </Button>
          <AppointmentEditor
            open={editing}
            onClose={() => setEditing(false)}
            day={day}
            customers={[]}
            employeeId={row.employeeId}
            editing={row}
            canAdjustPrice
            scopeKey={scopeKey}
            onDone={onDone}
          />
        </section>
      )}
      {canUpdate && row.next.length > 0 && (
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

      {canUpdate && (row.status === 'BOOKED' || row.status === 'CONFIRMED') && !row.next.includes('NO_SHOW') && (
        <p className="muted">{beautyStatus.NO_SHOW.label}: {NO_SHOW_BEFORE_START_MESSAGE}</p>
      )}

      {payable && (
        <section className="beauty-form" aria-label="Оплата записи">
          <h3>Оплата</h3>
          <Field label="Способ">
            <Select disabled={moneyLocked} value={method} onChange={(e) => chooseMethod(e.target.value as PayMethod)}>
              {branchMethodsShown(FOOD_PAYMENT_METHODS, accepted, method).map((m) => (
                <option key={m} value={m}>
                  {METHOD_RU[m] ?? m}
                </option>
              ))}
              {/* «Бонусы» только когда у клиента есть бонусы (аудит салона 22.10.2026: предлагались при 0) */}
              {bonusAvailable && <option value="BONUS">Бонусы</option>}
              <option value="GIFT_CERTIFICATE">Сертификат</option>
            </Select>
          </Field>
          {method === 'BONUS' && bonusAvailable && bonus && bonus !== 'loading' && bonus !== 'none' && (
            <p className="beauty-loyalty-hint" data-testid="pay-bonus-hint">
              {`Бонусов: ${formatMoney(bonus.balanceMinor, row.currency)}. Можно списать: ${formatMoney(bonusMax.toString(), row.currency)}.`}
            </p>
          )}
          {method === 'GIFT_CERTIFICATE' && (
            <>
              <Field label="Код сертификата">
                <Input
                  disabled={moneyLocked}
                  value={certCode}
                  maxLength={12}
                  autoComplete="off"
                  onChange={(e) => { setCertCode(e.target.value); setCert(null); }}
                />
              </Field>
              <Button type="button" tone="secondary" disabled={moneyLocked || !certCode.trim()} onClick={checkCertificate}>
                Проверить
              </Button>
              {cert && (
                <p className="beauty-loyalty-hint" data-testid="pay-certificate-hint">
                  {'error' in cert
                    ? cert.error
                    : cert.status === 'ACTIVE'
                      ? `Остаток сертификата: ${formatMoney(cert.balanceMinor, row.currency)}. Если остатка не хватает, спишется сколько есть.`
                      : cert.status === 'EXPIRED'
                        ? 'Срок сертификата истёк'
                        : 'Сертификат уже использован'}
                </p>
              )}
            </>
          )}
          <Field label={`Сумма, ${currencyLabel}`}>
            <Input disabled={moneyLocked} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Button type="button" disabled={moneyLocked} onClick={pay}>
            Принять оплату
          </Button>
          {BigInt(row.paidMinor) > 0n && (
            <p className="muted">Аннулировать оплату можно в «Кассе».</p>
          )}
        </section>
      )}

      {refundable && (
        <section className="beauty-form" aria-label="Возврат по записи">
          <h3>Возврат</h3>
          <Field label="Способ возврата">
            <Select
              disabled={moneyLocked}
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as FoodPaymentMethod)}
            >
              {FOOD_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_RU[m] ?? m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Сумма возврата, ${currencyLabel}`}>
            <Input
              disabled={moneyLocked}
              inputMode="decimal"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </Field>
          <Field label="Причина">
            <Input disabled={moneyLocked} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button type="button" tone="danger" disabled={moneyLocked} onClick={refund}>
            Оформить возврат
          </Button>
        </section>
      )}

      {canUpdate && row.next.length > 0 && (
        <form action={action} className="beauty-form">
          <input type="hidden" name="id" value={row.id} />
          <h3>Перенести</h3>
          <Field label={row.items && row.items.length > 1 ? 'Специалист первой услуги' : 'Специалист'}>
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

      {moneyStatus === 'blocked' && (canPay || canRefund) && (
        <Alert>Безопасная отправка недоступна или осталась неподтверждённая операция. Сверьте историю и кассу. Новая оплата или возврат заблокированы; если хранилище вкладки недоступно, разрешите его до отправки.</Alert>
      )}
      {moneyStatus === 'unknown' && (
        <section aria-label="Восстановление денежной операции">
          <Alert>Результат не подтверждён. Повтор отправит ту же сумму, способ и причину с прежним ключом. После закрытия формы сначала сверьте историю и кассу.</Alert>
          <Button type="button" tone="secondary" disabled={busy || (moneyKind === 'pay' ? !canPay : !canRefund)} onClick={retryMoney}>
            Повторить ту же операцию
          </Button>
        </section>
      )}
      {error && <Alert>{error}</Alert>}
      {state?.message && !state.error && <p role="status">{state.message}</p>}
      {dialog}
    </div>
  );
}
