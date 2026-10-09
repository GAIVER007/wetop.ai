'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MENU_CATEGORY_PRESETS } from '@pms/domain';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { minorToInput } from '../../lib/money';
import type {
  KitchenWorkspace,
  MenuCategory,
  MenuItemInput,
  MenuItemView,
  MenuTag,
} from '../../lib/food-types';
import { saveMenu } from './actions';

export type MenuDraft =
  | { kind: 'category'; item?: MenuCategory }
  | { kind: 'item'; item?: MenuItemView };

/** Сумма в тенге с копейками → целые minor units без float (как в баре) */
function minor(raw: string, field: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw.trim());
  if (!match) throw new Error(`${field}: укажите сумму в тенге`);
  return Number(BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0'));
}

export function MenuForm({
  draft,
  data,
  close,
}: {
  draft: MenuDraft;
  data: KitchenWorkspace;
  close: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [name, setName] = useState(draft.item?.name ?? '');
  const item = draft.item;
  const categories = [...data.categories]
    .filter((c) => c.active || (draft.kind === 'item' && draft.item?.categoryId === c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'));
  return (
    <Overlay
      open
      drawer
      trapFocus
      title={`${item ? 'Изменить' : 'Добавить'}: ${draft.kind === 'category' ? 'Категория' : 'Блюдо'}`}
      onClose={close}
      className="food-drawer"
    >
      <form
        className="food-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          setError('');
          const active = f.get('activeAction')
            ? f.get('activeAction') === 'restore'
            : f.get('active') === 'on';
          start(async () => {
            try {
              const id = item?.id;
              if (draft.kind === 'category') {
                const result = await saveMenu(data.scopeKey, {
                  kind: 'category',
                  ...(id ? { id } : {}),
                  body: {
                    name: String(f.get('name')),
                    sortOrder: Number(f.get('sortOrder')),
                    active,
                  },
                });
                if (result.error) return setError(result.error);
              } else {
                const body: MenuItemInput = {
                  name: String(f.get('name')),
                  categoryId: String(f.get('categoryId')) || null,
                  sku: String(f.get('sku')).trim() || null,
                  description: String(f.get('description')).trim() || null,
                  price: minor(String(f.get('price')), 'Цена продажи'),
                  currency: String(f.get('currency')),
                  outputWeightGrams: Number(f.get('weight')) || null,
                  prepTimeMinutes: Number(f.get('prepTime')) || null,
                  allergens: String(f.get('allergens'))
                    .split(',')
                    .map((a) => a.trim())
                    .filter(Boolean),
                  tags: (['hit', 'new'] as MenuTag[]).filter((t) => f.get(`tag-${t}`) === 'on'),
                  active,
                };
                const result = await saveMenu(data.scopeKey, {
                  kind: 'item',
                  ...(id ? { id } : {}),
                  body,
                });
                if (result.error) return setError(result.error);
                if (id && draft.kind === 'item' && draft.item) {
                  // Переопределение филиала: шлём, только если его поля изменились
                  const enabled = f.get('locationEnabled') === 'on';
                  const overrideRaw = String(f.get('priceOverride') ?? '').trim();
                  const priceOverride = overrideRaw ? minor(overrideRaw, 'Цена филиала') : null;
                  const was = draft.item.location;
                  const wasOverride = was.priceOverrideMinor
                    ? Number(was.priceOverrideMinor)
                    : null;
                  if (enabled !== was.enabled || priceOverride !== wasOverride) {
                    const override = await saveMenu(data.scopeKey, {
                      kind: 'location',
                      id,
                      body: { enabled, priceOverride },
                    });
                    if (override.error) return setError(override.error);
                  }
                }
              }
              router.refresh();
              close();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Не удалось сохранить');
            }
          });
        }}
      >
        <Field label="Название">
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
          />
        </Field>
        {draft.kind === 'category' && (
          <>
            {!item && (
              <div className="food-inline-actions" role="group" aria-label="Подсказки категорий">
                {MENU_CATEGORY_PRESETS.filter(
                  (p) => !data.categories.some((c) => c.name === p),
                )
                  .slice(0, 8)
                  .map((p) => (
                    <Button key={p} type="button" tone="ghost" size="sm" onClick={() => setName(p)}>
                      {p}
                    </Button>
                  ))}
              </div>
            )}
            <Field label="Порядок">
              <Input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={item && 'sortOrder' in item ? item.sortOrder : 0}
                required
              />
            </Field>
          </>
        )}
        {draft.kind === 'item' && (
          <>
            <Field label="Категория">
              <Select name="categoryId" defaultValue={draft.item?.categoryId ?? ''}>
                <option value="">Без категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="food-form-row">
              <Field label="Цена продажи, ₸">
                <Input
                  name="price"
                  required
                  inputMode="decimal"
                  defaultValue={draft.item ? minorToInput(draft.item.priceMinor) : ''}
                />
              </Field>
              <Field label="Валюта">
                <Select name="currency" defaultValue={draft.item?.currency ?? data.currency}>
                  {['KZT', 'RUB', 'USD', 'EUR'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="food-form-row">
              <Field label="Выход, г">
                <Input
                  name="weight"
                  type="number"
                  min={1}
                  defaultValue={draft.item?.outputWeightGrams ?? ''}
                />
              </Field>
              <Field label="Готовка, мин">
                <Input
                  name="prepTime"
                  type="number"
                  min={1}
                  max={1440}
                  defaultValue={draft.item?.prepTimeMinutes ?? ''}
                />
              </Field>
            </div>
            <Field label="Артикул (SKU)">
              <Input name="sku" maxLength={64} defaultValue={draft.item?.sku ?? ''} />
            </Field>
            <Field label="Описание">
              <Input name="description" maxLength={4000} defaultValue={draft.item?.description ?? ''} />
            </Field>
            <Field label="Аллергены, через запятую">
              <Input name="allergens" defaultValue={draft.item?.allergens.join(', ') ?? ''} />
            </Field>
            <div className="food-form-row">
              <label className="food-check">
                <input
                  name="tag-hit"
                  type="checkbox"
                  defaultChecked={draft.item?.tags.includes('hit') ?? false}
                />
                Хит
              </label>
              <label className="food-check">
                <input
                  name="tag-new"
                  type="checkbox"
                  defaultChecked={draft.item?.tags.includes('new') ?? false}
                />
                Новинка
              </label>
            </div>
            {item && (
              <>
                <label className="food-check">
                  <input
                    name="locationEnabled"
                    type="checkbox"
                    defaultChecked={draft.item?.location.enabled ?? true}
                  />
                  Показывать на этом филиале
                </label>
                <Field label="Цена филиала, ₸ (пусто: цена каталога)">
                  <Input
                    name="priceOverride"
                    inputMode="decimal"
                    defaultValue={
                      draft.item?.location.priceOverrideMinor
                        ? minorToInput(draft.item.location.priceOverrideMinor)
                        : ''
                    }
                  />
                </Field>
              </>
            )}
          </>
        )}
        <label className="food-check">
          <input name="active" type="checkbox" defaultChecked={item?.active ?? true} />
          {draft.kind === 'category'
            ? 'Активна (снимите, чтобы архивировать)'
            : 'Активно (снимите, чтобы архивировать во всей сети)'}
        </label>
        {error && (
          <Alert id="kitchen-form-error" tone="warning">
            {error}
          </Alert>
        )}
        <Button disabled={pending}>{pending ? 'Сохраняем…' : item ? 'Сохранить' : 'Создать'}</Button>
        {item && (
          <Button
            type="submit"
            tone="secondary"
            name="activeAction"
            value={item.active ? 'archive' : 'restore'}
            disabled={pending}
          >
            {item.active ? 'Архивировать' : 'Вернуть'}
          </Button>
        )}
      </form>
    </Overlay>
  );
}
