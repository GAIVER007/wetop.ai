'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeCertificateCode } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Input, Select, Table } from '../../../components/ui';
import type { BeautyGiftCertificate } from '../../../lib/api';
import { METHOD_RU } from '../../../lib/dashboard-format';
import { FOOD_PAYMENT_METHODS } from '../../../lib/food-types';
import { currencySign, formatMoney, inputToMinor } from '../../../lib/money';
import { findCertificate, sellCertificate } from './actions';
import { useBranchPaymentMethods } from '../../branch-payment-methods/use-branch-methods';
import { branchMethodsShown } from '../../branch-payment-methods/shown';

const STATUS: Record<BeautyGiftCertificate['status'], { label: string; tone: 'ok' | 'neutral' | 'warn' | 'danger' }> = {
  ACTIVE: { label: 'Действует', tone: 'ok' },
  USED: { label: 'Использован', tone: 'neutral' },
  EXPIRED: { label: 'Истёк', tone: 'warn' },
  VOID: { label: 'Аннулирован', tone: 'danger' },
};

const date = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

export function CertificatesBoard({
  items,
  currency,
  canSell,
}: {
  items: BeautyGiftCertificate[];
  currency: string;
  canSell: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sold, setSold] = useState<BeautyGiftCertificate | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [found, setFound] = useState<BeautyGiftCertificate | { error: string } | null>(null);
  const [pending, start] = useTransition();
  const check = () => {
    const code = normalizeCertificateCode(lookupCode);
    if (!code) return setFound({ error: 'Код сертификата: 8 знаков' });
    start(async () => {
      const result = await findCertificate(code);
      setFound('data' in result ? result.data : result);
    });
  };
  return (
    <div className="beauty-certificates">
      <div className="beauty-certificates__bar">
        <form
          className="beauty-certificates__lookup"
          onSubmit={(event) => {
            event.preventDefault();
            check();
          }}
        >
          <Field label="Проверить по коду" controlId="certificate-lookup">
            <Input value={lookupCode} maxLength={12} autoComplete="off" onChange={(e) => setLookupCode(e.target.value)} />
          </Field>
          <Button type="submit" tone="secondary" disabled={pending}>
            Проверить
          </Button>
        </form>
        {canSell && (
          <Button type="button" onClick={() => { setSold(null); setOpen(true); }}>
            Продать сертификат
          </Button>
        )}
      </div>
      {found && (
        <p className="beauty-loyalty-hint" data-testid="certificate-lookup-result">
          {'error' in found
            ? found.error
            : `${found.code}: ${STATUS[found.status].label.toLowerCase()}, остаток ${formatMoney(found.balanceMinor, found.currency)} из ${formatMoney(found.initialMinor, found.currency)}, до ${date(found.expiresAt)}`}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState title="Сертификатов пока нет">Проданный сертификат появится здесь с кодом и остатком.</EmptyState>
      ) : (
        <Table className="beauty-certificates__table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Продан</th>
              <th>Номинал</th>
              <th>Остаток</th>
              <th>Действует до</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-testid="certificate-row">
                <td data-label="Код">
                  <code>{item.code}</code>
                </td>
                <td data-label="Продан">{date(item.createdAt)}</td>
                <td data-label="Номинал">{formatMoney(item.initialMinor, item.currency)}</td>
                <td data-label="Остаток">{formatMoney(item.balanceMinor, item.currency)}</td>
                <td data-label="Действует до">{date(item.expiresAt)}</td>
                <td data-label="Статус">
                  <Badge tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Overlay open={open} onClose={() => setOpen(false)} title="Продать сертификат" size="sm">
        {sold ? (
          <div className="beauty-certificates__sold" data-testid="certificate-sold">
            <Alert tone="success">Сертификат продан. Деньги приняты в кассу.</Alert>
            <p>
              Код для клиента: <strong className="beauty-certificates__code">{sold.code}</strong>
            </p>
            <p className="muted">
              Номинал {formatMoney(sold.initialMinor, sold.currency)}, действует до {date(sold.expiresAt)}.
            </p>
            <Button type="button" onClick={() => setOpen(false)}>
              Готово
            </Button>
          </div>
        ) : (
          <SellForm
            currency={currency}
            onSold={(certificate) => {
              setSold(certificate);
              router.refresh();
            }}
          />
        )}
      </Overlay>
    </div>
  );
}

function SellForm({ currency, onSold }: { currency: string; onSold: (c: BeautyGiftCertificate) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('CASH');
  // §21.7: сертификат продаётся только включёнными в филиале способами; филиал страницы один, ключ постоянный
  const accepted = useBranchPaymentMethods('certificates');
  const [months, setMonths] = useState('12');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // один ключ на попытку: повтор после сбоя сети не продаст второй сертификат
  const attempt = useRef<string | null>(null);
  const submit = () => {
    const minor = inputToMinor(amount);
    if (!minor || BigInt(minor) <= 0n) return setError('Введите номинал больше нуля');
    if (BigInt(minor) > BigInt(Number.MAX_SAFE_INTEGER)) return setError('Номинал слишком большой');
    attempt.current ??= crypto.randomUUID();
    const key = attempt.current;
    setError(null);
    start(async () => {
      const result = await sellCertificate({ amountMinor: Number(minor), method, months: Number(months), idempotencyKey: key });
      if ('error' in result) return setError(result.error);
      attempt.current = null;
      onSold(result.data);
    });
  };
  return (
    <form
      className="beauty-certificates__sell"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label={`Номинал, ${currencySign(currency)}`} controlId="certificate-amount">
        <Input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); attempt.current = null; }} />
      </Field>
      <Field label="Оплата" controlId="certificate-method">
        <Select value={method} onChange={(e) => { setMethod(e.target.value); attempt.current = null; }}>
          {branchMethodsShown(FOOD_PAYMENT_METHODS, accepted, method).map((m) => (
            <option key={m} value={m}>
              {METHOD_RU[m] ?? m}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Срок, месяцев" controlId="certificate-months">
        <Input type="number" min={1} max={60} step={1} value={months} onChange={(e) => { setMonths(e.target.value); attempt.current = null; }} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Продаём…' : 'Продать'}
      </Button>
    </form>
  );
}
