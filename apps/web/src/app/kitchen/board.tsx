'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, EmptyState, Input, Panel } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import type { KitchenWorkspace, MenuCategory, MenuItemView } from '../../lib/food-types';
import { MenuForm, type MenuDraft } from './form';
import { saveMenu } from './actions';

const TAG_LABELS: Record<string, string> = { hit: 'Хит', new: 'Новинка' };

function itemBadge(item: MenuItemView) {
  if (!item.active) return <Badge tone="neutral">В архиве</Badge>;
  if (!item.location.enabled) return <Badge tone="neutral">Скрыто на филиале</Badge>;
  if (!item.location.available) return <Badge tone="warn">Стоп-лист</Badge>;
  return <Badge tone="ok">В наличии</Badge>;
}

export function KitchenBoard({ data }: { data: KitchenWorkspace }) {
  const router = useRouter();
  const [tab, setTab] = useState<'menu' | 'categories'>('menu');
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [switching, setSwitching] = useState(false);
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [pending, start] = useTransition();
  const [rowError, setRowError] = useState('');
  useEffect(() => {
    const close = () => {
      setDraft(null);
      setSwitching(true);
    };
    const failed = () => setSwitching(false);
    window.addEventListener('wetop-scope-switch-failed', failed);
    window.addEventListener('wetop-scope-switch', close);
    return () => {
      window.removeEventListener('wetop-scope-switch', close);
      window.removeEventListener('wetop-scope-switch-failed', failed);
    };
  }, []);
  if (switching) return <p role="status">Переключаем ресторан…</p>;
  const write = data.canSettings && !data.readOnly;
  // A refresh may finish after an operator reopens a just-saved card.
  const currentDraft: MenuDraft | null = !draft?.item
    ? draft
    : draft.kind === 'category'
      ? { ...draft, item: data.categories.find((c) => c.id === draft.item?.id) ?? draft.item }
      : { ...draft, item: data.items.find((i) => i.id === draft.item?.id) ?? draft.item };
  const categories = [...data.categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'),
  );
  const named = new Map(categories.map((c) => [c.id, c.name]));
  const query = search.trim().toLocaleLowerCase('ru');
  const items = data.items
    .filter(
      (i) =>
        (filter === null || i.categoryId === filter) &&
        (query === '' || i.name.toLocaleLowerCase('ru').includes(query)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const countOf = (c: MenuCategory) => data.items.filter((i) => i.categoryId === c.id).length;
  const toggleAvailability = (item: MenuItemView) => {
    setRowError('');
    start(async () => {
      const result = await saveMenu(data.scopeKey, {
        kind: 'location',
        id: item.id,
        body: { available: !item.location.available },
      });
      if (result.error) setRowError(result.error);
      else router.refresh();
    });
  };
  return (
    <div className="food-workspace">
      <nav className="food-tabs" aria-label="Кухня">
        <Button tone="secondary" aria-pressed={tab === 'menu'} onClick={() => setTab('menu')}>
          Меню
        </Button>
        <Button
          tone="secondary"
          aria-pressed={tab === 'categories'}
          onClick={() => setTab('categories')}
        >
          Категории
        </Button>
      </nav>
      <div className="food-section-heading">
        <p className="muted">
          {tab === 'menu'
            ? 'Блюда, цены и доступность на этом филиале'
            : 'Категории меню и их порядок'}
        </p>
        {write && (
          <Button
            onClick={() => setDraft(tab === 'menu' ? { kind: 'item' } : { kind: 'category' })}
          >
            {tab === 'menu' ? '+ Добавить блюдо' : '+ Добавить категорию'}
          </Button>
        )}
      </div>
      {rowError && (
        <p role="alert" className="muted">
          {rowError}
        </p>
      )}
      {tab === 'menu' ? (
        <>
          <div className="food-tabs" role="group" aria-label="Категории меню">
            <Button tone="secondary" aria-pressed={filter === null} onClick={() => setFilter(null)}>
              Все блюда ({data.items.length})
            </Button>
            {categories
              .filter((c) => c.active)
              .map((c) => (
                <Button
                  key={c.id}
                  tone="secondary"
                  aria-pressed={filter === c.id}
                  onClick={() => setFilter(filter === c.id ? null : c.id)}
                >
                  {c.name} ({countOf(c)})
                </Button>
              ))}
          </div>
          <Input
            aria-label="Поиск по блюдам"
            placeholder="Поиск по блюдам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {items.length === 0 ? (
            <EmptyState
              title={data.items.length === 0 ? 'Добавьте первое блюдо' : 'Ничего не найдено'}
            />
          ) : (
            <div className="food-catalog-grid">
              {items.map((item) => (
                <Panel key={item.id}>
                  <div className="food-section-heading">
                    <div>
                      <h2>{item.name}</h2>
                      <span className="muted">
                        {item.categoryId
                          ? (named.get(item.categoryId) ?? 'Без категории')
                          : 'Без категории'}
                        {item.outputWeightGrams ? `, ${item.outputWeightGrams} г` : ''}
                        {item.prepTimeMinutes ? `, ${item.prepTimeMinutes} мин` : ''}
                      </span>
                    </div>
                    {itemBadge(item)}
                  </div>
                  <p>
                    <strong>{formatMoney(item.location.effectivePriceMinor, item.currency)}</strong>
                    {item.location.priceOverrideMinor !== null && (
                      <span className="muted">, цена филиала</span>
                    )}
                  </p>
                  {item.tags.length > 0 && (
                    <p className="food-inline-actions">
                      {item.tags.map((t) => (
                        <Badge key={t} tone="neutral">
                          {TAG_LABELS[t] ?? t}
                        </Badge>
                      ))}
                    </p>
                  )}
                  {write && (
                    <div className="food-inline-actions">
                      <Button
                        tone="secondary"
                        size="sm"
                        onClick={() => setDraft({ kind: 'item', item })}
                      >
                        Изменить
                      </Button>
                      {item.active && item.location.enabled && (
                        <Button
                          tone="ghost"
                          size="sm"
                          disabled={pending}
                          aria-label={`${item.location.available ? 'В стоп-лист' : 'Вернуть в продажу'}: ${item.name}`}
                          onClick={() => toggleAvailability(item)}
                        >
                          {item.location.available ? 'В стоп-лист' : 'Вернуть в продажу'}
                        </Button>
                      )}
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="food-catalog-grid">
          {categories.length === 0 ? (
            <EmptyState title="Сначала добавьте категории меню" />
          ) : (
            categories.map((c) => (
              <Panel key={c.id}>
                <div className="food-section-heading">
                  <div>
                    <h2>{c.name}</h2>
                    <span className="muted">{countOf(c)} блюд</span>
                  </div>
                  <Badge tone={c.active ? 'ok' : 'neutral'}>
                    {c.active ? 'Активна' : 'В архиве'}
                  </Badge>
                </div>
                {write && (
                  <Button tone="secondary" onClick={() => setDraft({ kind: 'category', item: c })}>
                    Изменить
                  </Button>
                )}
              </Panel>
            ))
          )}
        </div>
      )}
      {currentDraft && (
        <MenuForm
          key={`${currentDraft.kind}:${currentDraft.item?.id ?? 'new'}`}
          draft={currentDraft}
          data={data}
          close={() => setDraft(null)}
        />
      )}
    </div>
  );
}
