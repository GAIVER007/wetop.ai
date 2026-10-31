'use client';
import { useState } from 'react';
import { Button, Field, Input, Textarea } from '../ui';
import { inputToMinor, minorToInput } from '../../lib/money';
import type { CashRegisterView } from '../../lib/cash-register';
import { useT } from '../../i18n/locale-provider';
import { msg } from '../../i18n';
import { ShiftPayouts } from './shift-payouts';

/**
 * Окна открытия и закрытия смены (владелец 26.10.2026: открытие «Б», закрытие «А»).
 * Открытие: крупно сумма, которая должна лежать в кассе, и вопрос «Сумма такая же?» с двумя большими кнопками.
 * Закрытие: расчёт «было + наличные − возвраты − расходы = должно быть», пересчёт, остаток на размен, кому сдать.
 * Деньги считаются только целыми минорными единицами (BigInt), сервер пересчитывает всё сам.
 */
type Send = (body: Record<string, unknown>) => void;

const minor = (text: string) => {
  const v = inputToMinor(text);
  return v === null || v === '' ? null : BigInt(v);
};

export function OpenShiftForm({
  cash,
  busy,
  disabled,
  money,
  send,
  onCancel,
}: {
  cash: CashRegisterView;
  busy: boolean;
  disabled: boolean;
  money: (v: string) => string;
  send: Send;
  onCancel: () => void;
}) {
  const t = useT();
  const expected = cash.snapshot.balances.CASH ?? '0';
  const last = cash.history[0];
  const lastBy = last && cash.members.find((m) => m.id === last.responsible_user_id)?.name;
  const [other, setOther] = useState(false);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const countedMinor = minor(counted);
  const diff = countedMinor === null ? null : countedMinor - BigInt(expected);
  const needNote = diff !== null && diff !== 0n;
  return (
    <div className="cash-shift-open" data-testid="cash-open">
      <p className="cash-shift-open__label">{t('В кассе должно быть')}</p>
      <p className="cash-shift-open__sum" data-testid="cash-open-expected">
        {money(expected)}
      </p>
      {last?.closed_at && (
        <p className="cash-shift-open__hint">
          {lastBy ? t('Столько оставил(а) {name}, закрывая прошлую смену', { name: lastBy }) : t('Остаток после прошлой смены')}
        </p>
      )}
      {!other ? (
        <>
          <p className="cash-shift-open__question">{t('Пересчитайте наличные. Сумма такая же?')}</p>
          <div className="cash-shift-open__actions">
            <Button
              type="button"
              tone="primary"
              className="cash-shift-big"
              disabled={busy || disabled}
              onClick={() => send({ action: 'open', counted: minorToInput(expected), note: '' })}
            >
              {busy ? t('Сохраняю…') : t('Да, {sum}. Открыть смену', { sum: money(expected) })}
            </Button>
            <Button
              type="button"
              tone="secondary"
              className="cash-shift-big"
              disabled={busy}
              onClick={() => setOther(true)}
            >
              {t('Нет, другая сумма')}
            </Button>
          </div>
        </>
      ) : (
        <form
          className="cash-shift-form"
          onSubmit={(event) => {
            event.preventDefault();
            send({ action: 'open', counted, note });
          }}
        >
          <Field label={t('Сколько наличных в кассе сейчас')}>
            <Input
              name="counted"
              className="cash-shift-amount"
              inputMode="decimal"
              required
              autoFocus
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              disabled={busy}
            />
          </Field>
          {needNote && (
            <p className="cash-shift-diff" data-tone={diff! < 0n ? 'short' : 'extra'} role="status">
              {diff! < 0n ? t('Не хватает {sum}', { sum: money(String(-diff!)) }) : t('Лишние {sum}', { sum: money(String(diff!)) })}.{' '}
              {t('Напишите почему')}
            </p>
          )}
          {needNote && (
            <Field label={t('Почему сумма другая')}>
              <Textarea
                name="note"
                rows={2}
                maxLength={390}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </Field>
          )}
          <div className="cash-header__footer">
            <Button type="button" tone="secondary" disabled={busy} onClick={() => setOther(false)}>
              {t('Назад')}
            </Button>
            <Button type="submit" disabled={busy || disabled || countedMinor === null}>
              {busy
                ? t('Сохраняю…')
                : countedMinor === null
                  ? t('Открыть смену')
                  : t('Открыть смену с {sum}', { sum: money(String(countedMinor)) })}
            </Button>
          </div>
        </form>
      )}
      {!other && (
        <div className="cash-header__footer">
          <Button type="button" tone="ghost" disabled={busy} onClick={onCancel}>
            {t('Отмена')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function CloseShiftForm({
  cash,
  busy,
  disabled,
  money,
  send,
  onCancel,
  onExpense,
  scopeKey,
  onPaid,
  left,
  setLeft,
}: {
  cash: CashRegisterView;
  busy: boolean;
  disabled: boolean;
  money: (v: string) => string;
  send: Send;
  onCancel: () => void;
  /** Добавить расход; со статьёй кнопки частых статей она уже выбрана в окне расхода */
  onExpense: (category?: string) => void;
  /** Выплаты мастерам дня (вариант A владельца 30.10.2026); без него окно как раньше */
  scopeKey?: string;
  /** выплата прошла: касса перечитывается, «должно быть в кассе» уменьшается */
  onPaid?: () => void;
  /** отметки «Не забрал» из шапки кассы: переживают пересоздание окна */
  left?: ReadonlySet<string>;
  setLeft?: (update: (s: ReadonlySet<string>) => ReadonlySet<string>) => void;
}) {
  const t = useT();
  const [unpaid, setUnpaid] = useState<Array<{ name: string; amountMinor: string }>>([]);
  const expected = BigInt(cash.snapshot.balances.CASH ?? '0');
  const opened = BigInt(cash.active?.opening.counted ?? '0');
  const received = BigInt(cash.totals?.received.CASH ?? '0');
  const refunds = BigInt(cash.totals?.refunds.CASH ?? '0');
  const expenses = BigInt(cash.totals?.expenses.CASH ?? '0');
  // внесения и поправки, которых нет в трёх строках выше: строка видна, только если она не ноль
  const other = expected - (opened + received - refunds - expenses);
  const [counted, setCounted] = useState('');
  const [retained, setRetained] = useState(minorToInput(String(expected)));
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const countedMinor = minor(counted);
  const retainedMinor = minor(retained);
  const diff = countedMinor === null ? null : countedMinor - expected;
  const handover =
    countedMinor !== null && retainedMinor !== null && retainedMinor <= countedMinor
      ? countedMinor - retainedMinor
      : null;
  const recipients = cash.members.filter((m) => m.id !== cash.currentUserId);
  const ready =
    countedMinor !== null &&
    handover !== null &&
    (diff === 0n || note.trim() !== '') &&
    (handover === 0n || recipient !== '');
  const row = (label: string, value: bigint, sign = '') => (
    <p>
      <span>{t(label)}</span>
      <strong>
        {sign}
        {money(String(value))}
      </strong>
    </p>
  );
  return (
    <form
      className="cash-shift-form cash-shift-close"
      data-testid="cash-close"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) send({ action: 'close', counted, retained, recipientId: recipient, note });
      }}
    >
      {/* сначала выплаты мастерам дня: раздела нет, если сегодня никому не платить (владелец 30.10.2026) */}
      {scopeKey && left && setLeft && (
        <ShiftPayouts scopeKey={scopeKey} money={money} disabled={busy || disabled} onPaid={() => onPaid?.()} onLeft={setUnpaid} left={left} setLeft={setLeft} />
      )}
      <section className="cash-shift-calc" aria-label={t('Расчёт наличных за смену')}>
        {row(msg('Было на открытии'), opened)}
        {row(msg('Оплаты наличными'), received, '+ ')}
        {refunds > 0n && row(msg('Возвраты наличными'), refunds, '− ')}
        <div className="cash-shift-calc__expenses">
          {row(msg('Расходы за смену'), expenses, '− ')}
          {/* вариант B (владелец 28.10.2026): каждый расход смены видно со статьёй */}
          {!!cash.shiftExpenses?.length && (
            <ul className="cash-shift-expenses" data-testid="cash-close-expenses">
              {cash.shiftExpenses.map((e, i) => (
                <li key={i}>
                  <span>{t(e.category)}</span>
                  <strong>{money(e.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
          {/* забытый расход дописывается отсюда одним касанием частой статьи (вариант A, 29.10.2026) */}
          <span className="cash-money-form__label">{t('Забыли расход?')}</span>
          <div className="cash-shift-chips" role="group" aria-label={t('Добавить расход')} data-testid="cash-close-chips">
            {(cash.expenseCategories?.length
              ? cash.expenseCategories
              : [msg('Такси'), msg('Закупка материалов'), msg('Хозяйственные расходы'), msg('Прочее')]
            )
              .slice(0, 4)
              .map((c) => (
                <button type="button" key={c} className="cash-header__chip" disabled={busy || disabled} onClick={() => onExpense(t(c))}>
                  + {t(c)}
                </button>
              ))}
            <button type="button" className="cash-header__chip" disabled={busy || disabled} onClick={() => onExpense()}>
              + {t('Другое')}
            </button>
          </div>
        </div>
        {other !== 0n && row(msg('Внесения и поправки'), other < 0n ? -other : other, other < 0n ? '− ' : '+ ')}
        <p className="cash-shift-calc__total">
          <span>{t('Должно быть в кассе')}</span>
          <strong data-testid="cash-close-expected">{money(String(expected))}</strong>
        </p>
      </section>
      <div className="cash-shift-pair">
        <Field label={t('Пересчитали наличные')}>
          <Input
            name="counted"
            className="cash-shift-amount"
            inputMode="decimal"
            required
            autoFocus
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label={t('Оставить на размен')}>
          <Input
            name="retained"
            className="cash-shift-amount"
            inputMode="decimal"
            required
            value={retained}
            onChange={(e) => setRetained(e.target.value)}
            disabled={busy}
          />
        </Field>
      </div>
      {diff !== null && (
        <p className="cash-shift-diff" data-tone={diff === 0n ? 'ok' : diff < 0n ? 'short' : 'extra'} role="status">
          {diff === 0n
            ? t('Сходится ✓')
            : diff < 0n
              ? t('Не хватает {sum}', { sum: money(String(-diff)) })
              : t('Лишние {sum}', { sum: money(String(diff)) })}
          {handover !== null && handover > 0n && t(', сдаёте {sum}', { sum: money(String(handover)) })}
          {handover === 0n && t(', всё остаётся в кассе')}
          {handover === null && retainedMinor !== null && t('. Оставить можно не больше пересчитанного')}
        </p>
      )}
      {diff !== null && diff !== 0n && (
        <Field label={t('Почему сумма другая')}>
          <Textarea
            name="note"
            rows={2}
            maxLength={390}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
        </Field>
      )}
      {handover !== null && handover > 0n && (
        <fieldset className="cash-shift-recipients">
          <legend>{t('Кому сдаёте {sum}', { sum: money(String(handover)) })}</legend>
          {recipients.length === 0 && <p>{t('Нет другого сотрудника, который может принять деньги. Оставьте всю сумму в кассе.')}</p>}
          {recipients.map((m) => (
            <Button
              key={m.id}
              type="button"
              tone="secondary"
              aria-pressed={recipient === m.id}
              disabled={busy}
              onClick={() => setRecipient(m.id)}
            >
              {m.name}
            </Button>
          ))}
        </fieldset>
      )}
      {unpaid.length > 0 && (
        <p className="cash-header__note" data-testid="cash-close-unpaid">
          {t('Не забрали сегодня: {list}. Сумма копится в «Зарплате» и попадёт в отчёт.', {
            list: unpaid.map((u) => `${u.name} ${money(u.amountMinor)}`).join(', '),
          })}
        </p>
      )}
      <div className="cash-header__footer">
        <Button type="button" tone="secondary" disabled={busy} onClick={onCancel}>
          {t('Отмена')}
        </Button>
        <Button type="submit" disabled={busy || disabled || !ready}>
          {busy ? t('Сохраняю…') : t('Закрыть смену')}
        </Button>
      </div>
    </form>
  );
}
