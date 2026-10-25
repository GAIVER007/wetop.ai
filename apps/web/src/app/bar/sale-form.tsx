'use client';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { RECOVERY_PHRASES, createRetailRecovery, retailScope, validateRetailDraft } from './retail-recovery';
import { BarContextFields, type BarFormContext } from './context';
import type { BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { barMethodRu } from '@pms/domain';
import { sellBarRetailAction, type BarActionResult } from './actions';
import { useT } from '../../i18n/locale-provider';

const initial: BarActionResult = { error: null, ok: 0 };
// длинные фразы первыми: пометка восстановления склеена из нескольких фраз через точку
const PHRASES = [...RECOVERY_PHRASES].sort((a, b) => b.length - a.length);

/** «Быстрая продажа» одной строкой (макет владельца 09.10.2026): товар, количество, оплата, «Продать».
 * Восстановление никогда не отправляет команду. Повтор вручную сохраняет исходный ключ и payload (D-KEY). */
export function SaleForm({ stock, context, methods, recoveryScope, expiresAt }: { stock: BarStockRow[]; context: BarFormContext; methods: string[]; recoveryScope: string[]; expiresAt: string }) {
  const t = useT();
  // отказы восстановления и пометка прошлой продажи хранятся по-русски, переводятся при показе
  const say = (text: string) => PHRASES.reduce((out, phrase) => out.replaceAll(phrase, t(phrase)), t(text));
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const [controller, setController] = useState<ReturnType<typeof createRetailRecovery> | null>(null);
  const [intent, setIntent] = useState<ReturnType<ReturnType<typeof createRetailRecovery>['read']>>(null);
  const [productId, setProductId] = useState('');
  const active = useRef<ReturnType<typeof createRetailRecovery> | null>(null);
  const submitting = useRef(false);
  const slot = JSON.stringify(recoveryScope);
  // срок сдвигается каждым действием (Q-153 б): форму пересоздаёт только смена сессии в slot, срок читается на месте
  const expiry = useRef(expiresAt);
  expiry.current = expiresAt;
  useEffect(() => {
    try {
      const parts = JSON.parse(slot) as string[];
      const until = Date.parse(expiry.current);
      if (!Number.isFinite(until)) throw new Error(t('Неизвестен срок сессии. Войдите заново.'));
      const next = createRetailRecovery(sessionStorage, retailScope(parts), Date.now, () => crypto.randomUUID(), until, (record) => { if (active.current === next) setIntent(record); });
      const saved = next.read();
      active.current = next;
      setController(next); setIntent(saved); setState(initial);
      setProductId(saved?.payload.productId ?? '');
    } catch {
      active.current = null; setController(null); setIntent(null); setProductId('');
      setState({ error: t('Восстановление ключа недоступно. Сверьте журнал продаж; новая продажа заблокирована.'), ok: 0 });
    }
    return () => { active.current = null; };
  }, [slot]);
  const locked = Boolean(intent) || !controller;
  const unavailableMethod = Boolean(intent && !methods.includes(intent.payload.method));
  const action = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controller || controller !== active.current || submitting.current || intent?.blocked || unavailableMethod || intent?.status === 'confirmed') return;
    submitting.current = true;
    const owner = controller;
    const fd = new FormData(event.currentTarget);
    const payload = intent?.payload ?? {
      productId: String(fd.get('productId') ?? '').trim(),
      quantityUnits: String(fd.get('quantityUnits') ?? '').trim(),
      method: String(fd.get('method') ?? '').trim(),
    };
    setPending(true);
    try {
      if (!intent) validateRetailDraft(payload, stock.filter(item => item.active && BigInt(item.availableUnits) > 0n).map(item => item.id), methods);
      let result = initial;
      const saved = await owner.submit(payload, async (key, original) => {
        fd.set('idempotencyKey', key);
        for (const [name, value] of Object.entries(original)) fd.set(name, value);
        result = await sellBarRetailAction(initial, fd);
        if (result.error) throw new Error(result.error);
      });
      if (active.current !== owner) return;
      setIntent(saved); setState(result);
    } catch (error) {
      if (active.current === owner) setState({ error: say(error instanceof Error ? error.message : String(error)), ok: 0 });
    } finally { submitting.current = false; if (active.current === owner) setPending(false); }
  };
  const selected = stock.find((item) => item.id === productId);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form onSubmit={action} className="bar-quick-form bar-retail-form" onReset={() => setProductId('')}>
    <BarContextFields context={context} />
    <input type="hidden" name="retailRecoveryScope" value={slot} />
    <div className="bar-inline bar-retail-fields">
      <label className="bar-retail-field">
        <span className="bar-retail-label">{t('Товар')}</span>
        <span className="bar-select-search">
          <Icon name="search" width={16} height={16} />
          <Select key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="productId" aria-label={t('Товар')} required defaultValue={intent?.payload.productId ?? ""} onChange={(event) => setProductId(event.target.value)}>
              <option value="" disabled>{t('Выберите товар')}</option>
            {available.map((item) => <option key={item.id} value={item.id}>{t('{name}, остаток {n} шт.', { name: item.name, n: item.availableUnits })}</option>)}
          </Select>
        </span>
      </label>
      <label className="bar-retail-field">
        <span className="bar-retail-label">{t('Количество, шт.')}</span>
        <Input key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="quantityUnits" aria-label={t('Количество, шт.')} inputMode="numeric" pattern="[0-9]+" defaultValue={intent?.payload.quantityUnits ?? "1"} required className="bar-qty" />
      </label>
      {methods.length > 0 ? (
        <label className="bar-retail-field">
          <span className="bar-retail-label">{t('Способ оплаты')}</span>
          {/* способы из настройки объекта (ADR-185): порядок её, выключенных нет */}
          <Select key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="method" aria-label={t('Способ оплаты')} defaultValue={intent?.payload.method ?? methods[0]}>
            {methods.map((method) => <option key={method} value={method}>{t(barMethodRu(method))}</option>)}
          </Select>
        </label>
      ) : (
        <p role="status" className="bar-muted" data-testid="bar-no-methods">{t('В настройках объекта нет способа оплаты, который принимает бар')}</p>
      )}
      {(methods.length > 0 || intent) && <Button type="submit" disabled={pending || !controller || intent?.blocked || unavailableMethod || intent?.status === 'confirmed' || (!intent && available.length === 0)}><Icon name="cart" width={16} height={16} /> {pending ? t('Выполняется…') : intent && intent.status !== 'confirmed' ? t('Повторить с тем же ключом') : t('Продать')}</Button>}
    </div>
    {intent && <section role="region" aria-label={t('Исходная продажа')} data-testid="retail-recovery-panel">
      <h3>{intent.status === 'confirmed' ? t('Исходная продажа: подтверждена') : t('Исходная продажа: нужна сверка')}</h3>
      <dl><dt>{t('Ключ')}</dt><dd>{intent.key}</dd><dt>{t('Товар (исходный ID)')}</dt><dd>{intent.payload.productId}</dd><dt>{t('Количество')}</dt><dd>{intent.payload.quantityUnits}</dd><dt>{t('Способ оплаты')}</dt><dd>{intent.payload.method}</dd></dl>
      {intent.warning && <p>{say(intent.warning)}</p>}
      {unavailableMethod && <p>{t('Исходный способ оплаты отключён. Повтор недоступен. Сверьте исходную продажу с ответственным сотрудником.')}</p>}
      {intent.status !== 'confirmed' && <p>{t('Прошлая продажа могла выполниться, даже если ответ не получен. До сверки результата нельзя менять или сбрасывать её данные. Не создавайте повторную продажу.')}</p>}
    </section>}
    {selected && <p className="bar-retail-product-info"><b>{selected.name}</b><span>{t('В наличии: {n} шт.', { n: selected.availableUnits })}</span></p>}
    <p role="status">{pending ? t('Ожидаем ответ. Не создавайте другую продажу.') : intent?.status === 'confirmed' ? (state.message ?? t('Результат подтверждён.')) : intent ? t('Результат не подтверждён. Повтор использует исходные поля и ключ; если записи нет, сервер выполнит продажу.') : controller ? t('Новая продажа') : t('Восстановление продажи недоступно. Сверьте журнал продаж.')}</p>
    {intent?.status === 'confirmed' && <Button type="button" onClick={() => {
      try { controller?.newIntent(); setIntent(null); setProductId(''); setState(initial); }
      catch { setState({ error: t('Не удалось сохранить состояние. Обновите страницу.'), ok: 0 }); }
    }}>{t('Новая продажа')}</Button>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
  </form>;
}
