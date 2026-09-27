'use client';
import { useActionState, useState } from 'react';
import { useCommand } from '../../../lib/use-command';
import { GroupPayment } from './group-payment';
import { type FinanceFolio, type ReservationFinance, type ServiceOption } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
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
  Table,
} from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import {
  addChargeAction,
  closeFolioAction,
  payAction,
  refundAction,
  voidChargeAction,
  type FinanceActionResult,
  stayExtraAction,
} from './finance-actions';
import { usePropertyClock } from '../../../components/property-time';
import { useMay } from '../../../components/desk-access';
import { displayDate } from '../../../lib/display-date';
import { useConfirm } from '../../../components/use-confirm';

const KIND_RU: Record<string, string> = {
  ACCOMMODATION: 'проживание',
  SERVICE: 'услуга',
  PENALTY: 'штраф',
  ADJUSTMENT: 'корректировка',
};
const METHODS: Array<[string, string]> = [
  ['CASH', 'наличные'],
  ['CARD_TERMINAL', 'карта (терминал)'],
  ['KASPI', 'Kaspi'],
  ['HALYK', 'Halyk'],
  ['BANK_TRANSFER_PERSON', 'перевод от физлица'],
  ['BANK_TRANSFER_LEGAL', 'перевод от юрлица'],
  ['DEPOSIT', 'депозит'],
  ['CARD_GUARANTEE', 'гарантия картой'],
  ['EXTERNAL', 'внешний (канал / Exely)'],
];
const methodRu = (m: string) => METHODS.find(([k]) => k === m)?.[1] ?? m;
const INIT: FinanceActionResult = { error: null, ok: 0 };
/** «1.25» / «1,25» / «12000» → тиыны строкой; иначе null — сумма ещё не число */
export const decimalToMinor = (raw: string): string | null => {
  const m = raw
    .trim()
    .replace(/\s+/g, '')
    .match(/^(-?)(\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  const [, sign, whole, frac = ''] = m;
  return `${sign}${BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'))}`;
};
const toDecimal = (minor: string) => {
  const neg = minor.startsWith('-');
  const d = minor.replace('-', '').padStart(3, '0');
  return `${neg ? '-' : ''}${d.slice(0, -2)}.${d.slice(-2)}`;
};

/** Раздел «Счета» карточки брони: по счёту на проживание — начисления, платежи, возвраты, формы. */
export function FinancePanel({
  number,
  finance,
  services,
  today,
}: {
  number: string;
  finance: ReservationFinance;
  services: ServiceOption[];
  today: string;
}) {
  return (
    <Stack>
      <GroupPayment
        number={number}
        folios={finance.folios}
        methods={METHODS.filter(([code]) => code !== 'EXTERNAL')}
      />
      {finance.folios.length > 1 && (
        <div data-testid="finance-total">
          Итого по брони: начислено {formatMoney(finance.chargedMinor, finance.currency)}, оплачено{' '}
          {formatMoney(finance.paidMinor, finance.currency)}, возвращено{' '}
          {formatMoney(finance.refundedMinor, finance.currency)} →{' '}
          <Balance minor={finance.balanceMinor} currency={finance.currency} />
        </div>
      )}
      {finance.folios.map((f) => (
        <FolioPanel key={f.id} number={number} folio={f} services={services} today={today} />
      ))}
    </Stack>
  );
}

function Balance({ minor, currency }: { minor: string; currency: string }) {
  const n = BigInt(minor);
  const cls = n > 0n ? 'warn-text' : n < 0n ? 'info-text' : 'ok-text';
  const label = n > 0n ? 'к оплате' : n < 0n ? 'переплата' : 'оплачено';
  return (
    <b className={cls} data-testid="folio-balance">
      {formatMoney(minor, currency)} · {label}
    </b>
  );
}

function FolioPanel({
  number,
  folio,
  services,
  today,
}: {
  number: string;
  folio: FinanceFolio;
  services: ServiceOption[];
  today: string;
}) {
  // Дата оплаты и возврата — день по часам объекта, а не срез UTC-строки (волна 3, С-13)
  const clock = usePropertyClock();
  // возврат и сторно (снятие штрафа — тоже сторно) — владелец и управляющий (ADR-101, Q-024); API откажет и так
  const reverse = useMay('refunds');
  const [chargeState, chargeAction, chargePending] = useActionState<FinanceActionResult, FormData>(
    addChargeAction.bind(null, number, folio.id),
    INIT,
  );
  const [payState, payFormAction, payPending] = useActionState<FinanceActionResult, FormData>(
    payAction.bind(null, number, folio.id),
    INIT,
  );
  const {
    state: other,
    setState: setOther,
    run: command,
    pending: commandPending,
  } = useCommand<FinanceActionResult>(INIT);
  const { ask, dialog } = useConfirm();
  const busy = chargePending || payPending || commandPending;
  const [kind, setKind] = useState('SERVICE');
  const open = folio.status === 'OPEN';
  const balance = BigInt(folio.balanceMinor);
  const error = chargeState.error ?? payState.error ?? other.error;
  // Подтверждение последнего успеха: без него после оплаты экран просто очищал форму (§7.3)
  const done = payState.message ?? chargeState.message ?? other.message;
  return (
    <Panel data-testid="folio-panel" style={{ gap: 10 }}>
      <Row gap="lg" className="row--baseline">
        <b className="panel__title panel__title--lg">
          Счёт — {folio.stay.accommodationTypeName},{' '}
          <time dateTime={folio.stay.arrivalDate}>{displayDate(folio.stay.arrivalDate)}</time>
          {' → '}
          <time dateTime={folio.stay.departureDate}>{displayDate(folio.stay.departureDate)}</time>
        </b>
        {!open && (
          // Без подписи закрытый счёт выглядел просто как счёт без форм: администратор не понимал,
          // почему нельзя ни начислить, ни принять оплату
          <Badge data-testid="folio-closed">счёт закрыт — гость рассчитался и выехал</Badge>
        )}
        <span className="sub">
          начислено {formatMoney(folio.chargedMinor, folio.currency)}, оплачено{' '}
          {formatMoney(folio.paidMinor, folio.currency)}
          {folio.refundedMinor !== '0'
            ? `, возвращено ${formatMoney(folio.refundedMinor, folio.currency)}`
            : ''}
        </span>
        <span className="ml-auto">
          <Balance minor={folio.balanceMinor} currency={folio.currency} />
        </span>
      </Row>

      <Table plain>
        <thead>
          <tr>
            {['Начисление', 'Дата', 'Кол-во × цена', 'Сумма', ''].map((h) => (
              <th key={h} className={h === 'Сумма' ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {folio.charges.map((c) => (
            <tr
              key={c.id}
              data-testid="charge-row"
              data-kind={c.kind}
              className={c.voidedAt ? 'is-void' : undefined}
            >
              <td>
                <span className="hint">{KIND_RU[c.kind] ?? c.kind}</span> {c.description}
              </td>
              <td>
                {c.serviceDate ? (
                  <time dateTime={c.serviceDate}>{displayDate(c.serviceDate)}</time>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {c.quantity} × {formatMoney(c.unitPriceMinor, folio.currency)}
              </td>
              <td className="num">{formatMoney(c.amountMinor, folio.currency)}</td>
              <td>
                {open && reverse && !c.voidedAt && c.kind !== 'ACCOMMODATION' && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="xs"
                    className="is-danger"
                    data-testid={`void-${c.id}`}
                    disabled={busy}
                    onClick={() => command(() => voidChargeAction(number, c.id))}
                  >
                    сторно
                  </Button>
                )}
                {c.voidedAt && <span className="small">сторнировано</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {folio.payments.length > 0 && (
        <Table plain>
          <thead>
            <tr>
              {[
                'Платёж',
                'Когда',
                'На этот счёт',
                'Возвращено',
                ...(reverse ? ['Возврат'] : []),
              ].map((h) => (
                <th
                  key={h}
                  className={h === 'На этот счёт' || h === 'Возвращено' ? 'num' : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {folio.payments.map((p) => (
              <tr key={p.paymentId} data-testid="payment-row">
                <td>
                  {methodRu(p.method)}
                  {p.note ? `, ${p.note}` : ''}
                  {p.externalReference ? `, ${p.externalReference}` : ''}
                  {p.status === 'VOIDED' ? ' — аннулирован' : ''}
                </td>
                <td>{clock.date(p.paidAt)}</td>
                <td className="num">{formatMoney(p.allocatedMinor, folio.currency)}</td>
                <td className="num">{formatMoney(p.refundedMinor, folio.currency)}</td>
                {reverse && (
                  <td>
                    {open &&
                      p.status === 'COMPLETED' &&
                      BigInt(p.allocatedMinor) > BigInt(p.refundedMinor) && (
                        <RefundForm
                          number={number}
                          paymentId={p.paymentId}
                          folioId={folio.id}
                          onResult={setOther}
                        />
                      )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {folio.refunds.length > 0 && (
        <div className="hint--lg">
          Возвраты:{' '}
          {folio.refunds
            .map(
              (r) =>
                `${formatMoney(r.amountMinor, folio.currency)} (${clock.date(r.createdAt)}${r.reason ? `, ${r.reason}` : ''})`,
            )
            .join('; ')}
        </div>
      )}

      {open && (
        <Stack gap="sm">
          <div className="folio-forms">
            {/* D3: у каждого поля подпись, начисление и оплата — две подписанные группы, не один ряд полей */}
            <form
              key={`c${chargeState.ok}-${chargeState.attempt ?? 0}`}
              action={chargeAction}
              data-testid="charge-form"
              className="folio-form"
            >
              <b className="folio-form__title">Начислить на счёт</b>
              <div className="row">
                <Field inline label="Вид">
                  <Select
                    name="kind"
                    aria-label="Вид начисления"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="SERVICE">услуга</option>
                    <option value="PENALTY">штраф</option>
                    <option value="ADJUSTMENT">корректировка</option>
                  </Select>
                </Field>
                {kind === 'SERVICE' ? (
                  <Field inline label="Услуга">
                    <Select
                      name="serviceCode"
                      aria-label="Услуга"
                      defaultValue={chargeState.values?.serviceCode ?? services[0]?.code}
                    >
                      {services.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.group ? `${s.group}: ` : ''}
                          {s.nameRu} — {formatMoney(s.priceMinor, folio.currency)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field inline label="За что">
                    <Input
                      name="description"
                      aria-label="Описание начисления"
                      defaultValue={chargeState.values?.description ?? ''}
                      placeholder="за что"
                      required
                      className="inp--w180"
                    />
                  </Field>
                )}
                <Field inline label="Кол-во">
                  <Input
                    name="quantity"
                    aria-label="Количество"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={chargeState.values?.quantity ?? 1}
                    className="inp--w64"
                  />
                </Field>
                {kind !== 'SERVICE' && (
                  <Field inline label="Цена">
                    <Input
                      name="unitPrice"
                      aria-label="Цена за единицу"
                      defaultValue={chargeState.values?.unitPrice ?? ''}
                      // на уменьшение — владелец и управляющий (ADR-101): администратору минус не подсказываем
                      placeholder={kind === 'ADJUSTMENT' && reverse ? 'сумма (можно −)' : 'сумма'}
                      required
                      className="inp--w120"
                    />
                  </Field>
                )}
                <Field inline label="Дата">
                  <DateInput
                    name="serviceDate"
                    aria-label="Дата услуги"
                    defaultValue={chargeState.values?.serviceDate ?? today}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  Начислить
                </Button>
              </div>
            </form>
            <PaymentForm
              key={`p${payState.ok}-${payState.attempt ?? 0}`}
              number={number}
              folio={folio}
              action={payFormAction}
              values={payState.values}
              busy={busy}
            />
          </div>
          {/* ADR-021: ранний заезд и поздний выезд — услуга одной кнопкой, половина ночи по умолчанию */}
          <Row>
            {(
              [
                ['EARLY_CHECK_IN', 'Ранний заезд', 'early-check-in'],
                ['LATE_CHECK_OUT', 'Поздний выезд', 'late-check-out'],
              ] as const
            ).map(([extra, label, testId]) => (
              <Button
                key={extra}
                type="button"
                tone="secondary"
                size="sm"
                data-testid={`${testId}-${folio.id}`}
                disabled={busy}
                title="Услуга на счёт по правилу объекта: доля ночи зависит от времени"
                onClick={async () => {
                  // правило объекта из Exely: ранний заезд до 06:00 — вся ночь, 06:00–11:59 — половина,
                  // с 12:00 бесплатно; поздний выезд 12:01–17:59 — половина, с 18:00 — вся ночь
                  const time = window.prompt(
                    `${label}: во сколько? (ЧЧ:ММ). Пусто — половина ночи`,
                    '',
                  );
                  if (time === null) return;
                  await command(() =>
                    stayExtraAction(number, folio.id, extra, time.trim() || undefined),
                  );
                }}
              >
                {label}
              </Button>
            ))}
          </Row>
          {balance === 0n && (
            // Закрыть вручную можно только рассчитанный счёт; с долгом или переплатой API откажет
            <Row>
              <Button
                type="button"
                tone="secondary"
                size="sm"
                data-testid={`close-folio-${folio.id}`}
                disabled={busy}
                onClick={async () => {
                  const ok = await ask({
                    title: 'Закрыть счёт?',
                    body: 'Баланс нулевой. После закрытия по этому счёту нельзя ни начислить, ни принять оплату — новые начисления пойдут на другой счёт.',
                    confirmLabel: 'Закрыть счёт',
                  });
                  if (!ok) return;
                  await command(() => closeFolioAction(number, folio.id));
                }}
              >
                Закрыть счёт
              </Button>
              <span className="hint">
                баланс нулевой — счёт можно закрыть, если начислений больше не будет
              </span>
            </Row>
          )}
        </Stack>
      )}
      {error && <Alert>{error}</Alert>}
      {!error && done && (
        <Notice data-testid="finance-done" role="status">
          {done}
        </Notice>
      )}
      {dialog}
    </Panel>
  );
}

/**
 * Приём оплаты (D3): подписанные поля и строка сути перед кнопкой — сколько, чем и на какой счёт какой
 * брони уходит. Кнопка одна, на время отправки отключена: второй платёж тем же нажатием не создаётся.
 * Отказ сохраняет ввод (`values` из server action), успех перерисовывает форму заново (ключ снаружи).
 */
function PaymentForm({
  number,
  folio,
  action,
  values,
  busy,
}: {
  number: string;
  folio: FinanceFolio;
  action: (fd: FormData) => void;
  values: Record<string, string> | undefined;
  busy: boolean;
}) {
  const [method, setMethod] = useState(values?.method ?? 'CASH');
  const suggested = BigInt(folio.balanceMinor) > 0n ? toDecimal(folio.balanceMinor) : '';
  const [draft, setDraft] = useState<string | null>(values?.amount ?? null);
  const amount = draft ?? suggested;
  const minor = decimalToMinor(amount);
  const digest =
    amount === ''
      ? 'Введите сумму'
      : `${minor ? formatMoney(minor, folio.currency) : `${amount} — не число`}, ${methodRu(method)}, на счёт «${folio.stay.accommodationTypeName}» брони ${number}`;
  return (
    <form action={action} data-testid="payment-form" className="folio-form folio-form--pay">
      <b className="folio-form__title">Принять оплату</b>
      <div className="row">
        <Field inline label="Способ">
          <Select
            name="method"
            aria-label="Способ оплаты"
            disabled={busy}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.filter(([k]) => k !== 'EXTERNAL').map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field inline label="Сумма">
          {/* подсказка из баланса не перебивает ввод администратора */}
          <Input
            name="amount"
            aria-label="Сумма"
            placeholder="сумма"
            required
            disabled={busy}
            value={amount}
            onChange={(event) => setDraft(event.target.value)}
            className="inp--w120"
          />
        </Field>
        <Field inline label="Примечание">
          <Input
            name="note"
            aria-label="Примечание"
            disabled={busy}
            defaultValue={values?.note ?? ''}
            placeholder="примечание"
          />
        </Field>
      </div>
      <div className="row folio-form__submit">
        <span className="hint" data-testid="payment-digest">
          {digest}
        </span>
        <Button type="submit" tone="success" disabled={busy || minor === null}>
          Принять оплату
        </Button>
      </div>
    </form>
  );
}

function RefundForm({
  number,
  paymentId,
  folioId,
  onResult,
}: {
  number: string;
  paymentId: string;
  folioId: string;
  onResult: (r: FinanceActionResult) => void;
}) {
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    async (prev, fd) => {
      const r = await refundAction(number, paymentId, folioId, prev, fd);
      onResult(r);
      return r;
    },
    INIT,
  );
  return (
    <form
      key={`${state.ok}-${state.attempt ?? 0}`}
      action={action}
      data-testid="refund-form"
      className="row row--xs"
    >
      <Input
        name="amount"
        aria-label="Сумма"
        defaultValue={state.values?.amount ?? ''}
        placeholder="сумма"
        required
        className="inp--w90 inp--sm"
      />
      <Input
        name="reason"
        aria-label="Причина возврата"
        defaultValue={state.values?.reason ?? ''}
        placeholder="причина"
        className="inp--w110 inp--sm"
      />
      <Button type="submit" tone="secondary" size="sm" disabled={pending}>
        вернуть
      </Button>
    </form>
  );
}
