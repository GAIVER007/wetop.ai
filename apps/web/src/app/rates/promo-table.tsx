'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { PromoCodeRow } from '../../lib/api';
import { promoPeriodText, promoUsesText } from '../../lib/rate-rule-text';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, EmptyState, Field, Input, Table } from '../../components/ui';
import { createPromoCode, setPromoActive, type PromoActionResult } from './actions';
import '../inventory/fund.css';

/**
 * Промокоды объекта (D4, DATA_MODEL §20): таблица, «Добавить промокод» панелью справа, «Выключить» и «Включить» в
 * строке. Процент после создания не меняется — так решено в API (скидка пересчитывается в проживаниях брони). В «только
 * чтении» — таблица без кнопок.
 */
export function PromoTable({ promos, editable }: { promos: PromoCodeRow[]; editable: boolean }) {
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <section className="settings-catalog rates-plans" aria-label="Промокоды">
      <span
        className="settings-save-state settings-save-state--saved"
        role="status"
        data-testid="promo-saved"
      >
        {saved ? `✓ ${saved}` : ''}
      </span>
      {editable && (
        <div className="rates-toolbar">
          <Button
            type="button"
            onClick={() => {
              setSaved(null);
              setCreating(true);
            }}
          >
            <Icon name="plus" />
            Добавить промокод
          </Button>
        </div>
      )}
      {promos.length === 0 ? (
        <EmptyState data-testid="promo-empty" title="Промокодов ещё нет">
          Промокод — короткий код со скидкой, который гость вводит при бронировании на сайте или которому
          вы называете скидку при брони на стойке.
        </EmptyState>
      ) : (
        <Table data-testid="promo-table" className="settings-table">
          <thead>
            <tr>
              <th>Код</th>
              <th className="num">Скидка</th>
              <th className="settings-col-wide">Период проживания</th>
              <th className="num">Использований</th>
              <th className="settings-col-wide">Статус</th>
              {editable && <th className="settings-col-wide" aria-label="Действия" />}
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.code}>
                <td>
                  <b>{p.code}</b>
                  <span className="cell-sub rates-plans-sub">
                    {promoPeriodText(p.stayFrom, p.stayTo)}
                    <Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'действует' : 'не действует'}</Badge>
                    {editable && <ToggleForm promo={p} />}
                  </span>
                </td>
                <td className="num">{p.discountPercent}%</td>
                <td className="settings-col-wide">{promoPeriodText(p.stayFrom, p.stayTo)}</td>
                <td className="num">{promoUsesText(p.uses, p.maxUses)}</td>
                <td className="settings-col-wide">
                  <Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'действует' : 'не действует'}</Badge>
                </td>
                {/* на телефоне столбец скрыт — та же кнопка стоит в первой ячейке */}
                {editable && (
                  <td className="settings-col-wide">
                    <ToggleForm promo={p} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {creating && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title="Новый промокод"
          onClose={() => setCreating(false)}
        >
          <PromoForm
            onCancel={() => setCreating(false)}
            onSaved={(text) => {
              setSaved(text);
              setCreating(false);
            }}
          />
        </Overlay>
      )}
    </section>
  );
}

function ToggleForm({ promo }: { promo: PromoCodeRow }) {
  return (
    <form action={setPromoActive}>
      <input type="hidden" name="code" value={promo.code} />
      <input type="hidden" name="active" value={promo.active ? 'false' : 'true'} />
      <Button type="submit" tone="secondary">
        {promo.active ? 'Выключить' : 'Включить'}
      </Button>
    </form>
  );
}

function PromoForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (text: string) => void }) {
  const [state, action, pending] = useActionState<PromoActionResult | null, FormData>(createPromoCode, null);
  const reported = useRef<PromoActionResult | null>(null);
  useEffect(() => {
    if (!state?.saved || reported.current === state) return;
    reported.current = state;
    onSaved(`Промокод ${state.saved.code} добавлен`);
  }, [state, onSaved]);
  // Поля управляемые: после отказа API форма с серверным действием сбрасывается, а введённое терять нельзя
  const [v, setV] = useState({ code: '', discountPercent: '', stayFrom: '', stayTo: '', maxUses: '' });
  const bind = (key: keyof typeof v) => ({
    name: key,
    value: v[key],
    onChange: (e: { target: { value: string } }) => setV((prev) => ({ ...prev, [key]: e.target.value })),
  });
  return (
    <form action={action} className="settings-service-form" data-testid="promo-form">
      {state?.error && <Alert boxed>{state.error}</Alert>}
      <Field label="Код">
        <Input {...bind('code')} required maxLength={32} autoComplete="off" />
      </Field>
      <Field label="Скидка, %">
        <Input {...bind('discountPercent')} inputMode="numeric" />
      </Field>
      <Field label="Проживание с">
        <Input {...bind('stayFrom')} type="date" />
      </Field>
      <Field label="Проживание по">
        <Input {...bind('stayTo')} type="date" />
      </Field>
      <Field label="Использований не больше">
        <Input {...bind('maxUses')} inputMode="numeric" />
      </Field>
      <p className="settings-note">
        Код записывается заглавными латинскими буквами, цифрами, «-» и «_». Даты — первая и последняя ночь проживания,
        пустое поле — без границы. Процент после создания не меняется.
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
