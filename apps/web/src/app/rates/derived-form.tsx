'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { RatePlanRow } from '../../lib/api';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { createDerivedPlan, saveDerivedPlan, type DerivedActionResult } from './actions';

/**
 * Форма производного тарифа (D4, DATA_MODEL §20): процент от тарифа-родителя, окно продаж («раннее бронирование»,
 * «last minute») и минимум ночей. Без `plan` — новый тариф с выбором родителя; с `plan` — правка условий, родитель не
 * меняется. Проверки — в API, ошибка приходит словами и показывается над полями.
 */
export function DerivedForm({
  plan,
  parents,
  onCancel,
  onSaved,
}: {
  plan?: RatePlanRow;
  parents: RatePlanRow[];
  onCancel: () => void;
  onSaved: (text: string) => void;
}) {
  const [state, action, pending] = useActionState<DerivedActionResult | null, FormData>(
    plan ? saveDerivedPlan : createDerivedPlan,
    null,
  );
  const reported = useRef<DerivedActionResult | null>(null);
  useEffect(() => {
    if (!state?.saved || reported.current === state) return;
    reported.current = state;
    onSaved(plan ? `Условия тарифа «${state.saved.name}» сохранены` : `Тариф «${state.saved.name}» добавлен`);
  }, [state, onSaved, plan]);
  const rule = plan?.derived ?? null;
  // Поля управляемые: после отказа API форма с серверным действием сбрасывается, а введённое терять нельзя
  const [v, setV] = useState({
    name: '',
    parentCode: parents[0]?.code ?? '',
    discountPercent: String(rule?.discountPercent ?? ''),
    minDaysBeforeArrival: String(rule?.minDaysBeforeArrival ?? ''),
    maxDaysBeforeArrival: String(rule?.maxDaysBeforeArrival ?? ''),
    minNights: String(rule?.minNights ?? ''),
  });
  const bind = (key: keyof typeof v) => ({
    name: key,
    value: v[key],
    onChange: (e: { target: { value: string } }) => setV((prev) => ({ ...prev, [key]: e.target.value })),
  });
  return (
    <form action={action} className="settings-service-form" data-testid="derived-form">
      {plan && <input type="hidden" name="code" value={plan.code} />}
      {state?.error && <Alert boxed>{state.error}</Alert>}
      {!plan && (
        <>
          <Field label="Название">
            <Input {...bind('name')} required maxLength={120} />
          </Field>
          <Field label="Родительский тариф">
            <Select {...bind('parentCode')} required>
              {parents.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}
      <Field label="Скидка, %">
        <Input {...bind('discountPercent')} inputMode="numeric" />
      </Field>
      <Field label="Заезд не раньше чем за, дн.">
        <Input {...bind('minDaysBeforeArrival')} inputMode="numeric" />
      </Field>
      <Field label="Заезд не позже чем за, дн.">
        <Input {...bind('maxDaysBeforeArrival')} inputMode="numeric" />
      </Field>
      <Field label="Минимум ночей">
        <Input {...bind('minNights')} inputMode="numeric" />
      </Field>
      <p className="settings-note">
        Цены берутся у тарифа-родителя со скидкой. Пустое поле — условия нет. Промокод и скидка тарифа не
        суммируются: гостю применяется большая.
      </p>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Сохраняю…' : plan ? 'Сохранить условия' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
