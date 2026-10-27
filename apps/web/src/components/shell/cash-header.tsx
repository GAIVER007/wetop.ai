'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Overlay } from '../overlay';
import { Alert, Button, Field, Input, Select, Textarea } from '../ui';
import { Icon } from '../icon';
import { formatMoney } from '../../lib/money';
import type { CashRegisterView } from '../../lib/cash-register';
import { saveCashiers, sendCashHeader } from './cash-header-actions';
import { CloseShiftForm, OpenShiftForm } from './cash-shift-forms';
import { msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { intlLocale } from '../../i18n';

/** Чтение кассы GET-запросом: серверное действие перерисовало бы страницу и сбросило её несохранённые правки */
async function loadCashHeader(scopeKey: string): Promise<CashRegisterView> {
  const response = await fetch(`/api/cash-register?scope=${encodeURIComponent(scopeKey)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(msg('Не удалось получить кассу'));
  return (await response.json()) as CashRegisterView;
}
import { METHOD_RU } from '../../app/finance/labels';

type Panel = 'open' | 'close' | 'expense' | 'income' | 'summary' | null;
const title = {
  open: msg('Открыть смену'),
  close: msg('Закрыть смену'),
  expense: msg('Добавить расход'),
  income: msg('Внести деньги'),
  summary: msg('Итоги смены'),
};

/** Один экземпляр на проверенный контекст. Состояние смены хранится только на сервере. */
export function CashHeader({
  scopeKey,
  readOnly = false,
}: {
  scopeKey: string;
  readOnly?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
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
  const afterExpense = useRef<Panel>(null);
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
      if (mounted.current) setError(t('Не удалось обновить кассу. Повторите открытие панели'));
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
      setError(t('Предыдущая команда ещё не подтверждена. Повторите её без изменения полей или проверьте результат'));
      return;
    }
    command.current ??= { signature, key: crypto.randomUUID() };
    try {
      const result = await sendCashHeader(scopeKey, { ...body, key: command.current.key });
      if (result.error) {
        if (!result.uncertain) command.current = null;
        throw new Error(t(result.error));
      }
      const data = result.data!;
      command.current = null;
      if (mounted.current) {
        setCash(data);
        setSaved(t('Изменения сохранены'));
        const back = body.action === 'expense' ? afterExpense.current : null;
        afterExpense.current = null;
        setPanel(body.action === 'close' ? 'summary' : back);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? t(e.message) : t('Не удалось сохранить кассу'));
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
        setSaved(t('Права кассиров сохранены'));
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? t(e.message) : t('Не удалось сохранить права'));
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
          <span>{t(METHOD_RU[method] ?? method)}</span>
          <strong>{money(value)}</strong>
        </p>
      ))}
    </section>
  );
  const shiftLabel = failed ? t('Касса недоступна') : !cash ? t('Смена…') : cash.active ? t('Закрыть смену') : t('Открыть смену');
  return (
    <>
      <div className="cash-header" aria-label={t('Кассовая смена')} data-testid="cash-header">
        <Button
          type="button"
          tone="primary"
          disabled={
            busy || (!failed && !cash) || (!failed && (!mayWrite || (!!cash?.active && !owns)))
          }
          aria-label={shiftLabel}
          onClick={() => show(failed ? 'summary' : cash?.active ? 'close' : 'open')}
        >
          <Icon name="clock" />
          <span className="cash-header__label">{shiftLabel}</span>
        </Button>
        <Button
          type="button"
          tone="secondary"
          disabled={!mayWrite || !owns || busy}
          aria-label={t('Добавить расход')}
          className="cash-header__expense"
          onClick={() => show('expense')}
        >
          <Icon name="plus" />
          <span className="cash-header__label">{t('Добавить расход')}</span>
        </Button>
        <Button
          type="button"
          tone="secondary"
          disabled={busy}
          aria-label={t('Итоги смены')}
          onClick={() => show('summary')}
        >
          <Icon name="chart" />
          <span className="cash-header__label">{t('Итоги смены')}</span>
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
          title={t(title[panel])}
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
                  {t('Повторить команду')}
                </Button>
              )}
            </Alert>
          )}
          {saved && (
            <p role="status" className={panel === 'close' ? 'sr-only' : undefined}>
              {saved}
            </p>
          )}
          {!cash ? (
            <p>{t('Не удалось получить кассу выбранного филиала.')}</p>
          ) : (
            <>
              <p className="cash-header__context">
                {panel === 'open' || panel === 'close'
                  ? cash.name
                  : `${cash.name}, ${cash.active ? t('Смена открыта') : t('Смена закрыта')}`}
              </p>
              {(panel === 'open' || panel === 'close') && (
                // на телефоне в шапке только кнопка смены: итоги, расход и внесение открываются отсюда
                <Button
                  type="button"
                  tone="secondary"
                  className="cash-header__summary-link"
                  onClick={() => show('summary')}
                >
                  {t('Итоги смены')}
                </Button>
              )}
              {panel === 'summary' ? (
                <>
                  {totals(t('Остатки по системе'), cash.snapshot.balances)}
                  {cash.active &&
                    BigInt(cash.active.opening.counted) !==
                      BigInt(cash.active.opening.snapshot.balances.CASH ?? '0') && (
                      <Alert boxed>
                        {t('При открытии зафиксировано расхождение: {sum}.', {
                          sum: money(
                            String(
                              BigInt(cash.active.opening.counted) -
                                BigInt(cash.active.opening.snapshot.balances.CASH ?? '0'),
                            ),
                          ),
                        })}{' '}
                        {cash.active.opening.note}
                      </Alert>
                    )}
                  {cash.totals && (
                    <>
                      {totals(t('Получено за смену'), cash.totals.received)}
                      {totals(t('Возвраты за смену'), cash.totals.refunds)}
                      {totals(t('Расходы за смену'), cash.totals.expenses)}
                    </>
                  )}
                  <p>{t('До подтверждения получателем передача денег не уменьшает остаток кассы.')}</p>
                  {cash.handovers.map((h) => (
                    <section key={h.id} className="cash-header__summary">
                      <p>
                        {t('Ожидает передачи:')} <strong>{money(h.amount)}</strong>
                      </p>
                      {h.recipient_id === cash.currentUserId && !readOnly && (
                        <Button
                          disabled={busy}
                          onClick={() => mutate({ action: 'acknowledge', handoverId: h.id })}
                        >
                          {t('Подтвердить получение денег')}
                        </Button>
                      )}
                    </section>
                  ))}
                  {mayWrite && owns && (
                    <div className="cash-header__footer">
                      {/* на телефоне расход открывается отсюда: в шапке только смена и итоги */}
                      <Button tone="secondary" onClick={() => show('expense')}>
                        {t('Добавить расход')}
                      </Button>
                      <Button tone="secondary" onClick={() => show('income')}>
                        {t('Внести деньги')}
                      </Button>
                    </div>
                  )}
                  {!cash.mayOperate && <p>{t('Права кассира выдаёт владелец или управляющий.')}</p>}
                  {cash.active && !owns && (
                    <p>{t('Смена закреплена за другим кассиром. Расход и закрытие доступны ответственному.')}</p>
                  )}
                  {cash.history.map((s) => (
                    <details key={s.id} className="cash-header__summary">
                      <summary>
                        {t('Закрытая смена,')}{' '}
                        {s.closed_at &&
                          new Intl.DateTimeFormat(intlLocale(locale), {
                            timeZone: cash.timezone,
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(s.closed_at))}
                      </summary>
                      {s.closing && (
                        <>
                          <p>
                            {t('По системе')} <strong>{money(s.closing.expected)}</strong>
                          </p>
                          <p>
                            {t('Пересчитано')} <strong>{money(s.closing.counted)}</strong>
                          </p>
                          <p>
                            {t('Расхождение')} <strong>{money(s.closing.difference)}</strong>
                          </p>
                          <p>
                            {t('Оставить')} <strong>{money(s.closing.retained)}</strong>
                          </p>
                          <p>
                            {t('Запланировано к передаче')}{' '}
                            <strong>{money(s.closing.plannedHandover)}</strong>
                          </p>
                          <p>{s.closing.note}</p>
                        </>
                      )}
                    </details>
                  ))}
                  {cash.mayManage && (
                    <details className="cash-header__summary">
                      <summary>{t('Права кассиров')}</summary>
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
                        <Button disabled={busy || readOnly}>{t('Сохранить права')}</Button>
                      </form>
                    </details>
                  )}
                </>
              ) : panel === 'open' ? (
                <OpenShiftForm
                  cash={cash}
                  busy={busy}
                  disabled={!mayWrite}
                  money={money}
                  send={(b) => mutate({ ...b, fingerprint: cash.snapshot.fingerprint })}
                  onCancel={() => setPanel(null)}
                />
              ) : panel === 'close' ? (
                <CloseShiftForm
                  key={cash.snapshot.fingerprint}
                  cash={cash}
                  busy={busy}
                  disabled={!mayWrite || !owns}
                  money={money}
                  send={(b) =>
                    mutate({ ...b, shiftId: cash.active?.id, fingerprint: cash.snapshot.fingerprint })
                  }
                  onCancel={() => setPanel(null)}
                  onExpense={() => {
                    afterExpense.current = 'close';
                    void show('expense');
                  }}
                />
              ) : (
                <form onSubmit={submit}>
                  <p>
                    {t('Наличные по системе:')}{' '}
                    <strong>{money(cash.snapshot.balances.CASH ?? '0')}</strong>
                  </p>
                  {(panel === 'expense' || panel === 'income') && (
                    <>
                      <Field label={t('Сумма')}>
                        <Input
                          name="amount"
                          inputMode="decimal"
                          required
                          autoFocus
                          disabled={busy}
                        />
                      </Field>
                      <Field label={t('Способ оплаты')}>
                        <Select name="method" defaultValue="CASH" disabled={busy}>
                          {(panel === 'income' ? cash.incomeMethods : cash.expenseMethods).map(
                            (method) => (
                              <option value={method} key={method}>
                                {t(METHOD_RU[method] ?? method)}
                              </option>
                            ),
                          )}
                        </Select>
                      </Field>
                      <Field label={t('Статья')}>
                        <Input
                          name="category"
                          list="cash-header-categories"
                          required
                          defaultValue={panel === 'income' ? t('Внесение') : ''}
                          disabled={busy}
                        />
                        <datalist id="cash-header-categories">
                          {[msg('Такси'), msg('Закупка материалов'), msg('Хозяйственные расходы'), msg('Прочее')].map((v) => (
                            <option key={v} value={t(v)} />
                          ))}
                        </datalist>
                      </Field>
                    </>
                  )}
                  <Field label={t('Комментарий')}>
                    <Textarea name="note" rows={3} maxLength={1000} disabled={busy} />
                  </Field>
                  <div className="cash-header__footer">
                    <Button
                      type="button"
                      tone="secondary"
                      disabled={busy}
                      onClick={() => {
                        // расход, начатый из окна закрытия, отменяется обратно в закрытие
                        const back = afterExpense.current;
                        afterExpense.current = null;
                        setPanel(back);
                      }}
                    >
                      {t('Отмена')}
                    </Button>
                    <Button type="submit" disabled={busy || !mayWrite}>
                      {busy ? t('Сохраняю…') : t(title[panel])}
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
  const t = useT();
  return (
    <div className="cash-header" aria-label={t('Кассовая смена, пример')}>
      <Button type="button" tone="primary" disabled>
        <Icon name="clock" />
        {t('Открыть смену')}
      </Button>
      <Button type="button" tone="secondary" disabled>
        <Icon name="plus" />
        {t('Добавить расход')}
      </Button>
      <Button type="button" tone="secondary" disabled>
        <Icon name="chart" />
        {t('Итоги смены')}
      </Button>
    </div>
  );
}
