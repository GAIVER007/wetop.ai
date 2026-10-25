'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Overlay } from '../overlay';
import { Alert, Button, Field, Input, Select, Textarea } from '../ui';
import { Icon } from '../icon';
import { formatMoney, minorToInput } from '../../lib/money';
import type { CashRegisterView } from '../../lib/cash-register';
import { loadCashHeader, saveCashiers, sendCashHeader } from './cash-header-actions';
import { METHOD_RU } from '../../app/finance/labels';

type Panel = 'open' | 'close' | 'expense' | 'income' | 'summary' | null;
const title = {
  open: 'Открыть смену',
  close: 'Закрыть смену',
  expense: 'Добавить расход',
  income: 'Внести деньги',
  summary: 'Итоги смены',
};

/** Один экземпляр на проверенный контекст. Состояние смены хранится только на сервере. */
export function CashHeader({
  scopeKey,
  readOnly = false,
}: {
  scopeKey: string;
  readOnly?: boolean;
}) {
  const [cash, setCash] = useState<CashRegisterView | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [failed, setFailed] = useState(false);
  const pending = useRef(false),
    mounted = useRef(true);
  // После неопределённого сетевого результата повторяется тот же ключ и то же тело.
  const command = useRef<{ signature: string; key: string } | null>(null);
  const initialLoad = useRef<{ scopeKey: string; promise: Promise<CashRegisterView> } | null>(null);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    if (initialLoad.current?.scopeKey !== scopeKey)
      initialLoad.current = { scopeKey, promise: loadCashHeader(scopeKey) };
    initialLoad.current.promise
      .then((data) => {
        if (current) setCash(data);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [scopeKey]);
  const money = (v: string) => formatMoney(v, cash?.currency ?? 'KZT');
  const owns = !!cash?.active && cash.active.responsible_user_id === cash.currentUserId;
  const mayWrite = !!cash?.mayOperate && !readOnly;
  async function show(next: Panel) {
    setError('');
    setSaved('');
    setPanel(next);
    try {
      const data = await loadCashHeader(scopeKey);
      if (mounted.current) {
        setCash(data);
        setFailed(false);
      }
    } catch {
      if (mounted.current) setError('Не удалось обновить кассу. Повторите открытие панели');
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !cash) return;
    const fd = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      action: panel,
      shiftId: cash.active?.id,
      fingerprint: cash.snapshot.fingerprint,
    };
    for (const [key, value] of fd.entries()) if (typeof value === 'string') body[key] = value;
    await mutate(body);
  }
  async function mutate(body: Record<string, unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const signature = JSON.stringify(body);
    if (command.current && command.current.signature !== signature) {
      pending.current = false;
      setBusy(false);
      setError(
        'Предыдущая команда ещё не подтверждена. Повторите её без изменения полей или проверьте результат',
      );
      return;
    }
    command.current ??= { signature, key: crypto.randomUUID() };
    try {
      const result = await sendCashHeader(scopeKey, { ...body, key: command.current.key });
      if (result.error) {
        if (!result.uncertain) command.current = null;
        throw new Error(result.error);
      }
      const data = result.data!;
      command.current = null;
      if (mounted.current) {
        setCash(data);
        setSaved('Изменения сохранены');
        setPanel(body.action === 'close' ? 'summary' : null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Не удалось сохранить кассу');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const fd = new FormData(event.currentTarget);
    try {
      const data = await saveCashiers(
        scopeKey,
        fd.getAll('cashier').filter((v): v is string => typeof v === 'string'),
      );
      if (mounted.current) {
        setCash(data);
        setSaved('Права кассиров сохранены');
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Не удалось сохранить права');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const totals = (label: string, values: Record<string, string>) => (
    <section className="cash-header__summary">
      <h3>{label}</h3>
      {Object.entries(values).map(([method, value]) => (
        <p key={method}>
          <span>{METHOD_RU[method] ?? method}</span>
          <strong>{money(value)}</strong>
        </p>
      ))}
    </section>
  );
  return (
    <>
      <div className="cash-header" aria-label="Кассовая смена" data-testid="cash-header">
        <Button
          type="button"
          tone="primary"
          disabled={
            busy || (!failed && !cash) || (!failed && (!mayWrite || (!!cash?.active && !owns)))
          }
          onClick={() => show(failed ? 'summary' : cash?.active ? 'close' : 'open')}
        >
          <Icon name="clock" />
          {failed
            ? 'Касса недоступна'
            : !cash
              ? 'Смена…'
              : cash.active
                ? 'Закрыть смену'
                : 'Открыть смену'}
        </Button>
        <Button
          type="button"
          tone="secondary"
          disabled={!mayWrite || !owns || busy}
          onClick={() => show('expense')}
        >
          <Icon name="plus" />
          Добавить расход
        </Button>
        <Button type="button" tone="secondary" disabled={busy} onClick={() => show('summary')}>
          <Icon name="chart" />
          Итоги смены
        </Button>
        <span className="sr-only" role="status">
          {saved}
        </span>
      </div>
      {panel && (
        <Overlay
          open
          drawer
          trapFocus
          title={title[panel]}
          onClose={() => {
            if (!busy) setPanel(null);
          }}
          className="cash-header-drawer"
        >
          {error && (
            <Alert boxed>
              {error}
              {command.current && (
                <Button
                  type="button"
                  tone="secondary"
                  disabled={busy}
                  onClick={() =>
                    mutate(JSON.parse(command.current!.signature) as Record<string, unknown>)
                  }
                >
                  Повторить команду
                </Button>
              )}
            </Alert>
          )}
          {saved && <p role="status">{saved}</p>}
          {!cash ? (
            <p>Не удалось получить кассу выбранного филиала.</p>
          ) : (
            <>
              <p className="cash-header__context">
                {cash.name}, {cash.active ? 'Смена открыта' : 'Смена закрыта'}
              </p>
              {panel === 'summary' ? (
                <>
                  {totals('Остатки по системе', cash.snapshot.balances)}
                  {cash.active &&
                    BigInt(cash.active.opening.counted) !==
                      BigInt(cash.active.opening.snapshot.balances.CASH ?? '0') && (
                      <Alert boxed>
                        При открытии зафиксировано расхождение:{' '}
                        {money(
                          String(
                            BigInt(cash.active.opening.counted) -
                              BigInt(cash.active.opening.snapshot.balances.CASH ?? '0'),
                          ),
                        )}
                        . {cash.active.opening.note}
                      </Alert>
                    )}
                  {cash.totals && (
                    <>
                      {totals('Получено за смену', cash.totals.received)}
                      {totals('Возвраты за смену', cash.totals.refunds)}
                      {totals('Расходы за смену', cash.totals.expenses)}
                    </>
                  )}
                  <p>До подтверждения получателем передача денег не уменьшает остаток кассы.</p>
                  {cash.handovers.map((h) => (
                    <section key={h.id} className="cash-header__summary">
                      <p>
                        Ожидает передачи: <strong>{money(h.amount)}</strong>
                      </p>
                      {h.recipient_id === cash.currentUserId && !readOnly && (
                        <Button
                          disabled={busy}
                          onClick={() => mutate({ action: 'acknowledge', handoverId: h.id })}
                        >
                          Подтвердить получение денег
                        </Button>
                      )}
                    </section>
                  ))}
                  {mayWrite && owns && (
                    <Button tone="secondary" onClick={() => show('income')}>
                      Внести деньги
                    </Button>
                  )}
                  {!cash.mayOperate && <p>Права кассира выдаёт владелец или управляющий.</p>}
                  {cash.active && !owns && (
                    <p>
                      Смена закреплена за другим кассиром. Расход и закрытие доступны
                      ответственному.
                    </p>
                  )}
                  {cash.history.map((s) => (
                    <details key={s.id} className="cash-header__summary">
                      <summary>
                        Закрытая смена,{' '}
                        {s.closed_at &&
                          new Intl.DateTimeFormat('ru-RU', {
                            timeZone: cash.timezone,
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(s.closed_at))}
                      </summary>
                      {s.closing && (
                        <>
                          <p>
                            По системе <strong>{money(s.closing.expected)}</strong>
                          </p>
                          <p>
                            Пересчитано <strong>{money(s.closing.counted)}</strong>
                          </p>
                          <p>
                            Расхождение <strong>{money(s.closing.difference)}</strong>
                          </p>
                          <p>
                            Оставить <strong>{money(s.closing.retained)}</strong>
                          </p>
                          <p>
                            Запланировано к передаче{' '}
                            <strong>{money(s.closing.plannedHandover)}</strong>
                          </p>
                          <p>{s.closing.note}</p>
                        </>
                      )}
                    </details>
                  ))}
                  {cash.mayManage && (
                    <details className="cash-header__summary">
                      <summary>Права кассиров</summary>
                      <form onSubmit={grant}>
                        {cash.members.map((member) => (
                          <label className="cash-header__cashier" key={member.id}>
                            <input
                              type="checkbox"
                              name="cashier"
                              value={member.id}
                              defaultChecked={cash.cashierIds.includes(member.id)}
                            />
                            {member.name}
                          </label>
                        ))}
                        <Button disabled={busy || readOnly}>Сохранить права</Button>
                      </form>
                    </details>
                  )}
                </>
              ) : (
                <form onSubmit={submit}>
                  <p>
                    Наличные по системе:{' '}
                    <strong>{money(cash.snapshot.balances.CASH ?? '0')}</strong>
                  </p>
                  {(panel === 'open' || panel === 'close') && (
                    <Field label="Фактически пересчитано">
                      <Input
                        name="counted"
                        inputMode="decimal"
                        required
                        autoFocus
                        disabled={busy}
                      />
                    </Field>
                  )}
                  {panel === 'close' && (
                    <>
                      <Field label="Оставить в кассе">
                        <Input
                          name="retained"
                          inputMode="decimal"
                          required
                          defaultValue={minorToInput(cash.snapshot.balances.CASH ?? '0')}
                          disabled={busy}
                        />
                      </Field>
                      <Field label="Кто примет деньги">
                        <Select name="recipientId" defaultValue="" disabled={busy}>
                          <option value="">Без передачи (вся сумма остаётся)</option>
                          {cash.members
                            .filter((m) => m.id !== cash.currentUserId)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                      <p>
                        Закрытие создаёт запрос передачи. Деньги считаются сданными после
                        подтверждения получателем.
                      </p>
                    </>
                  )}
                  {(panel === 'expense' || panel === 'income') && (
                    <>
                      <Field label="Сумма">
                        <Input
                          name="amount"
                          inputMode="decimal"
                          required
                          autoFocus
                          disabled={busy}
                        />
                      </Field>
                      <Field label="Способ оплаты">
                        <Select name="method" defaultValue="CASH" disabled={busy}>
                          {[
                            'CASH',
                            'CARD_TERMINAL',
                            'KASPI',
                            'HALYK',
                            'BANK_TRANSFER_PERSON',
                            'BANK_TRANSFER_LEGAL',
                          ].map((method) => (
                            <option value={method} key={method}>
                              {METHOD_RU[method] ?? method}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Статья">
                        <Input
                          name="category"
                          list="cash-header-categories"
                          required
                          defaultValue={panel === 'income' ? 'Внесение' : ''}
                          disabled={busy}
                        />
                        <datalist id="cash-header-categories">
                          {['Такси', 'Закупка материалов', 'Хозяйственные расходы', 'Прочее'].map(
                            (v) => (
                              <option key={v} value={v} />
                            ),
                          )}
                        </datalist>
                      </Field>
                    </>
                  )}
                  <Field label="Комментарий (обязателен при расхождении)">
                    <Textarea name="note" rows={3} maxLength={1000} disabled={busy} />
                  </Field>
                  <div className="cash-header__footer">
                    <Button
                      type="button"
                      tone="secondary"
                      disabled={busy}
                      onClick={() => setPanel(null)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={busy || !mayWrite}>
                      {busy ? 'Сохраняю…' : title[panel]}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </Overlay>
      )}
    </>
  );
}

/** Disabled visual reference for /design-system, without loading a real register. */
export function CashHeaderPreview() {
  return (
    <div className="cash-header" aria-label="Кассовая смена, пример">
      <Button type="button" tone="primary" disabled>
        <Icon name="clock" />
        Открыть смену
      </Button>
      <Button type="button" tone="secondary" disabled>
        <Icon name="plus" />
        Добавить расход
      </Button>
      <Button type="button" tone="secondary" disabled>
        <Icon name="chart" />
        Итоги смены
      </Button>
    </div>
  );
}
