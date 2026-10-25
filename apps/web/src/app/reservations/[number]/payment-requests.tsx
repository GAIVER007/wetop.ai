'use client';
import { useActionState, useState } from 'react';
import { paymentRequestMessage, type MessageLang } from '@pms/domain';
import type { FinanceFolio, PaymentRequest } from '../../../lib/api';
import { currencySign, formatMoney } from '../../../lib/money';
import { useCommand } from '../../../lib/use-command';
import { useConfirm } from '../../../components/use-confirm';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Notice,
  Row,
  Select,
  Stack,
} from '../../../components/ui';
import { CopyButton } from '../../website/forms';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
import {
  cancelPaymentRequestAction,
  createPaymentRequestAction,
  markPaymentRequestPaidAction,
  type FinanceActionResult,
} from './finance-actions';

const INIT: FinanceActionResult = { error: null, ok: 0 };
/** Способы запроса: живые деньги, у которых бывает счёт или ссылка (DATA_MODEL §24) */
const METHODS: Array<[PaymentRequest['method'], string]> = [
  ['KASPI', msg('Kaspi: счёт по номеру телефона')],
  ['HALYK', msg('Halyk: ссылка на оплату')],
  ['BANK_TRANSFER_PERSON', msg('Перевод по реквизитам')],
  ['CARD_TERMINAL', msg('Картой на стойке')],
];
const METHOD_SHORT: Record<PaymentRequest['method'], string> = {
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: msg('перевод'),
  CARD_TERMINAL: msg('карта на стойке'),
};
const STATUS: Record<PaymentRequest['status'], { label: string; tone: 'warn' | 'ok' | 'neutral' }> =
  {
    PENDING: { label: msg('ждёт оплаты'), tone: 'warn' },
    PAID: { label: msg('оплачен'), tone: 'ok' },
    CANCELLED: { label: msg('отменён'), tone: 'neutral' },
  };
const LANGS: Array<[MessageLang, string]> = [
  ['ru', msg('Русский')],
  ['kk', msg('Казахский')],
  ['en', msg('Английский')],
  ['zh', msg('Китайский')],
];
/** «1200000» → «12000»; остаток в поле суммы по умолчанию */
const minorToDecimal = (minor: string) => {
  const d = minor.replace('-', '').padStart(3, '0');
  const frac = d.slice(-2);
  return frac === '00' ? d.slice(0, -2) : `${d.slice(0, -2)}.${frac}`;
};

/**
 * «Запросы оплаты» в «Счетах» брони (DATA_MODEL §24, ADR-144): администратор выставляет гостю счёт в Kaspi по номеру
 * телефона или вставляет ссылку банка, отправляет гостю готовый текст и, когда деньги пришли, жмёт «Оплачено»:
 * запрос становится обычным платежом на счёт проживания. Ссылки банки создают в своём кабинете, пока нет их API.
 */
export function PaymentRequestsPanel({
  number,
  propertyName,
  requests,
  folios,
  paymentMethods,
  canMutate,
}: {
  number: string;
  propertyName: string;
  requests: PaymentRequest[] | null;
  /** включённые способы объекта (DATA_MODEL §21.6); нет поля, значит старый API: все четыре */
  paymentMethods?: string[] | undefined;
  folios: FinanceFolio[];
  canMutate: boolean;
}) {
  const t = useT();
  const openFolios = folios.filter((f) => f.status === 'OPEN');
  const [folioId, setFolioId] = useState(openFolios[0]?.id ?? '');
  // способы запроса, которые объект принимает (§21.6); выключенный не предлагается
  const methods = paymentMethods
    ? METHODS.filter(([code]) => paymentMethods.includes(code))
    : METHODS;
  const [method, setMethod] = useState<PaymentRequest['method']>(methods[0]?.[0] ?? 'KASPI');
  const [lang, setLang] = useState<MessageLang>('ru');
  const folio = openFolios.find((f) => f.id === folioId);
  const due = folio && BigInt(folio.balanceMinor) > 0n ? minorToDecimal(folio.balanceMinor) : '';
  const [state, formAction, pending] = useActionState<FinanceActionResult, FormData>(
    createPaymentRequestAction.bind(null, number),
    INIT,
  );
  const {
    state: other,
    run: command,
    pending: commandPending,
  } = useCommand<FinanceActionResult>(INIT);
  const { ask, dialog } = useConfirm();
  const busy = pending || commandPending;
  const error = state.error ?? other.error;
  const message = other.message ?? state.message;
  const pendingRequests = (requests ?? []).filter((r) => r.status === 'PENDING');

  // Запросы — редкий путь (5–6 раз в период против сотен обычных оплат): блок свёрнут, пока нет ожидающих
  return (
    <details
      className="panel"
      data-testid="payment-requests"
      open={pendingRequests.length > 0 || undefined}
    >
      <summary className="bold" data-testid="payment-requests-toggle">
        {t('Отправить гостю счёт на оплату')}
        {pendingRequests.length > 0 && (
          <>
            {' '}
            <Badge tone="warn" data-testid="payment-requests-pending">
              {t('ждут оплаты: {n}', { n: pendingRequests.length })}
            </Badge>
          </>
        )}
      </summary>
      <p className="hint">
        {t('Kaspi по номеру телефона, ссылка банка или реквизиты перевода: выставьте счёт и отправьте гостю готовый текст. Когда деньги пришли, нажмите «Оплачено»: оплата ляжет на счёт проживания. Оплату на месте принимайте выше, без запроса.')}
      </p>
      {requests === null && (
        <Alert boxed tone="warning">
          {t('Запросы оплаты не загрузились. Обновите страницу.')}
        </Alert>
      )}
      {error && (
        <Alert boxed data-testid="payment-request-error">
          {error}
        </Alert>
      )}
      {message && !error && (
        <Notice data-testid="payment-request-done" role="status">
          {message}
        </Notice>
      )}

      {(requests ?? []).length > 0 && (
        <Stack gap="sm">
          <Row className="row--baseline">
            <span className="hint">{t('Язык текста для гостя')}</span>
            <Select
              aria-label={t('Язык текста для гостя')}
              value={lang}
              onChange={(e) => setLang(e.target.value as MessageLang)}
              data-testid="payment-request-lang"
            >
              {LANGS.map(([code, label]) => (
                <option key={code} value={code}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Row>
          {(requests ?? []).map((r) => {
            const text = paymentRequestMessage({
              lang,
              propertyName,
              confirmationNumber: number,
              amountMinor: r.amountMinor,
              currency: r.currency,
              method: r.method,
              link: r.link,
            });
            return (
              <div
                key={r.id}
                className="stack stack--sm"
                data-testid="payment-request"
                data-status={r.status}
              >
                <Row className="row--baseline">
                  <b className="num">{formatMoney(r.amountMinor, r.currency)}</b>
                  <span>{t(METHOD_SHORT[r.method])}</span>
                  <Badge tone={STATUS[r.status].tone}>{t(STATUS[r.status].label)}</Badge>
                  {canMutate && r.status === 'PENDING' && (
                    <span className="ml-auto">
                      <Row>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          data-testid="payment-request-paid"
                          onClick={async () => {
                            const ok = await ask({
                              title: t('Деньги по запросу пришли: {sum}?', { sum: formatMoney(r.amountMinor, r.currency) }),
                              body: t('Оплата ляжет на счёт проживания как обычный платёж. Отменить её можно только возвратом.'),
                              confirmLabel: t('Оплачено'),
                              tone: 'primary',
                            });
                            if (ok)
                              command(() => markPaymentRequestPaidAction(number, r.id, other));
                          }}
                        >
                          {t('Оплачено')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          tone="secondary"
                          disabled={busy}
                          data-testid="payment-request-cancel"
                          onClick={async () => {
                            const ok = await ask({
                              title: t('Отменить запрос на {sum}?', { sum: formatMoney(r.amountMinor, r.currency) }),
                              body: t('Если счёт уже выставлен в Kaspi или банке, отмените его и там.'),
                              confirmLabel: t('Отменить запрос'),
                            });
                            if (ok) command(() => cancelPaymentRequestAction(number, r.id, other));
                          }}
                        >
                          {t('Отменить')}
                        </Button>
                      </Row>
                    </span>
                  )}
                </Row>
                {r.status === 'PENDING' && (
                  <>
                    <p className="hint--lg" data-testid="payment-request-text">
                      {text}
                    </p>
                    <CopyButton text={text} label={t('Скопировать текст для гостя')} />
                  </>
                )}
              </div>
            );
          })}
        </Stack>
      )}

      {!canMutate ? null : openFolios.length === 0 ? (
        <p className="hint">{t('Открытых счетов нет: запрос оплаты выставлять не на что.')}</p>
      ) : (
        <form action={formAction} className="stack stack--sm" data-testid="payment-request-form">
          <Row>
            {openFolios.length > 1 && (
              <Field label={t('Счёт')}>
                <Select name="folioId" value={folioId} onChange={(e) => setFolioId(e.target.value)}>
                  {openFolios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.stay.accommodationTypeName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {openFolios.length === 1 && <input type="hidden" name="folioId" value={folioId} />}
            {folio && <input type="hidden" name="currency" value={folio.currency} />}
            <Field label={t('Как оплатит гость')}>
              <Select
                name="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRequest['method'])}
                data-testid="payment-request-method"
              >
                {methods.map(([code, label]) => (
                  <option key={code} value={code}>
                    {t(label)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('Сумма, {currency}', { currency: currencySign(folio?.currency) })}>
              <Input
                key={`${folioId}-${state.ok}`}
                name="amount"
                inputMode="decimal"
                required
                defaultValue={state.values?.amount ?? due}
                data-testid="payment-request-amount"
              />
            </Field>
          </Row>
          {method !== 'KASPI' && method !== 'CARD_TERMINAL' && (
            <Field label={t('Ссылка банка, необязательно')}>
              <Input
                key={`link-${state.ok}`}
                name="link"
                type="url"
                placeholder="https://"
                defaultValue={state.values?.link ?? ''}
                data-testid="payment-request-link"
              />
            </Field>
          )}
          {method === 'KASPI' && (
            <p className="hint">
              {t('Счёт выставляется в приложении Kaspi Pay на номер гостя; здесь запрос учитывается и превращается в оплату.')}
            </p>
          )}
          <Row>
            <Button type="submit" disabled={busy} data-testid="payment-request-create">
              {t('Создать запрос')}
            </Button>
          </Row>
        </form>
      )}
      {dialog}
    </details>
  );
}
