'use client';
import { useActionState, useState } from 'react';
import {
  formatMinor,
  type FinanceFolio,
  type ReservationFinance,
  type ServiceOption,
} from '../../../lib/api';
import {
  addChargeAction,
  closeFolioAction,
  payAction,
  refundAction,
  voidChargeAction,
  type FinanceActionResult,
  stayExtraAction,
} from './finance-actions';

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
    <div style={{ display: 'grid', gap: 14 }}>
      {finance.folios.length > 1 && (
        <div style={{ fontSize: 14 }} data-testid="finance-total">
          Итого по брони: начислено {formatMinor(finance.chargedMinor, finance.currency)}, оплачено{' '}
          {formatMinor(finance.paidMinor, finance.currency)}, возвращено{' '}
          {formatMinor(finance.refundedMinor, finance.currency)} →{' '}
          <Balance minor={finance.balanceMinor} currency={finance.currency} />
        </div>
      )}
      {finance.folios.map((f) => (
        <FolioPanel key={f.id} number={number} folio={f} services={services} today={today} />
      ))}
    </div>
  );
}

function Balance({ minor, currency }: { minor: string; currency: string }) {
  const n = BigInt(minor);
  const color = n > 0n ? '#b45309' : n < 0n ? '#1d4ed8' : '#15803d';
  const label = n > 0n ? 'к оплате' : n < 0n ? 'переплата' : 'оплачено';
  return (
    <b style={{ color }} data-testid="folio-balance">
      {formatMinor(minor, currency)} · {label}
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
  const [chargeState, chargeAction, chargePending] = useActionState<FinanceActionResult, FormData>(
    addChargeAction.bind(null, number, folio.id),
    INIT,
  );
  const [payState, payFormAction, payPending] = useActionState<FinanceActionResult, FormData>(
    payAction.bind(null, number, folio.id),
    INIT,
  );
  const [other, setOther] = useState<FinanceActionResult>(INIT);
  const [kind, setKind] = useState('SERVICE');
  const open = folio.status === 'OPEN';
  const balance = BigInt(folio.balanceMinor);
  const error = chargeState.error ?? payState.error ?? other.error;
  return (
    <section style={box} data-testid="folio-panel">
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>
          Счёт: {folio.stay.accommodationTypeName}, {folio.stay.arrivalDate} →{' '}
          {folio.stay.departureDate}
        </b>
        {!open && (
          // Без подписи закрытый счёт выглядел просто как счёт без форм: администратор не понимал,
          // почему нельзя ни начислить, ни принять оплату
          <span
            data-testid="folio-closed"
            style={{
              fontSize: 12,
              color: '#374151',
              background: '#e5e7eb',
              borderRadius: 4,
              padding: '2px 8px',
            }}
          >
            счёт закрыт — гость рассчитался и выехал
          </span>
        )}
        <span style={{ color: '#666', fontSize: 13 }}>
          начислено {formatMinor(folio.chargedMinor, folio.currency)} · оплачено{' '}
          {formatMinor(folio.paidMinor, folio.currency)}
          {folio.refundedMinor !== '0'
            ? ` · возвращено ${formatMinor(folio.refundedMinor, folio.currency)}`
            : ''}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Balance minor={folio.balanceMinor} currency={folio.currency} />
        </span>
      </div>

      <table style={table}>
        <thead>
          <tr>
            {['Начисление', 'Дата', 'Кол-во × цена', 'Сумма', ''].map((h) => (
              <th key={h} style={th}>
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
              style={c.voidedAt ? { color: '#999', textDecoration: 'line-through' } : undefined}
            >
              <td style={td}>
                <span style={{ color: '#666', fontSize: 12 }}>{KIND_RU[c.kind] ?? c.kind} · </span>
                {c.description}
              </td>
              <td style={td}>{c.serviceDate ?? '—'}</td>
              <td style={td}>
                {c.quantity} × {formatMinor(c.unitPriceMinor, folio.currency)}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>
                {formatMinor(c.amountMinor, folio.currency)}
              </td>
              <td style={td}>
                {open && !c.voidedAt && c.kind !== 'ACCOMMODATION' && (
                  <button
                    type="button"
                    data-testid={`void-${c.id}`}
                    onClick={async () => setOther(await voidChargeAction(number, c.id))}
                    style={{ ...btnSecondary, color: '#b91c1c' }}
                  >
                    сторно
                  </button>
                )}
                {c.voidedAt && <span style={{ fontSize: 12 }}>сторнировано</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {folio.payments.length > 0 && (
        <table style={table}>
          <thead>
            <tr>
              {['Платёж', 'Когда', 'На этот счёт', 'Возвращено', 'Возврат'].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {folio.payments.map((p) => (
              <tr key={p.paymentId} data-testid="payment-row">
                <td style={td}>
                  {methodRu(p.method)}
                  {p.note ? ` · ${p.note}` : ''}
                  {p.externalReference ? ` · ${p.externalReference}` : ''}
                  {p.status === 'VOIDED' ? ' · аннулирован' : ''}
                </td>
                <td style={td}>{p.paidAt.slice(0, 10)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {formatMinor(p.allocatedMinor, folio.currency)}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {formatMinor(p.refundedMinor, folio.currency)}
                </td>
                <td style={td}>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {folio.refunds.length > 0 && (
        <div style={{ fontSize: 13, color: '#444' }}>
          Возвраты:{' '}
          {folio.refunds
            .map(
              (r) =>
                `${formatMinor(r.amountMinor, folio.currency)} (${r.createdAt.slice(0, 10)}${r.reason ? `, ${r.reason}` : ''})`,
            )
            .join('; ')}
        </div>
      )}

      {open && (
        <div style={{ display: 'grid', gap: 8 }}>
          <form
            key={`c${chargeState.ok}`}
            action={chargeAction}
            data-testid="charge-form"
            style={row}
          >
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} style={inp}>
              <option value="SERVICE">услуга</option>
              <option value="PENALTY">штраф</option>
              <option value="ADJUSTMENT">корректировка</option>
            </select>
            {kind === 'SERVICE' ? (
              <select name="serviceCode" style={inp} defaultValue={services[0]?.code}>
                {services.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.group ? `${s.group}: ` : ''}
                    {s.nameRu} — {formatMinor(s.priceMinor, folio.currency)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="description"
                placeholder="за что"
                required
                style={{ ...inp, minWidth: 180 }}
              />
            )}
            <input
              name="quantity"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              style={{ ...inp, width: 64 }}
              title="количество"
            />
            {kind !== 'SERVICE' && (
              <input
                name="unitPrice"
                placeholder={kind === 'ADJUSTMENT' ? 'сумма (можно −)' : 'сумма'}
                required
                style={{ ...inp, width: 120 }}
              />
            )}
            <input name="serviceDate" type="date" defaultValue={today} style={inp} />
            <button type="submit" disabled={chargePending} style={btn}>
              Начислить
            </button>
          </form>
          <form
            key={`p${payState.ok}-${folio.balanceMinor}`}
            action={payFormAction}
            data-testid="payment-form"
            style={row}
          >
            <select name="method" defaultValue="CASH" style={inp}>
              {METHODS.filter(([k]) => k !== 'EXTERNAL').map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
            <input
              name="amount"
              placeholder="сумма"
              required
              defaultValue={balance > 0n ? toDecimal(folio.balanceMinor) : ''}
              style={{ ...inp, width: 120 }}
            />
            <input name="note" placeholder="примечание" style={inp} />
            <button type="submit" disabled={payPending} style={{ ...btn, background: '#15803d' }}>
              Принять оплату
            </button>
          </form>
          {/* ADR-021: ранний заезд и поздний выезд — услуга одной кнопкой, половина ночи по умолчанию */}
          <div style={row}>
            {(
              [
                ['EARLY_CHECK_IN', 'Ранний заезд', 'early-check-in'],
                ['LATE_CHECK_OUT', 'Поздний выезд', 'late-check-out'],
              ] as const
            ).map(([extra, label, testId]) => (
              <button
                key={extra}
                type="button"
                data-testid={`${testId}-${folio.id}`}
                title="Услуга на счёт: половина цены ночи этого проживания"
                onClick={async () => {
                  if (!window.confirm(`Начислить «${label}»: половина цены ночи этого проживания?`))
                    return;
                  setOther(await stayExtraAction(number, folio.id, extra));
                }}
                style={{ ...btnSecondary }}
              >
                {label}
              </button>
            ))}
          </div>
          {balance === 0n && (
            // Закрыть вручную можно только рассчитанный счёт; с долгом или переплатой API откажет
            <div style={row}>
              <button
                type="button"
                data-testid={`close-folio-${folio.id}`}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Закрыть счёт? Начислять и принимать оплату по нему будет нельзя.',
                    )
                  )
                    return;
                  setOther(await closeFolioAction(number, folio.id));
                }}
                style={btnSecondary}
              >
                Закрыть счёт
              </button>
              <span style={{ fontSize: 12, color: '#666' }}>
                баланс нулевой — счёт можно закрыть, если начислений больше не будет
              </span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}
    </section>
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
    <form key={state.ok} action={action} data-testid="refund-form" style={{ ...row, gap: 4 }}>
      <input
        name="amount"
        placeholder="сумма"
        required
        style={{ ...inp, width: 90, fontSize: 13 }}
      />
      <input name="reason" placeholder="причина" style={{ ...inp, width: 110, fontSize: 13 }} />
      <button type="submit" disabled={pending} style={btnSecondary}>
        вернуть
      </button>
    </form>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: 12,
  display: 'grid',
  gap: 10,
};
const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid #e3e5e8',
  fontSize: 12,
  color: '#666',
};
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f0f1f3' };
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '7px 12px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};
