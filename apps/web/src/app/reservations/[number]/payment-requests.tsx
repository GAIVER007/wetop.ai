'use client';
import { useActionState, useState } from 'react';
import { paymentRequestMessage, type MessageLang } from '@pms/domain';
import type { FinanceFolio, PaymentRequest } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { useCommand } from '../../../lib/use-command';
import { useConfirm } from '../../../components/use-confirm';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Notice,
  Panel,
  Row,
  Select,
  Stack,
} from '../../../components/ui';
import { CopyButton } from '../../website/forms';
import {
  cancelPaymentRequestAction,
  createPaymentRequestAction,
  markPaymentRequestPaidAction,
  type FinanceActionResult,
} from './finance-actions';

const INIT: FinanceActionResult = { error: null, ok: 0 };
/** Способы запроса: живые деньги, у которых бывает счёт или ссылка (DATA_MODEL §23) */
const METHODS: Array<[PaymentRequest['method'], string]> = [
  ['KASPI', 'Kaspi: счёт по номеру телефона'],
  ['HALYK', 'Halyk: ссылка на оплату'],
  ['BANK_TRANSFER_PERSON', 'Перевод по реквизитам'],
  ['CARD_TERMINAL', 'Картой на стойке'],
];
const METHOD_SHORT: Record<PaymentRequest['method'], string> = {
  KASPI: 'Kaspi',
  HALYK: 'Halyk',
  BANK_TRANSFER_PERSON: 'перевод',
  CARD_TERMINAL: 'карта на стойке',
};
const STATUS: Record<PaymentRequest['status'], { label: string; tone: 'warn' | 'ok' | 'neutral' }> =
  {
    PENDING: { label: 'ждёт оплаты', tone: 'warn' },
    PAID: { label: 'оплачен', tone: 'ok' },
    CANCELLED: { label: 'отменён', tone: 'neutral' },
  };
const LANGS: Array<[MessageLang, string]> = [
  ['ru', 'Русский'],
  ['kk', 'Казахский'],
  ['en', 'Английский'],
  ['zh', 'Китайский'],
];
/** «1200000» → «12000»; остаток в поле суммы по умолчанию */
const minorToDecimal = (minor: string) => {
  const d = minor.replace('-', '').padStart(3, '0');
  const frac = d.slice(-2);
  return frac === '00' ? d.slice(0, -2) : `${d.slice(0, -2)}.${frac}`;
};

/**
 * «Запросы оплаты» в «Счетах» брони (DATA_MODEL §23, ADR-141): администратор выставляет гостю счёт в Kaspi по номеру
 * телефона или вставляет ссылку банка, отправляет гостю готовый текст и, когда деньги пришли, жмёт «Оплачено»:
 * запрос становится обычным платежом на счёт проживания. Ссылки банки создают в своём кабинете, пока нет их API.
 */
export function PaymentRequestsPanel({
  number,
  propertyName,
  requests,
  folios,
}: {
  number: string;
  propertyName: string;
  requests: PaymentRequest[] | null;
  folios: FinanceFolio[];
}) {
  const openFolios = folios.filter((f) => f.status === 'OPEN');
  const [folioId, setFolioId] = useState(openFolios[0]?.id ?? '');
  const [method, setMethod] = useState<PaymentRequest['method']>('KASPI');
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

  return (
    <Panel data-testid="payment-requests">
      <Row gap="lg" className="row--baseline">
        <b className="panel__title panel__title--lg">Запросы оплаты</b>
        {pendingRequests.length > 0 && (
          <Badge tone="warn" data-testid="payment-requests-pending">
            ждут оплаты: {pendingRequests.length}
          </Badge>
        )}
      </Row>
      <p className="hint">
        Выставьте гостю счёт в Kaspi по номеру телефона или вставьте ссылку банка, отправьте гостю
        текст. Когда деньги пришли, нажмите «Оплачено»: оплата ляжет на счёт проживания.
      </p>
      {requests === null && (
        <Alert boxed tone="warning">
          Запросы оплаты не загрузились. Обновите страницу.
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
            <span className="hint">Язык текста для гостя</span>
            <Select
              aria-label="Язык текста для гостя"
              value={lang}
              onChange={(e) => setLang(e.target.value as MessageLang)}
              data-testid="payment-request-lang"
            >
              {LANGS.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
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
                  <span>{METHOD_SHORT[r.method]}</span>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.status === 'PENDING' && (
                    <span className="ml-auto">
                      <Row>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          data-testid="payment-request-paid"
                          onClick={async () => {
                            const ok = await ask({
                              title: `Деньги по запросу пришли: ${formatMoney(r.amountMinor, r.currency)}?`,
                              body: 'Оплата ляжет на счёт проживания как обычный платёж. Отменить её можно только возвратом.',
                              confirmLabel: 'Оплачено',
                              tone: 'primary',
                            });
                            if (ok)
                              command(() => markPaymentRequestPaidAction(number, r.id, other));
                          }}
                        >
                          Оплачено
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          tone="secondary"
                          disabled={busy}
                          data-testid="payment-request-cancel"
                          onClick={async () => {
                            const ok = await ask({
                              title: `Отменить запрос на ${formatMoney(r.amountMinor, r.currency)}?`,
                              body: 'Если счёт уже выставлен в Kaspi или банке, отмените его и там.',
                              confirmLabel: 'Отменить запрос',
                            });
                            if (ok) command(() => cancelPaymentRequestAction(number, r.id, other));
                          }}
                        >
                          Отменить
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
                    <CopyButton text={text} label="Скопировать текст для гостя" />
                  </>
                )}
              </div>
            );
          })}
        </Stack>
      )}

      {openFolios.length === 0 ? (
        <p className="hint">Открытых счетов нет: запрос оплаты выставлять не на что.</p>
      ) : (
        <form action={formAction} className="stack stack--sm" data-testid="payment-request-form">
          <Row>
            {openFolios.length > 1 && (
              <Field label="Счёт">
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
            <Field label="Как оплатит гость">
              <Select
                name="method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRequest['method'])}
                data-testid="payment-request-method"
              >
                {METHODS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Сумма, ₸">
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
            <Field label="Ссылка банка, необязательно">
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
              Счёт выставляется в приложении Kaspi Pay на номер гостя; здесь запрос учитывается и
              превращается в оплату.
            </p>
          )}
          <Row>
            <Button type="submit" disabled={busy} data-testid="payment-request-create">
              Создать запрос
            </Button>
          </Row>
        </form>
      )}
      {dialog}
    </Panel>
  );
}
