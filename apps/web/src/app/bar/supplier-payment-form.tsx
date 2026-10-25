'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBarAction } from './use-bar-action';
import { BarContextFields, type BarFormContext } from './context';

import { Button, Field, Input, Select } from '../../components/ui';
import { payBarSupplierAction, type BarActionResult } from './actions';
import { barMethodRu } from '@pms/domain';
import { useT } from '../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };
// Mirror actions.ts value(...).trim() + minor(): identity only, not the submitted amount.
const intentMinor = (raw: string) => {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  return (BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')).toString();
};
const tenge = (minor: string) => {
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0');
  return fraction === '00' ? whole.toString() : `${whole}.${fraction}`;
};
export function SupplierPaymentForm({
  receiptId,
  dueAmount,
  context,
  methods,
}: {
  context: BarFormContext;
  receiptId: string;
  dueAmount: string;
  methods: string[];
}) {
  const t = useT();
  const [state, action, pending] = useBarAction(payBarSupplierAction, initial);
  const intentSlots = useRef<string[] | null>(null);
  // Keep an unpersisted candidate stable if storage writes fail and the user retries.
  const draftKeys = useRef(new Map<string, string>());
  const cleanupBlocked = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    // pending is committed asynchronously; the ref also guards same-tick submits.
    if (!pending) submitting.current = false;
  }, [pending, state]);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok && !state.error && intentSlots.current) {
      try {
        for (const slot of intentSlots.current) sessionStorage.removeItem(slot);
        intentSlots.current = null;
      } catch {
        // The command succeeded. Do not turn it into a failure or permit a new payment.
        cleanupBlocked.current = true;
        setCleanupWarning(
          t('Платёж записан, но не удалось очистить ключ повтора. Не отправляйте другой платёж: обновите страницу и сверьте оплату перед продолжением.'),
        );
      }
    }
  }, [state.ok, state.error]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || submitting.current || cleanupBlocked.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    // Canonical identity uses the same accepted syntax and integer minor units as the action.
    const amount = intentMinor(String(data.get('amount') ?? ''));
    if (amount === null) {
      setStorageError(t('{field}: укажите сумму в валюте операции, не более двух знаков после запятой', { field: t('Сумма') }));
      return;
    }
    const method = String(data.get('method') ?? '').trim();
    const slot = JSON.stringify([
      'supplier-payment-v2',
      { propertyId: context.propertyId, currency: context.currency },
      receiptId,
      amount,
      method,
    ]);
    const slots = [slot];
    let key: string;
    try {
      const stored = new Set<string>();
      const canonicalKey = sessionStorage.getItem(slot);
      if (canonicalKey) stored.add(canonicalKey);
      // Read all matching legacy spellings, including old context property order.
      // Never discard an unresolved key or guess between conflicting intents.
      for (let index = 0; index < sessionStorage.length; index++) {
        const legacySlot = sessionStorage.key(index);
        if (!legacySlot) continue;
        let legacy: unknown;
        try {
          legacy = JSON.parse(legacySlot);
        } catch {
          continue;
        }
        if (
          !Array.isArray(legacy) ||
          legacy.length !== 5 ||
          legacy[0] !== 'supplier-payment' ||
          legacy[1]?.propertyId !== context.propertyId ||
          legacy[1]?.currency !== context.currency ||
          legacy[2] !== receiptId ||
          typeof legacy[3] !== 'string' ||
          intentMinor(legacy[3]) !== amount ||
          typeof legacy[4] !== 'string' ||
          legacy[4].trim() !== method
        )
          continue;
        const legacyKey = sessionStorage.getItem(legacySlot);
        if (legacyKey) {
          stored.add(legacyKey);
          slots.push(legacySlot);
        }
      }
      if (stored.size > 1) {
        setStorageError(
          t('Платёж не отправлен: найдены разные ключи повтора одной суммы. Сначала сверьте оплаты; автоматический выбор ключа небезопасен.'),
        );
        return;
      }
      key = stored.values().next().value || draftKeys.current.get(slot) || crypto.randomUUID();
      draftKeys.current.set(slot, key);
      sessionStorage.setItem(slot, key);
      draftKeys.current.delete(slot);
    } catch {
      setStorageError(
        t('Платёж не отправлен: недоступно хранилище ключа повтора. Разрешите хранилище браузера и повторите попытку. Если ранее отправляли этот платёж, сначала сверьте оплату.'),
      );
      return;
    }
    setStorageError(null);
    intentSlots.current = slots;
    (form.elements.namedItem('idempotencyKey') as HTMLInputElement).value = key;
    submitting.current = true;
    action(event);
  };
  // способы из настройки объекта (ADR-185); счёт организации остаётся умолчанием поставщика, пока объект его не выключил
  const preferred = methods.includes('BANK_TRANSFER_LEGAL') ? 'BANK_TRANSFER_LEGAL' : methods[0];
  if (methods.length === 0)
    return (
      <p role="status" className="bar-muted" data-testid="bar-no-methods">
        {t('В настройках объекта нет способа оплаты, который принимает бар')}
      </p>
    );
  return (
    <form onSubmit={submit} className="bar-payment-form">
      <input type="hidden" name="idempotencyKey" defaultValue="" />
      <BarContextFields context={context} />
      <input type="hidden" name="receiptId" value={receiptId} />
      <Field label={t('Сумма, {currency}', { currency: context.currency })}>
        <Input name="amount" inputMode="decimal" defaultValue={tenge(dueAmount)} required />
      </Field>
      <Field label={t('Способ')}>
        <Select name="method" defaultValue={preferred}>
          {methods.map((method) => (
            <option key={method} value={method}>
              {t(barMethodRu(method))}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" size="xs" disabled={pending || !!cleanupWarning}>
        {pending ? t('Запись…') : t('Оплатить')}
      </Button>
      {(storageError || cleanupWarning) && (
        <p role="alert" className="bar-error">
          {cleanupWarning || storageError}
        </p>
      )}
      {state.error && (
        <p role="alert" className="bar-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="bar-success">
          {state.message}
        </p>
      )}
    </form>
  );
}
