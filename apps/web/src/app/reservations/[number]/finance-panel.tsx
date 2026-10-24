'use client';
import { createContext, useActionState, useContext, useEffect, useMemo, useState } from 'react';
import { useCommand } from '../../../lib/use-command';
import { useMoneyReview } from './money-review';
import { GroupPayment } from './group-payment';
import {
  type FinanceCharge,
  type FinanceFolio,
  type FinancePaymentLine,
  type ReservationFinance,
  type ServiceOption,
} from '../../../lib/api';
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
import { Overlay } from '../../../components/overlay';
import {
  addChargeAction,
  closeFolioAction,
  payAction,
  receiptAction,
  refundAction,
  replacePaymentAction,
  stayPriceAction,
  voidChargeAction,
  voidPaymentAction,
  type FinanceActionResult,
  stayExtraAction,
} from './finance-actions';
import { usePropertyClock } from '../../../components/property-time';
import { useMay } from '../../../components/desk-access';
import { displayDate } from '../../../lib/display-date';
import { DESK_PAYMENT_METHODS, methodRu } from '../../../lib/payment-method-label';
import { chargeLine } from '../../../lib/charge-text';
import { useConfirm } from '../../../components/use-confirm';
import { intlLocale, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';

const KIND_RU: Record<string, string> = {
  ACCOMMODATION: msg('проживание'),
  SERVICE: msg('услуга'),
  PENALTY: msg('штраф'),
  ADJUSTMENT: msg('корректировка'),
};
export { methodRu };
/** Способы стойки: без EXTERNAL (его ставят каналы), в порядке настройки объекта (DATA_MODEL §21.6) */
const DESK_METHODS = DESK_PAYMENT_METHODS;
const methodOptions = (enabled?: string[]): Array<[string, string]> =>
  enabled ? enabled.flatMap((k) => DESK_METHODS.filter(([code]) => code === k)) : DESK_METHODS;
const MethodsContext = createContext<Array<[string, string]>>(DESK_METHODS);
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
/** Остаток платежа на этом счёте, который ещё можно вернуть */
const refundable = (p: FinancePaymentLine) => BigInt(p.allocatedMinor) - BigInt(p.refundedMinor);

/**
 * Раздел «Счета» карточки брони (план `plans/finance-payments-direct-2026-10-07.md`): по счёту на проживание
 * сначала «Принять оплату» одним шагом, затем «Проживание и услуги» с ценой проживания и скидкой, затем
 * «Оплаты» с возвратом, правкой и аннулированием. Запросы оплаты живут ниже, свёрнутыми (У8).
 */
export function FinancePanel({
  number,
  finance,
  services,
  today,
  canMutate,
}: {
  number: string;
  finance: ReservationFinance;
  services: ServiceOption[];
  today: string;
  canMutate: boolean;
}) {
  const t = useT();
  // включённые способы объекта (§21.6): старый API без поля даёт все восемь
  const methods = useMemo(() => methodOptions(finance.paymentMethods), [finance.paymentMethods]);
  return (
    <MethodsContext.Provider value={methods}>
    <Stack>
      {canMutate && <GroupPayment number={number} folios={finance.folios} methods={methods} />}
      {finance.folios.length > 1 && (
        <div data-testid="finance-total">
          {t('Итого по брони: начислено {charged}, оплачено {paid}, возвращено {refunded}', {
            charged: formatMoney(finance.chargedMinor, finance.currency),
            paid: formatMoney(finance.paidMinor, finance.currency),
            refunded: formatMoney(finance.refundedMinor, finance.currency),
          })}
          {' → '}
          <Balance minor={finance.balanceMinor} currency={finance.currency} />
        </div>
      )}
      {finance.folios.map((f) => (
        <FolioPanel key={f.id} number={number} folio={f} services={services} today={today} canMutate={canMutate} />
      ))}
    </Stack>
    </MethodsContext.Provider>
  );
}

function Balance({ minor, currency }: { minor: string; currency: string }) {
  const t = useT();
  const n = BigInt(minor);
  const cls = n > 0n ? 'warn-text' : n < 0n ? 'info-text' : 'ok-text';
  const label = n > 0n ? t('к оплате') : n < 0n ? t('переплата') : t('оплачено');
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
  canMutate,
}: {
  number: string;
  folio: FinanceFolio;
  services: ServiceOption[];
  today: string;
  canMutate: boolean;
}) {
  // Дата оплаты и возврата — день по часам объекта, а не срез UTC-строки (волна 3, С-13)
  const clock = usePropertyClock();
  const t = useT();
  const locale = useLocale();
  // возврат, сторно, скидка, аннулирование и правка платежа — владелец и управляющий (ADR-107, Q-024); API откажет и так
  const reverse = useMay('refunds') && canMutate;
  // чек по запросу гостя отмечает смена (DATA_MODEL §26); касса пробивает чек сама, WETOP хранит номер
  const desk = useMay('desk') && canMutate;
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
  const [editing, setEditing] = useState<FinancePaymentLine | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [pricing, setPricing] = useState(false);
  const open = folio.status === 'OPEN';
  const mutable = canMutate && open;
  const balance = BigInt(folio.balanceMinor);
  const error = chargeState.error ?? payState.error ?? other.error;
  // Подтверждение последнего успеха: без него после оплаты экран просто очищал форму (§7.3)
  const done = payState.message ?? chargeState.message ?? other.message;
  const stayCharge = folio.charges.find((c) => c.kind === 'ACCOMMODATION' && !c.voidedAt) ?? null;
  return (
    <Panel className="folio-panel" data-testid="folio-panel" style={{ gap: 10 }}>
      <Row gap="lg" className="row--baseline">
        <b className="panel__title panel__title--lg">
          {t('Счёт — {category},', { category: folio.stay.accommodationTypeName })}{' '}
          <time dateTime={folio.stay.arrivalDate}>{displayDate(folio.stay.arrivalDate, 'short', intlLocale(locale))}</time>
          {' → '}
          <time dateTime={folio.stay.departureDate}>{displayDate(folio.stay.departureDate, 'short', intlLocale(locale))}</time>
        </b>
        {!open && (
          // Без подписи закрытый счёт выглядел просто как счёт без форм: администратор не понимал,
          // почему нельзя ни начислить, ни принять оплату
          <Badge data-testid="folio-closed">{t('счёт закрыт — гость рассчитался и выехал')}</Badge>
        )}
        <span className="sub">
          {t('начислено {charged}, оплачено {paid}', {
            charged: formatMoney(folio.chargedMinor, folio.currency),
            paid: formatMoney(folio.paidMinor, folio.currency),
          })}
          {folio.refundedMinor !== '0'
            ? t(', возвращено {sum}', { sum: formatMoney(folio.refundedMinor, folio.currency) })
            : ''}
        </span>
        <span className="ml-auto">
          <Balance minor={folio.balanceMinor} currency={folio.currency} />
        </span>
      </Row>

      {mutable && (
        // Оплата первой (поручение владельца 07.10.2026): один шаг, без запроса и без прокрутки
        <PaymentForm
          key={`p${payState.ok}-${payState.attempt ?? 0}`}
          number={number}
          folio={folio}
          action={payFormAction}
          values={payState.values}
          busy={busy}
        />
      )}

      <b className="folio-form__title" data-testid="folio-charges-title">
        {t('Проживание и услуги')}
      </b>
      <Table plain aria-label={t('Проживание и услуги')}>
        <thead>
          <tr>
            {[msg('Начисление'), msg('Дата'), msg('Кол-во × цена'), msg('Сумма')].map((h) => (
              <th key={h} className={h === 'Сумма' /* kk-allow: сверка с ключом колонки */ ? 'num' : undefined}>
                {t(h)}
              </th>
            ))}
            <th>
              <span className="sr-only">{t('Действия')}</span>
            </th>
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
                {(() => {
                  // «проживание Проживание 2026-10-22 → …» → «Проживание 22 окт. – 24 окт.» (аудит 22.10.2026 P1-7)
                  const line = chargeLine(KIND_RU[c.kind] ?? c.kind, c.description, 'screen', locale);
                  return (
                    <>
                      {line.kind && <span className="hint">{t(line.kind)}</span>} {line.text}
                    </>
                  );
                })()}
              </td>
              <td>
                {c.serviceDate ? (
                  <time dateTime={c.serviceDate}>{displayDate(c.serviceDate, 'short', intlLocale(locale))}</time>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {c.quantity} × {formatMoney(c.unitPriceMinor, folio.currency)}
              </td>
              <td className="num">{formatMoney(c.amountMinor, folio.currency)}</td>
              <td>
                {mutable && reverse && !c.voidedAt && c.kind !== 'ACCOMMODATION' && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="xs"
                    className="is-danger"
                    data-testid={`void-${c.id}`}
                    disabled={busy}
                    onClick={() => command(() => voidChargeAction(number, c.id))}
                  >
                    {t('сторно')}
                  </Button>
                )}
                {mutable && !c.voidedAt && c.kind === 'ACCOMMODATION' && !pricing && (
                  <Button
                    type="button"
                    tone="secondary"
                    size="xs"
                    data-testid="stay-price-btn"
                    disabled={busy}
                    onClick={() => setPricing(true)}
                  >
                    {t('Изменить цену')}
                  </Button>
                )}
                {c.voidedAt && <span className="small">{t('сторнировано')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {mutable && pricing && stayCharge && (
        <StayPriceForm
          number={number}
          itemId={folio.reservationItemId}
          charge={stayCharge}
          currency={folio.currency}
          onResult={(r) => {
            setOther(r);
            if (!r.error) setPricing(false);
          }}
          onCancel={() => setPricing(false)}
        />
      )}

      {mutable && (
        <form
          key={`c${chargeState.ok}-${chargeState.attempt ?? 0}`}
          action={chargeAction}
          data-testid="charge-form"
          className="folio-form"
        >
          <b className="folio-form__title">{t('Добавить')}</b>
          <div className="row">
            <Field inline label={t('Вид')}>
              <Select
                name="kind"
                aria-label={t('Вид начисления@@счёт')}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="SERVICE">{t('Услуга')}</option>
                {/* скидка уменьшает счёт: владелец и управляющий (ADR-107); администратору не предлагаем */}
                {reverse && <option value="DISCOUNT">{t('Скидка')}</option>}
                <option value="PENALTY">{t('Штраф')}</option>
                <option value="ADJUSTMENT">{t('Корректировка')}</option>
              </Select>
            </Field>
            {kind === 'SERVICE' && (
              <Field inline label={t('Услуга')}>
                <Select
                  name="serviceCode"
                  aria-label={t('Услуга')}
                  defaultValue={chargeState.values?.serviceCode ?? services[0]?.code}
                >
                  {/* у нового отеля услуг ещё нет: пустой список выглядел сломанным (аудит 22.10.2026 P2-2) */}
                  {services.length === 0 && (
                    <option value="" disabled>
                      {t('Услуг пока нет')}
                    </option>
                  )}
                  {services.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.group ? `${s.group}: ` : ''}
                      {s.nameRu} — {formatMoney(s.priceMinor, folio.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {kind === 'DISCOUNT' && (
              <>
                <input type="hidden" name="baseMinor" value={stayCharge?.amountMinor ?? '0'} />
                <Field inline label={t('Процент')}>
                  <Input
                    name="percent"
                    aria-label={t('Процент скидки')}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    defaultValue={chargeState.values?.percent ?? ''}
                    placeholder="10"
                    className="inp--w64"
                  />
                </Field>
                <Field inline label={t('или сумма')}>
                  <Input
                    name="amount"
                    aria-label={t('Сумма скидки')}
                    inputMode="decimal"
                    defaultValue={chargeState.values?.amount ?? ''}
                    placeholder={t('сумма')}
                    className="inp--w120"
                  />
                </Field>
                <Field inline label={t('Причина')}>
                  <Input
                    name="description"
                    aria-label={t('Причина скидки')}
                    defaultValue={chargeState.values?.description ?? ''}
                    placeholder={t('необязательно')}
                    className="inp--w180"
                  />
                </Field>
              </>
            )}
            {(kind === 'PENALTY' || kind === 'ADJUSTMENT') && (
              <Field inline label={t('За что')}>
                <Input
                  name="description"
                  aria-label={t('Описание начисления')}
                  defaultValue={chargeState.values?.description ?? ''}
                  placeholder={t('за что')}
                  required
                  className="inp--w180"
                />
              </Field>
            )}
            {kind !== 'DISCOUNT' && (
              <Field inline label={t('Кол-во')}>
                <Input
                  name="quantity"
                  aria-label={t('Количество')}
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={chargeState.values?.quantity ?? 1}
                  className="inp--w64"
                />
              </Field>
            )}
            {(kind === 'PENALTY' || kind === 'ADJUSTMENT') && (
              <Field inline label={t('Цена')}>
                <Input
                  name="unitPrice"
                  aria-label={t('Цена за единицу')}
                  defaultValue={chargeState.values?.unitPrice ?? ''}
                  // на уменьшение — владелец и управляющий (ADR-107): администратору минус не подсказываем
                  placeholder={kind === 'ADJUSTMENT' && reverse ? t('сумма (можно −)') : t('сумма')}
                  required
                  className="inp--w120"
                />
              </Field>
            )}
            <Field inline label={t('Дата')}>
              <DateInput
                name="serviceDate"
                aria-label={t('Дата услуги')}
                defaultValue={chargeState.values?.serviceDate ?? today}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {kind === 'DISCOUNT' ? t('Применить скидку') : t('Начислить@@счёт')}
            </Button>
          </div>
          {kind === 'DISCOUNT' && stayCharge && (
            <span className="hint" data-testid="discount-hint">
              {t('Процент считается от проживания {sum}; скидка ляжет в счёт отдельной строкой со знаком минус', {
                sum: formatMoney(stayCharge.amountMinor, folio.currency),
              })}
            </span>
          )}
        </form>
      )}

      {folio.payments.length > 0 && (
        <>
          <b className="folio-form__title" data-testid="folio-payments-title">
            {t('Оплаты')}
          </b>
          <Table plain aria-label={t('Оплаты')}>
            <thead>
              <tr>
                {[
                  msg('Платёж'),
                  msg('Когда'),
                  msg('На этот счёт'),
                  msg('Возвращено'),
                  msg('Чек'),
                  ...(reverse ? [msg('Действия')] : []),
                ].map((h) => (
                  <th
                    key={h}
                    className={h === 'На этот счёт' || h === 'Возвращено' /* kk-allow: сверка с ключом колонки */ ? 'num' : undefined}
                  >
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {folio.payments.map((p) => (
                <tr
                  key={p.paymentId}
                  data-testid="payment-row"
                  data-status={p.status}
                  className={p.status === 'VOIDED' ? 'is-void' : undefined}
                >
                  <td>
                    {t(methodRu(p.method))}
                    {p.note ? `, ${p.note}` : ''}
                    {p.externalReference ? `, ${p.externalReference}` : ''}
                    {p.status === 'VOIDED' ? t(' — аннулирован') : ''}
                  </td>
                  <td>{clock.moment(p.paidAt)}</td>
                  <td className="num">{formatMoney(p.allocatedMinor, folio.currency)}</td>
                  <td className="num">{formatMoney(p.refundedMinor, folio.currency)}</td>
                  <td data-testid="payment-receipt">
                    {p.receipt ? (
                      <span title={t('отмечен {when}', { when: clock.moment(p.receipt.issuedAt) })}>
                        № {p.receipt.number}
                      </span>
                    ) : p.status === 'COMPLETED' && desk ? (
                      <ReceiptForm number={number} paymentId={p.paymentId} onResult={setOther} />
                    ) : (
                      <span className="muted">{t('нет')}</span>
                    )}
                  </td>
                  {reverse && (
                    <td>
                      {mutable && p.status === 'COMPLETED' && (
                        <Row className="row--xs">
                          {refundable(p) > 0n && refunding !== p.paymentId && (
                            <Button
                              type="button"
                              tone="secondary"
                              size="xs"
                              data-testid="refund-btn"
                              disabled={busy}
                              onClick={() => setRefunding(p.paymentId)}
                            >
                              {t('Вернуть@@деньги')}
                            </Button>
                          )}
                          {/* возврата ещё не было: иначе API откажет словами, кнопки не нужны */}
                          {BigInt(p.refundedMinor) === 0n && !p.receipt && (
                            <>
                              <Button
                                type="button"
                                tone="secondary"
                                size="xs"
                                data-testid="payment-edit"
                                disabled={busy}
                                onClick={() => setEditing(p)}
                              >
                                {t('Изменить')}
                              </Button>
                              <Button
                                type="button"
                                tone="ghost"
                                size="xs"
                                className="is-danger"
                                data-testid="payment-void"
                                disabled={busy}
                                onClick={async () => {
                                  const ok = await ask({
                                    title: t('Аннулировать платёж {sum}?', { sum: formatMoney(p.paymentAmountMinor, folio.currency) }),
                                    body: t('Платёж останется в списке со статусом «аннулирован», а сумма вернётся в остаток к оплате. Если деньги на самом деле получены, примите оплату заново или нажмите «Изменить».'),
                                    confirmLabel: t('Аннулировать'),
                                    tone: 'danger',
                                  });
                                  if (ok)
                                    await command(() =>
                                      voidPaymentAction(number, p.paymentId, null),
                                    );
                                }}
                              >
                                {t('Аннулировать')}
                              </Button>
                            </>
                          )}
                        </Row>
                      )}
                      {mutable && p.status === 'COMPLETED' && refunding === p.paymentId && (
                        <RefundForm
                          number={number}
                          paymentId={p.paymentId}
                          folioId={folio.id}
                          currency={folio.currency}
                          suggested={toDecimal(refundable(p).toString())}
                          onCancel={() => setRefunding(null)}
                          onResult={(r) => {
                            setOther(r);
                            if (!r.error) setRefunding(null);
                          }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      {folio.refunds.length > 0 && (
        <div className="hint--lg">
          {t('Возвраты: {list}', {
            list: folio.refunds
              .map(
                (r) =>
                  `${formatMoney(r.amountMinor, folio.currency)} (${clock.moment(r.createdAt)}${r.reason ? `, ${r.reason}` : ''})`,
              )
              .join('; '),
          })}
        </div>
      )}

      {mutable && (
        <Stack gap="sm">
          {/* ADR-021: ранний заезд и поздний выезд — услуга одной кнопкой, половина ночи по умолчанию */}
          <Row>
            {(
              [
                ['EARLY_CHECK_IN', msg('Ранний заезд'), 'early-check-in'],
                ['LATE_CHECK_OUT', msg('Поздний выезд'), 'late-check-out'],
              ] as const
            ).map(([extra, label, testId]) => (
              <Button
                key={extra}
                type="button"
                tone="secondary"
                size="sm"
                data-testid={`${testId}-${folio.id}`}
                disabled={busy}
                title={t('Услуга на счёт по правилу объекта: доля ночи зависит от времени')}
                onClick={async () => {
                  // правило объекта из внешней системы: ранний заезд до 06:00 — вся ночь, 06:00–11:59 — половина,
                  // с 12:00 бесплатно; поздний выезд 12:01–17:59 — половина, с 18:00 — вся ночь
                  const time = window.prompt(
                    t('{extra}: во сколько? (ЧЧ:ММ). Пусто — половина ночи', { extra: t(label) }),
                    '',
                  );
                  if (time === null) return;
                  await command(() =>
                    stayExtraAction(number, folio.id, extra, time.trim() || undefined),
                  );
                }}
              >
                {t(label)}
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
                    title: t('Закрыть счёт?'),
                    body: t('Баланс нулевой. После закрытия по этому счёту нельзя ни начислить, ни принять оплату — новые начисления пойдут на другой счёт.'),
                    confirmLabel: t('Закрыть счёт'),
                  });
                  if (!ok) return;
                  await command(() => closeFolioAction(number, folio.id));
                }}
              >
                {t('Закрыть счёт')}
              </Button>
              <span className="hint">
                {t('баланс нулевой — счёт можно закрыть, если начислений больше не будет')}
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
      {editing && (
        <EditPaymentDrawer
          number={number}
          folio={folio}
          payment={editing}
          onClose={() => setEditing(null)}
          onResult={(r) => {
            setOther(r);
            if (!r.error) setEditing(null);
          }}
        />
      )}
    </Panel>
  );
}

/**
 * Приём оплаты (D3): подписанные поля и строка сути перед кнопкой — сколько, чем и на какой счёт какой
 * брони уходит. Кнопка одна, на время отправки отключена: второй платёж тем же нажатием не создаётся.
 * Отказ сохраняет ввод (`values` из server action), успех перерисовывает форму заново (ключ снаружи).
 */
export function PaymentForm({
  number,
  folio,
  action,
  values,
  busy,
  onDraftChange,
}: {
  number: string;
  folio: Pick<FinanceFolio, 'id' | 'balanceMinor' | 'currency'> & {
    stay: Pick<FinanceFolio['stay'], 'accommodationTypeName'>;
  };
  action: (fd: FormData) => void;
  values: Record<string, string> | undefined;
  busy: boolean;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const methods = useContext(MethodsContext);
  const { review, onSubmit, onChange } = useMoneyReview(busy, onDraftChange);
  const [method, setMethod] = useState(values?.method ?? methods[0]?.[0] ?? 'CASH');
  const suggested = BigInt(folio.balanceMinor) > 0n ? toDecimal(folio.balanceMinor) : '';
  const [draft, setDraft] = useState<string | null>(values?.amount ?? null);
  const amount = draft ?? suggested;
  const minor = decimalToMinor(amount);
  // способ строчными внутри фразы, имена банков как есть (как `methodInline`, но на языке человека)
  const methodLabel = t(methodRu(method));
  const inline = /^(Kaspi|Halyk)/.test(methodLabel)
    ? methodLabel
    : methodLabel.charAt(0).toLocaleLowerCase() + methodLabel.slice(1);
  const digest =
    amount === ''
      ? t('Введите сумму')
      : t('{sum}, {method}, на счёт «{category}» брони {number}', {
          sum: minor ? formatMoney(minor, folio.currency) : t('{amount} — не число', { amount }),
          method: inline,
          category: folio.stay.accommodationTypeName,
          number,
        });
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      onChangeCapture={onChange}
      data-testid="payment-form"
      className="folio-form folio-form--pay"
      data-reviewed={review ? 'true' : undefined}
    >
      <input type="hidden" name="currency" value={folio.currency} />
      <b className="folio-form__title">{t('Принять оплату')}</b>
      <div className="row">
        <Field inline label={t('Способ')}>
          <Select
            name="method"
            aria-label={t('Способ оплаты')}
            disabled={busy}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {methods.map(([k, label]) => (
              <option key={k} value={k}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field inline label={t('Сумма')}>
          {/* подсказка из баланса не перебивает ввод администратора */}
          <Input
            name="amount"
            aria-label={t('Сумма')}
            placeholder={t('сумма')}
            required
            disabled={busy}
            value={amount}
            onChange={(event) => setDraft(event.target.value)}
            className="inp--w120"
          />
        </Field>
        <Field inline label={t('Примечание')}>
          <Input
            name="note"
            aria-label={t('Примечание')}
            disabled={busy}
            defaultValue={values?.note ?? ''}
            placeholder={t('примечание')}
          />
        </Field>
      </div>
      {review && (
        <section className="panel" aria-label={t('Проверка оплаты')}>
          <b>{t('Проверьте оплату')}</b>
          <p>{digest}</p>
          {review['note'] && <p>{t('Примечание: {note}', { note: review['note'] })}</p>}
          <p className="hint">{t('Оплата будет проведена после подтверждения.')}</p>
        </section>
      )}
      <div className="row folio-form__submit">
        {review && (
          <Button type="button" tone="secondary" disabled={busy} onClick={onChange}>
            {t('Изменить данные')}
          </Button>
        )}
        {!review && (
          <span className="hint" data-testid="payment-digest">
            {digest}
          </span>
        )}
        <Button
          type="submit"
          tone="success"
          disabled={busy || minor === null || BigInt(minor) <= 0n}
        >
          {busy ? t('Выполняется…') : review ? t('Подтвердить оплату') : t('Проверить оплату')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Цена проживания целиком (У6): пишется в проживание, начисление переписывает система. При смене дат
 * или категории цена снова считается по тарифу, об этом сказано рядом с полем.
 */
function StayPriceForm({
  number,
  itemId,
  charge,
  currency,
  onResult,
  onCancel,
}: {
  number: string;
  itemId: string;
  charge: FinanceCharge;
  currency: string;
  onResult: (r: FinanceActionResult) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    async (prev, fd) => {
      const r = await stayPriceAction(number, itemId, prev, fd);
      onResult(r);
      return r;
    },
    INIT,
  );
  return (
    <form
      key={`${state.ok}-${state.attempt ?? 0}`}
      action={action}
      data-testid="stay-price-form"
      className="folio-form"
    >
      <input type="hidden" name="currency" value={currency} />
      <b className="folio-form__title">{t('Цена проживания')}</b>
      <div className="row">
        <Field inline label={t('Новая цена')}>
          <Input
            name="price"
            aria-label={t('Цена проживания')}
            inputMode="decimal"
            required
            defaultValue={state.values?.price ?? toDecimal(charge.amountMinor)}
            className="inp--w120"
          />
        </Field>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {t('Сохранить цену')}
        </Button>
        <Button type="button" tone="secondary" onClick={onCancel} disabled={pending}>
          {t('Отмена')}
        </Button>
      </div>
      <span className="hint">
        {t('Сейчас {sum}. Начисление за проживание перепишется на новую цену; при смене дат или категории цена снова посчитается по тарифу', {
          sum: formatMoney(charge.amountMinor, currency),
        })}
      </span>
    </form>
  );
}

/** DATA_MODEL §26: гость попросил чек, касса его пробила; номер из кассы ложится к платежу, второй чек не пробьётся */
function ReceiptForm({
  number,
  paymentId,
  onResult,
}: {
  number: string;
  paymentId: string;
  onResult: (r: FinanceActionResult) => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    async (prev, fd) => {
      const r = await receiptAction(number, paymentId, prev, fd);
      onResult(r);
      return r;
    },
    INIT,
  );
  return (
    <form
      key={`${state.ok}-${state.attempt ?? 0}`}
      action={action}
      data-testid="receipt-form"
      className="row row--xs"
    >
      <Input
        name="receipt"
        aria-label={t('Номер чека из кассы')}
        defaultValue={state.values?.receipt ?? ''}
        placeholder={t('номер чека')}
        required
        className="inp--w110 inp--sm"
      />
      <Button type="submit" tone="secondary" size="sm" disabled={pending}>
        {t('чек выдан')}
      </Button>
    </form>
  );
}

export function RefundForm({
  number,
  paymentId,
  folioId,
  currency,
  suggested,
  onCancel,
  onResult,
  onDraftChange,
  onPendingChange,
}: {
  number: string;
  paymentId: string;
  folioId: string;
  currency: string;
  suggested?: string;
  onCancel?: () => void;
  onResult: (r: FinanceActionResult) => void;
  onDraftChange?: (dirty: boolean) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    async (prev, fd) => {
      const r = await refundAction(number, paymentId, folioId, prev, fd);
      onResult(r);
      return r;
    },
    INIT,
  );
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [pending, onPendingChange]);
  const { review, onSubmit, onChange } = useMoneyReview(pending, onDraftChange);
  return (
    <form
      key={`${state.ok}-${state.attempt ?? 0}`}
      action={action}
      data-testid="refund-form"
      onSubmit={onSubmit}
      onChangeCapture={onChange}
      className="row row--xs"
    >
      <Input
        disabled={pending}
        name="amount"
        aria-label={t('Сумма возврата')}
        defaultValue={state.values?.amount ?? suggested}
        placeholder={t('сумма')}
        required
        className="inp--w90 inp--sm"
      />
      <Input
        disabled={pending}
        name="reason"
        aria-label={t('Причина возврата')}
        defaultValue={state.values?.reason ?? ''}
        placeholder={t('причина')}
        className="inp--w110 inp--sm"
      />
      {review && (
        <section className="panel" aria-label={t('Проверка возврата')}>
          <b>{t('Проверьте возврат')}</b>
          <p>
            {t('Сумма: {amount} {currency}. Причина: {reason}.', {
              amount: review['amount'] ?? '',
              currency,
              reason: review['reason'] || t('не указана'),
            })}
          </p>
          <p className="hint">{t('Возврат будет проведён после подтверждения.')}</p>
        </section>
      )}
      <Button type="submit" tone="secondary" size="sm" disabled={pending}>
        {pending ? t('Выполняется…') : review ? t('Подтвердить возврат') : t('Проверить возврат')}
      </Button>
      {onCancel && (
        <Button type="button" tone="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t('Отмена')}
        </Button>
      )}
    </form>
  );
}

/**
 * Правка платежа (У1, У5): панель справа, как у кассы. Способ, сумма и примечание; дата платежа остаётся.
 * Групповой платёж (на несколько счетов) здесь не правится: только аннулировать и принять заново.
 */
function EditPaymentDrawer({
  number,
  folio,
  payment,
  onClose,
  onResult,
}: {
  number: string;
  folio: FinanceFolio;
  payment: FinancePaymentLine;
  onClose: () => void;
  onResult: (r: FinanceActionResult) => void;
}) {
  const grouped = payment.paymentAmountMinor !== payment.allocatedMinor;
  const clock = usePropertyClock();
  const t = useT();
  const methods = useContext(MethodsContext);
  const [state, action, pending] = useActionState<FinanceActionResult, FormData>(
    async (prev, fd) => {
      const r = await replacePaymentAction(number, payment.paymentId, prev, fd);
      onResult(r);
      return r;
    },
    INIT,
  );
  return (
    <Overlay open onClose={onClose} title={t('Изменить платёж')} drawer trapFocus>
      {grouped ? (
        <Stack gap="sm" data-testid="payment-edit-grouped">
          <p>
            {t('Платёж {sum} разложен на несколько счетов, на этот счёт легло {part}.', {
              sum: formatMoney(payment.paymentAmountMinor, folio.currency),
              part: formatMoney(payment.allocatedMinor, folio.currency),
            })}
          </p>
          <p className="hint">
            {t('Такой платёж не правится по частям: аннулируйте его и примите заново общим платежом на нужные счета.')}
          </p>
          <Row>
            <Button type="button" tone="secondary" onClick={onClose}>
              {t('Закрыть')}
            </Button>
          </Row>
        </Stack>
      ) : (
        <form
          key={`${state.ok}-${state.attempt ?? 0}`}
          action={action}
          className="stack"
          data-testid="payment-edit-form"
        >
          <input type="hidden" name="currency" value={folio.currency} />
          <p className="hint">
            {t('Прежний платёж останется в списке аннулированным, новый проведётся той же датой ({when}).', {
              when: clock.when(payment.paidAt, t),
            })}
          </p>
          {state.error && <Alert boxed>{state.error}</Alert>}
          <Field label={t('Способ оплаты')}>
            <Select name="method" defaultValue={state.values?.method ?? payment.method}>
              {methods.map(([k, label]) => (
                <option key={k} value={k}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Сумма, {currency}', { currency: folio.currency })}>
            <Input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={state.values?.amount ?? toDecimal(payment.paymentAmountMinor)}
            />
          </Field>
          <Field label={t('Примечание')}>
            <Input name="note" defaultValue={state.values?.note ?? payment.note ?? ''} />
          </Field>
          <div className="settings-service-actions">
            <Button type="button" tone="secondary" onClick={onClose} disabled={pending}>
              {t('Отмена')}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? t('Сохраняю…') : t('Сохранить платёж')}
            </Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}
