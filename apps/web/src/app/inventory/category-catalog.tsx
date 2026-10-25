'use client';
import { useState, useTransition, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Alert, Badge, Button, EmptyState, Input, Notice, Table } from '../../components/ui';
import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { useConfirm } from '../../components/use-confirm';
import { FundEditor, FundEditorDialog } from './fund-editor';
import { CategoryPreview } from './category-preview';
import { removeCategory } from './actions';
import { KIND_WORD, addWord, capacityShort, compositionHref, unitWord } from './category-words';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';

const KIND_FILTERS: [InventoryCategory['kind'], string][] = [
  ['PRIVATE_ROOM', msg('Номера')],
  ['DORM_BED', msg('Койко-места')],
  ['APARTMENT', msg('Апартаменты')],
];

/** Щелчок по строке или карточке открывает панель, если он не пришёлся на ссылку, кнопку или меню */
const onSurface = (e: MouseEvent, open: () => void) => {
  if ((e.target as HTMLElement).closest('a, button, [role="menu"]')) return;
  open();
};

/**
 * Категории (ТЗ «Категории v2», ADR-109): C1 — таблица, одна строка на категорию, действия в меню
 * строки; C2 — панель категории по щелчку и режим «Карточки». Состав не разворачивается на месте —
 * число единиц ведёт в «Номера и койки».
 */
export function CategoryCatalog({
  categories,
  units,
  canMutate,
}: {
  categories: InventoryCategory[];
  units: InventoryUnit[];
  canMutate: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const search = useSearchParams();
  const view = search.get('view') === 'cards' ? 'cards' : 'list';
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | InventoryCategory['kind']>('');
  const [preview, setPreview] = useState<InventoryCategory | null>(null);
  const [editing, setEditing] = useState<InventoryCategory | null>(null);
  const [adding, setAdding] = useState<InventoryCategory | null>(null);
  const [removing, start] = useTransition();
  const [outcome, setOutcome] = useState<{ tone: 'error' | 'done'; text: string } | null>(null);
  const { ask, dialog } = useConfirm();
  const router = useRouter();
  const query = q.trim().toLocaleLowerCase('ru');
  const filtered = categories.filter(
    (c) => (!kind || c.kind === kind) && c.name.toLocaleLowerCase('ru').includes(query),
  );
  const memberCount = (c: InventoryCategory) =>
    units.filter((u) => u.accommodationTypeCode === c.code).length;
  const setView = (next: 'list' | 'cards') =>
    window.history.replaceState(
      null,
      '',
      next === 'cards' ? '/rooms/categories?view=cards' : '/rooms/categories',
    );
  const menu = (c: InventoryCategory): ActionMenuItem[] => [
    { label: t('Открыть'), onSelect: () => setPreview(c) },
    ...(canMutate
      ? [
          { label: t('Редактировать'), onSelect: () => setEditing(c) },
          { label: t(addWord(c)), onSelect: () => setAdding(c) },
        ]
      : []),
    { label: t('Показать в календаре'), href: `/chessboard?category=${encodeURIComponent(c.code)}` },
    { label: t('Свободные места'), href: `/rooms/availability?category=${encodeURIComponent(c.code)}` },
  ];
  /**
   * «Удалить» (решение владельца 06.10.2026): вопрос заранее говорит, что будет — пустая категория исчезнет,
   * с местами или историей уйдёт в архив; с бронями впереди сервер откажет словами
   */
  async function remove(c: InventoryCategory) {
    if (!canMutate) return;
    const used = memberCount(c) > 0 || c.reservations > 0 || c.channexMapped;
    if (c.upcomingReservations) {
      setOutcome({
        tone: 'error',
        text: t('«{name}» нельзя удалить: впереди {bookings}. Дождитесь выезда или переселите гостей.', {
          name: c.name,
          bookings: countLabel(locale, t, c.upcomingReservations, [msg('бронь'), msg('брони'), msg('броней')]),
        }),
      });
      return;
    }
    const ok = await ask({
      title: used ? t('Убрать «{name}» в архив?', { name: c.name }) : t('Удалить «{name}»?', { name: c.name }),
      body: used
        ? t('У категории есть места или история броней, поэтому она уйдёт в архив: перестанет продаваться вместе со своими местами, брони и отчёты сохранятся.')
        : t('Категорию ничего не использует: она удалится насовсем вместе со своей ценой.'),
      confirmLabel: used ? t('Убрать в архив') : t('Удалить категорию'),
      tone: 'danger',
    });
    if (!ok) return;
    setOutcome(null);
    start(async () => {
      const result = await removeCategory(c.code);
      if (result.error) {
        setOutcome({ tone: 'error', text: result.error });
        return;
      }
      setOutcome({
        tone: 'done',
        text:
          result.result === 'archived'
            ? t('«{name}» в архиве и больше не продаётся.', { name: c.name })
            : t('«{name}» удалена.', { name: c.name }),
      });
      router.refresh();
    });
  }
  const price = (c: InventoryCategory) =>
    c.priceMinor ? (
      <span className="fund-cat-price">{formatMoney(c.priceMinor, c.currency ?? 'KZT')}</span>
    ) : (
      <Badge tone="warn">{t('цена не задана')}</Badge>
    );
  const operations = (c: InventoryCategory) => (
    <div className="fund-cat-ops">
      {canMutate && (
        <>
          <Button
            size="sm"
            tone="secondary"
            disabled={!c.active}
            onClick={() => setEditing(c)}
            aria-label={t('Изменить категорию {name}', { name: c.name })}
          >
            {t('Изменить')}
          </Button>
          <Button
            size="sm"
            tone="ghost"
            disabled={removing || !c.active}
            onClick={() => void remove(c)}
            aria-label={t('Удалить категорию {name}', { name: c.name })}
          >
            {t('Удалить')}
          </Button>
        </>
      )}
      <ActionMenu size="sm" label={t('Действия с категорией {name}', { name: c.name })} items={menu(c)} />
    </div>
  );
  const fund = (c: InventoryCategory) => {
    const count = memberCount(c);
    return count ? (
      <Link href={compositionHref(c)} prefetch={false}>
        {unitWord(c.kind, count, locale, t)}
      </Link>
    ) : (
      <Badge tone="warn">{t('не добавлен')}</Badge>
    );
  };
  /** Без мест или без цены категорию не продать — так и говорим.
      Обычное состояние — текстом, бейджи только у исключений (упрощение 02.10, как в фонде) */
  const status = (c: InventoryCategory) =>
    !c.active ? (
      <Badge tone="neutral">{t('В архиве')}</Badge>
    ) : memberCount(c) && c.priceMinor ? (
      <span className="muted">{t('активна')}</span>
    ) : (
      <Badge tone="warn">{t('Не готова к продаже')}</Badge>
    );
  const open = (c: InventoryCategory) => (
    <button type="button" className="fund-cat-open" onClick={() => setPreview(c)}>
      {c.name}
    </button>
  );
  const kindCell = (c: InventoryCategory) => (
    <>
      <Icon name={c.kind === 'DORM_BED' ? 'bed' : 'inventory'} width={16} height={16} />
      {t(KIND_WORD[c.kind])}
    </>
  );
  if (!categories.length)
    return (
      <section className="fund-empty">
        <h2>{t('Начните с категории размещения')}</h2>
        <p>
          {t('Например, «Двухместный номер» или «Койка в общей комнате». Затем добавьте конкретные номера и койки.')}
        </p>
        {canMutate && <FundEditor categories={categories} mode="category" />}
      </section>
    );
  return (
    <>
      <div className="fund-toolbar">
        <Input
          type="search"
          aria-label={t('Поиск категории')}
          placeholder={t('Найти категорию')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips" role="group" aria-label={t('Тип размещения')}>
          <button type="button" aria-pressed={!kind} onClick={() => setKind('')}>
            {t('Все')} <span className="chips__count">{categories.length}</span>
          </button>
          {KIND_FILTERS.filter(([value]) => categories.some((c) => c.kind === value)).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(kind === value ? '' : value)}
              >
                {t(label)}{' '}
                <span className="chips__count">
                  {categories.filter((c) => c.kind === value).length}
                </span>
              </button>
            ),
          )}
        </div>
        {(query || kind) && (
          <span className="muted" role="status">
            {t('Показано {n} из {total}', { n: filtered.length, total: categories.length })}
          </span>
        )}
        <div className="chips fund-view" role="group" aria-label={t('Вид списка категорий')}>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            <Icon name="menu" width={16} height={16} />
            {t('Список')}
          </button>
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
            <Icon name="today" width={16} height={16} />
            {t('Карточки')}
          </button>
        </div>
      </div>
      {outcome &&
        (outcome.tone === 'error' ? (
          <Alert>{outcome.text}</Alert>
        ) : (
          <Notice role="status">{outcome.text}</Notice>
        ))}
      {!filtered.length ? (
        <EmptyState icon={<Icon name="inventory" />} title={t('Категории не найдены')}>
          {t('Измените поиск или сбросьте фильтр типа.')}
        </EmptyState>
      ) : view === 'cards' ? (
        <ul className="fund-cat-cards" aria-label={t('Категории размещения')}>
          {filtered.map((c) => (
            <li
              key={c.code}
              className="fund-cat-card"
              data-testid="fund-category-card"
              onClick={(e) => onSurface(e, () => setPreview(c))}
            >
              <div className="fund-cat-card-top">{open(c)}</div>
              <span className="fund-cat-kind">{kindCell(c)}</span>
              <div className="fund-cat-card-facts">
                {fund(c)}
                <span>{capacityShort(c, locale, t)}</span>
              </div>
              <div className="fund-cat-card-facts">
                {price(c)}
                {status(c)}
              </div>
              {operations(c)}
            </li>
          ))}
        </ul>
      ) : (
        <Table className="fund-cat-table" aria-label={t('Категории размещения')}>
          <thead>
            <tr>
              <th className="fund-cat-index">№</th>
              <th>{t('Название')}</th>
              <th>{t('Мест')}</th>
              <th>{t('Цена')}</th>
              <th>{t('Фонд')}</th>
              <th>{t('Статус')}</th>
              <th>{t('Операции')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr
                key={c.code}
                data-testid="fund-category-row"
                onClick={(e) => onSurface(e, () => setPreview(c))}
              >
                <td className="fund-cat-index">{i + 1}</td>
                {/* Тип продажи — значком у названия и словом фонда («36 коек»), не отдельной колонкой */}
                <td className="fund-cat-name">
                  <Icon name={c.kind === 'DORM_BED' ? 'bed' : 'inventory'} width={16} height={16} />
                  <span className="sr-only">{t(KIND_WORD[c.kind])}</span>
                  {open(c)}
                </td>
                <td className="fund-cat-capacity">{capacityShort(c, locale, t)}</td>
                <td className="fund-cat-rates">{price(c)}</td>
                <td className="fund-cat-units">{fund(c)}</td>
                <td className="fund-cat-status">{status(c)}</td>
                <td className="fund-cat-actions">{operations(c)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {preview && (
        <CategoryPreview
          key={`preview-${preview.code}`}
          category={preview}
          units={units}
          onClose={() => setPreview(null)}
          onEdit={() => {
            setPreview(null);
            setEditing(preview);
          }}
          onAdd={() => {
            setPreview(null);
            setAdding(preview);
          }}
          canMutate={canMutate}
        />
      )}
      {canMutate && editing && (
        <FundEditorDialog
          key={`edit-${editing.code}`}
          categories={categories}
          mode="category"
          category={editing}
          unitCount={memberCount(editing)}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {canMutate && adding && (
        <FundEditorDialog
          key={`add-${adding.code}`}
          categories={categories}
          category={adding}
          open
          onClose={() => setAdding(null)}
        />
      )}
      {dialog}
    </>
  );
}
