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
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';

const STATUS: Record<BeautyGiftCertificate['status'], { label: string; tone: 'ok' | 'neutral' | 'warn' | 'danger' }> = {
  ACTIVE: { label: msg('Действует'), tone: 'ok' },
  USED: { label: msg('Использован'), tone: 'neutral' },
  EXPIRED: { label: msg('Истёк'), tone: 'warn' },
  VOID: { label: msg('Аннулирован'), tone: 'danger' },
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
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sold, setSold] = useState<BeautyGiftCertificate | null>(null);
  const [lookupCode, setLookupCode] = useState('');
  const [found, setFound] = useState<BeautyGiftCertificate | { error: string } | null>(null);
  const [pending, start] = useTransition();
  const check = () => {
    const code = normalizeCertificateCode(lookupCode);
    if (!code) return setFound({ error: t('Код сертификата: 8 знаков') });
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
          <Field label={t('Проверить по коду')} controlId="certificate-lookup">
            <Input value={lookupCode} maxLength={12} autoComplete="off" onChange={(e) => setLookupCode(e.target.value)} />
          </Field>
          <Button type="submit" tone="secondary" disabled={pending}>
            {t('Проверить')}
          </Button>
        </form>
        {canSell && (
          <Button type="button" onClick={() => { setSold(null); setOpen(true); }}>
            {t('Продать сертификат')}
          </Button>
        )}
      </div>
      {found && (
        <p className="beauty-loyalty-hint" data-testid="certificate-lookup-result">
          {'error' in found
            ? found.error
            : t('{code}: {status}, остаток {balance} из {initial}, до {date}', {
                code: found.code,
                status: t(STATUS[found.status].label).toLowerCase(),
                balance: formatMoney(found.balanceMinor, found.currency),
                initial: formatMoney(found.initialMinor, found.currency),
                date: date(found.expiresAt),
              })}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState title={t('Сертификатов пока нет')}>{t('Проданный сертификат появится здесь с кодом и остатком.')}</EmptyState>
      ) : (
        <Table className="beauty-certificates__table">
          <thead>
            <tr>
              <th>{t('Код')}</th>
              <th>{t('Продан')}</th>
              <th>{t('Номинал')}</th>
              <th>{t('Остаток')}</th>
              <th>{t('Действует до')}</th>
              <th>{t('Статус')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-testid="certificate-row">
                <td data-label={t('Код')}>
                  <code>{item.code}</code>
                </td>
                <td data-label={t('Продан')}>{date(item.createdAt)}</td>
                <td data-label={t('Номинал')}>{formatMoney(item.initialMinor, item.currency)}</td>
                <td data-label={t('Остаток')}>{formatMoney(item.balanceMinor, item.currency)}</td>
                <td data-label={t('Действует до')}>{date(item.expiresAt)}</td>
                <td data-label={t('Статус')}>
                  <Badge tone={STATUS[item.status].tone}>{t(STATUS[item.status].label)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Overlay open={open} onClose={() => setOpen(false)} title={t('Продать сертификат')} size="sm">
        {sold ? (
          <div className="beauty-certificates__sold" data-testid="certificate-sold">
            <Alert tone="success">{t('Сертификат продан. Деньги приняты в кассу.')}</Alert>
            <p>
              {t('Код для клиента:')} <strong className="beauty-certificates__code">{sold.code}</strong>
            </p>
            <p className="muted">
              {t('Номинал {sum}, действует до {date}.', { sum: formatMoney(sold.initialMinor, sold.currency), date: date(sold.expiresAt) })}
            </p>
            <Button type="button" onClick={() => setOpen(false)}>
              {t('Готово')}
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
  const t = useT();
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
    if (!minor || BigInt(minor) <= 0n) return setError(t('Введите номинал больше нуля'));
    if (BigInt(minor) > BigInt(Number.MAX_SAFE_INTEGER)) return setError(t('Номинал слишком большой'));
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
      <Field label={t('Номинал, {sign}', { sign: currencySign(currency) })} controlId="certificate-amount">
        <Input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); attempt.current = null; }} />
      </Field>
      <Field label={t('Оплата')} controlId="certificate-method">
        <Select value={method} onChange={(e) => { setMethod(e.target.value); attempt.current = null; }}>
          {branchMethodsShown(FOOD_PAYMENT_METHODS, accepted, method).map((m) => (
            <option key={m} value={m}>
              {t(METHOD_RU[m] ?? m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('Срок, месяцев')} controlId="certificate-months">
        <Input type="number" min={1} max={60} step={1} value={months} onChange={(e) => { setMonths(e.target.value); attempt.current = null; }} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? t('Продаём…') : t('Продать')}
      </Button>
    </form>
  );
}
