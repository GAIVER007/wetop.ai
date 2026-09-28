'use client';
import { useEffect, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { inventoryRates, linkCategoryRatePlan } from './actions';

/** Значение списка «Тариф» для нового тарифа с названием (прежняя ветка ADR-077) */
export const NEW_PLAN = '__new__';
export interface PlanPick {
  plan: string;
  newName: string;
}
type Plan = { code: string; name: string };

/** Тело запроса по выбору; null — выбор неполный (новый тариф без названия) */
export function planBody(pick: PlanPick): Record<string, unknown> | null {
  if (pick.plan === NEW_PLAN)
    return pick.newName.trim() ? { newRatePlanName: pick.newName.trim() } : null;
  return pick.plan ? { ratePlanCode: pick.plan } : null;
}
export const planName = (pick: PlanPick, plans: Plan[]) =>
  pick.plan === NEW_PLAN ? pick.newName.trim() : (plans.find((p) => p.code === pick.plan)?.name ?? '');

/** Тарифы объекта для выбора; пока грузятся — `loading` */
export function usePlans(open: boolean) {
  const [plans, setPlans] = useState<Plan[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    inventoryRates().then((r) => {
      setPlans(r.plans);
      setError(r.error);
      setLoading(false);
    });
  }, [open]);
  return { plans, loading, error };
}

/**
 * Выбор тарифа категории (ADR-118): существующий тариф объекта или новый с названием. Цены здесь не вводятся —
 * только в календаре тарифов; редактора тарифов внутри «Категорий» нет.
 */
export function RatePlanChoice({
  plans,
  loading,
  value,
  onChange,
  error,
}: {
  plans: Plan[];
  loading: boolean;
  value: PlanPick;
  onChange: (next: PlanPick) => void;
  error?: string | undefined;
}) {
  const errorId = useId();
  return (
    <>
      <Field label="Тариф">
        <Select
          value={value.plan}
          disabled={loading}
          onChange={(e) => onChange({ ...value, plan: e.target.value })}
        >
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
          <option value={NEW_PLAN}>Новый тариф…</option>
        </Select>
      </Field>
      {value.plan === NEW_PLAN && (
        <Field label="Название нового тарифа">
          <Input
            value={value.newName}
            maxLength={100}
            placeholder="Например, Стандартный"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => onChange({ ...value, newName: e.target.value })}
          />
        </Field>
      )}
      {error && <Alert id={errorId}>{error}</Alert>}
    </>
  );
}

/** Форма «Настроить тариф» — в своём окне и шагом после создания категории */
export function CategoryRatePlanForm({
  category,
  onDone,
  onCancel,
}: {
  category: { code: string; name: string };
  onDone: () => void;
  onCancel: () => void;
}) {
  const { plans, loading, error: loadError } = usePlans(true);
  const [pick, setPick] = useState<PlanPick>({ plan: '', newName: '' }),
    [error, setError] = useState<string | null>(null),
    [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!loading) setPick((p) => (p.plan ? p : { ...p, plan: plans[0]?.code ?? NEW_PLAN }));
  }, [loading, plans]);
  return (
    <form
      className="fund-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const body = planBody(pick);
        if (!body) {
          setError('Назовите новый тариф или выберите существующий');
          return;
        }
        setError(null);
        start(async () => {
          const result = await linkCategoryRatePlan(category.code, body);
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
          onDone();
        });
      }}
    >
      <p>
        Категория «{category.name}». Тариф решает, по каким ценам её продавать; сами цены вводятся в
        календаре тарифов.
      </p>
      <RatePlanChoice
        plans={plans}
        loading={loading}
        value={pick}
        onChange={setPick}
        error={error ?? loadError ?? undefined}
      />
      <div className="fund-form-actions">
        <Button type="button" tone="secondary" disabled={pending} onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending || loading}>
          {pending ? 'Сохраняю…' : 'Привязать тариф'}
        </Button>
      </div>
    </form>
  );
}

/** Отдельное окно «Настроить тариф» — из меню строки и панели категории */
export function CategoryRatePlanDialog({
  category,
  onClose,
}: {
  category: { code: string; name: string };
  onClose: () => void;
}) {
  return (
    <Overlay open onClose={onClose} title="Настроить тариф" drawer>
      <CategoryRatePlanForm category={category} onDone={onClose} onCancel={onClose} />
    </Overlay>
  );
}
