'use client';
import { useEffect, useState, useRef, type FormEvent } from 'react';
import { createRetailRecovery, retailScope, validateRetailDraft } from './retail-recovery';
import { BarContextFields, type BarFormContext } from './context';
import type { BarStockRow } from '../../lib/api';
import { Button, Input, Select } from '../../components/ui';
import { Icon } from '../../components/icon';
import { barMethodRu } from '@pms/domain';
import { sellBarRetailAction, type BarActionResult } from './actions';

const initial: BarActionResult = { error: null, ok: 0 };

/** «Быстрая продажа» одной строкой (макет владельца 09.10.2026): товар, количество, оплата, «Продать».
 * Восстановление никогда не отправляет команду. Повтор вручную сохраняет исходный ключ и payload (D-KEY). */
export function SaleForm({ stock, context, methods, recoveryScope, expiresAt }: { stock: BarStockRow[]; context: BarFormContext; methods: string[]; recoveryScope: string[]; expiresAt: string }) {
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
      if (!Number.isFinite(until)) throw new Error('Неизвестен срок сессии. Войдите заново.');
      const next = createRetailRecovery(sessionStorage, retailScope(parts), Date.now, () => crypto.randomUUID(), until, (record) => { if (active.current === next) setIntent(record); });
      const saved = next.read();
      active.current = next;
      setController(next); setIntent(saved); setState(initial);
      setProductId(saved?.payload.productId ?? '');
    } catch {
      active.current = null; setController(null); setIntent(null); setProductId('');
      setState({ error: 'Восстановление ключа недоступно. Сверьте журнал продаж; новая продажа заблокирована.', ok: 0 });
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
      if (active.current === owner) setState({ error: error instanceof Error ? error.message : String(error), ok: 0 });
    } finally { submitting.current = false; if (active.current === owner) setPending(false); }
  };
  const selected = stock.find((item) => item.id === productId);
  const available = stock.filter((item) => item.active && BigInt(item.availableUnits) > 0n);
  return <form onSubmit={action} className="bar-quick-form bar-retail-form" onReset={() => setProductId('')}>
    <BarContextFields context={context} />
    <input type="hidden" name="retailRecoveryScope" value={slot} />
    <div className="bar-inline bar-retail-fields">
      <label className="bar-retail-field">
        <span className="bar-retail-label">Товар</span>
        <span className="bar-select-search">
          <Icon name="search" width={16} height={16} />
          <Select key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="productId" aria-label="Товар" required defaultValue={intent?.payload.productId ?? ""} onChange={(event) => setProductId(event.target.value)}>
              <option value="" disabled>Выберите товар</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}, остаток {item.availableUnits} шт.</option>)}
          </Select>
        </span>
      </label>
      <label className="bar-retail-field">
        <span className="bar-retail-label">Количество, шт.</span>
        <Input key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="quantityUnits" aria-label="Количество, шт." inputMode="numeric" pattern="[0-9]+" defaultValue={intent?.payload.quantityUnits ?? "1"} required className="bar-qty" />
      </label>
      {methods.length > 0 ? (
        <label className="bar-retail-field">
          <span className="bar-retail-label">Способ оплаты</span>
          {/* способы из настройки объекта (ADR-185): порядок её, выключенных нет */}
          <Select key={slot + (intent?.key ?? 'new')} disabled={locked || pending} name="method" aria-label="Способ оплаты" defaultValue={intent?.payload.method ?? methods[0]}>
            {methods.map((method) => <option key={method} value={method}>{barMethodRu(method)}</option>)}
          </Select>
        </label>
      ) : (
        <p role="status" className="bar-muted" data-testid="bar-no-methods">В настройках объекта нет способа оплаты, который принимает бар</p>
      )}
      {(methods.length > 0 || intent) && <Button type="submit" disabled={pending || !controller || intent?.blocked || unavailableMethod || intent?.status === 'confirmed' || (!intent && available.length === 0)}><Icon name="cart" width={16} height={16} /> {pending ? 'Выполняется…' : intent && intent.status !== 'confirmed' ? 'Повторить с тем же ключом' : 'Продать'}</Button>}
    </div>
    {intent && <section role="region" aria-label="Исходная продажа" data-testid="retail-recovery-panel">
      <h3>Исходная продажа: {intent.status === 'confirmed' ? 'подтверждена' : 'нужна сверка'}</h3>
      <dl><dt>Ключ</dt><dd>{intent.key}</dd><dt>Товар (исходный ID)</dt><dd>{intent.payload.productId}</dd><dt>Количество</dt><dd>{intent.payload.quantityUnits}</dd><dt>Способ оплаты</dt><dd>{intent.payload.method}</dd></dl>
      {intent.warning && <p>{intent.warning}</p>}
      {unavailableMethod && <p>Исходный способ оплаты отключён. Повтор недоступен. Сверьте исходную продажу с ответственным сотрудником.</p>}
      {intent.status !== 'confirmed' && <p>Прошлая продажа могла выполниться, даже если ответ не получен. До сверки результата нельзя менять или сбрасывать её данные. Не создавайте повторную продажу.</p>}
    </section>}
    {selected && <p className="bar-retail-product-info"><b>{selected.name}</b><span>В наличии: {selected.availableUnits} шт.</span></p>}
    <p role="status">{pending ? 'Ожидаем ответ. Не создавайте другую продажу.' : intent?.status === 'confirmed' ? (state.message ?? 'Результат подтверждён.') : intent ? 'Результат не подтверждён. Повтор использует исходные поля и ключ; если записи нет, сервер выполнит продажу.' : controller ? 'Новая продажа' : 'Восстановление продажи недоступно. Сверьте журнал продаж.'}</p>
    {intent?.status === 'confirmed' && <Button type="button" onClick={() => {
      try { controller?.newIntent(); setIntent(null); setProductId(''); setState(initial); }
      catch { setState({ error: 'Не удалось сохранить состояние. Обновите страницу.', ok: 0 }); }
    }}>Новая продажа</Button>}
    {state.error && <p role="alert" className="bar-error">{state.error}</p>}
  </form>;
}
