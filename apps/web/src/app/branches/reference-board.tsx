'use client';
import { FinancialWidgets, BusinessFinancialWidgets } from './financial-widgets';
import { useState, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/icon';
import type { BranchItem } from '../../lib/api';
import { selectBranch } from './actions';
import { groupBusinessBranches } from './business-groups';
import { BusinessCardEditor } from './business-card-editor';
import type { BusinessCardView } from '../../lib/api';
export type { BusinessCardView } from '../../lib/api';
type Metric = { money: string[]; occupancy: string };
type Props = {
  organization: string;
  periodLabel: string;
  items: BranchItem[];
  businesses: BusinessCardView[];
  money: string[];
  metrics: Record<string, Metric>;
  create: ReactNode;
  trend: ReactNode;
  recent: ReactNode;
  preview: boolean;
  period?: ReactNode;
  financial?: import('../../lib/api').OrganizationSummary | null;
  archive?: ReactNode;
};
const directions = [
  ['HOSPITALITY', 'Отели'],
  ['BEAUTY', 'Салоны красоты'],
  ['FOOD_SERVICE', 'Рестораны'],
] as const;
const categories = [['ALL', 'Все'], ...directions] as const;
const businessLabels: Record<BranchItem['vertical'], string> = {
  HOSPITALITY: 'Гостиничный бизнес',
  BEAUTY: 'Салон красоты',
  FOOD_SERVICE: 'Ресторанный бизнес',
};
const businessIcons: Record<BranchItem['vertical'], IconName> = {
  HOSPITALITY: 'bed',
  BEAUTY: 'beauty',
  FOOD_SERVICE: 'kettle',
};
export function ReferenceBoard({
  organization,
  items,
  businesses,
  create,
  trend,
  recent,
  preview,
  period,
  financial,
  archive,
}: Props) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('cards');
  const [sort, setSort] = useState('direction');
  const [editing, setEditing] = useState<BusinessCardView | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const groups = groupBusinessBranches(items, businesses).map((group) => ({
    ...group,
    card: businesses.find((b) => b.id === group.id) ?? {
      id: group.id,
      name: group.branches[0]?.name ?? businessLabels[group.vertical],
      vertical: group.vertical,
      description: null,
      coverUrl: null,
      updatedAt: '',
      canEdit: false,
      canUpload: false,
      hasCover: false,
    },
  }));
  const visible = groups
    .filter(
      (group) =>
        (filter === 'ALL' || group.vertical === filter) &&
        `${organization} ${group.card.name} ${group.branches.map((b) => `${b.name} ${b.address ?? ''}`).join(' ')}`
          .toLocaleLowerCase('ru')
          .includes(search.toLocaleLowerCase('ru')),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.card.name.localeCompare(b.card.name, 'ru')
        : sort === 'direction'
          ? ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].indexOf(a.vertical) -
            ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'].indexOf(b.vertical)
          : b.branches.length - a.branches.length,
    );
  const singleProject = groups.length === 1 && items.length <= 1;
  const hasHospitality = groups.some((g) => g.vertical === 'HOSPITALITY');
  const distribution = categories.slice(1).map(([id, label]) => ({
    id,
    label,
    count: groups.filter((group) => group.vertical === id).length,
    objects: groups
      .filter((group) => group.vertical === id)
      .reduce((total, group) => total + group.branches.length, 0),
  }));
  const openCreate = (vertical?: BranchItem['vertical'], businessId?: string) => {
    const trigger = document.getElementById('create-branch') as HTMLButtonElement | null;
    if (trigger) {
      trigger.dataset.businessId = businessId ?? '';
      trigger.dataset.vertical = vertical ?? '';
      trigger.click();
    }
  };
  return (
    <section
      className={`org-reference ${singleProject ? 'org-reference--single' : ''} ${!hasHospitality ? 'org-reference--service' : ''} ${!groups.length ? 'org-reference--empty' : ''}`}
      aria-label="Бизнесы и филиалы организации"
    >
      <div className="org-heading">
        <div>
          <h1>Организация</h1>
          <p>
            {organization}.{' '}
            {singleProject
              ? 'Ваш проект уже создан. Добавляйте филиалы и направления, когда они понадобятся.'
              : 'Управляйте бизнесами и объектами в одном месте.'}
          </p>
          {preview && (
            <small className="org-preview-note">Локальный просмотр, вымышленные данные</small>
          )}
        </div>
        <div className="org-heading-controls">
          {period}
          {create}
        </div>
      </div>
      <FinancialWidgets summary={financial} />
      <div className="org-tools">
        {archive}
        {groups.length > 1 && (
          <div className="org-tabs" role="group" aria-label="Направление бизнеса">
            {categories
              .filter(([id]) => id === 'ALL' || groups.some((g) => g.vertical === id))
              .map(([id, label]) => (
                <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label} (
                  {id === 'ALL' ? groups.length : groups.filter((g) => g.vertical === id).length})
                </button>
              ))}
          </div>
        )}
        <div className="org-view">
          <label>
            Сортировка:{' '}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="direction">По направлению</option>
              <option value="name">По названию</option>
              <option value="branches">По числу филиалов</option>
            </select>
          </label>
          <button
            aria-label="Карточки"
            aria-pressed={view === 'cards'}
            onClick={() => setView('cards')}
          >
            <Icon name="today" />
          </button>
          <button
            aria-label="Список"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <Icon name="list" />
          </button>
        </div>
      </div>
      <label className="org-search">
        <Icon name="search" />
        <input
          ref={searchInput}
          aria-label="Поиск бизнесов и филиалов"
          placeholder="Поиск по бизнесам, филиалам, адресам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            aria-label="Очистить поиск"
            onClick={() => {
              setSearch('');
              searchInput.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        )}
      </label>
      {visible.length ? (
        <div className={`org-cards ${view === 'list' ? 'org-list' : ''}`}>
          {visible.map((group) => {
            const coverStyle = group.card.coverUrl
              ? { backgroundImage: `url(${JSON.stringify(group.card.coverUrl)})` }
              : undefined;
            return (
              <article key={group.id} className={`org-card org-card--${group.vertical}`}>
                <div
                  className={`org-cover ${group.card.coverUrl ? 'org-cover--custom' : ''}`}
                  style={coverStyle} /* slop-allow: inline-style cover */
                >
                  {!group.card.coverUrl ? <Icon name="image" /> : null}
                  <span className="org-count">
                    {group.branches.length === 1
                      ? 'Один объект'
                      : `Объектов: ${group.branches.length}`}
                  </span>
                </div>
                <div className="org-card-body">
                  <span className="org-business-icon">
                    <Icon name={businessIcons[group.vertical]} />
                  </span>
                  <h2 title={group.card.name}>{group.card.name}</h2>
                  <p className="org-muted org-business-kind">{businessLabels[group.vertical]}</p>
                  <p className="org-address">
                    <Icon name="pin" />
                    {group.branches[0]?.address || 'Адрес не указан'}
                  </p>
                  <p className="org-description" title={group.card.description ?? ''}>
                    {group.card.description || 'Добавьте описание бизнеса в настройках карточки.'}
                  </p>
                  <BusinessFinancialWidgets summary={financial} businessId={group.id} />
                  <div className="org-branches-heading">
                    <strong>
                      {group.branches.length === 1
                        ? 'Ваш объект'
                        : `Объекты (${group.branches.length})`}
                    </strong>
                    {create && (
                      <button
                        type="button"
                        className="org-add-link"
                        onClick={() => openCreate(group.vertical, group.id)}
                      >
                        + Добавить
                      </button>
                    )}
                  </div>
                  <div
                    className="org-branch-rows"
                    tabIndex={0}
                    aria-label={`Филиалы: ${group.card.name}`}
                  >
                    {!group.branches.length && (
                      <p className="org-chart-empty">
                        Объекты ещё не добавлены. Добавьте первый объект, чтобы начать работу.
                      </p>
                    )}
                    {group.branches.map((branch) => (
                      <form key={branch.id} action={selectBranch}>
                        <input type="hidden" name="id" value={branch.id} />
                        <button type="submit">
                          <span className="org-dot" />
                          <span>
                            <strong>{branch.name}</strong>
                            <small>
                              {branch.address || 'Адрес не указан'}
                              {branch.vertical === 'HOSPITALITY'
                                ? `, ${branch._count.inventoryUnits} номеров и коек, ${branch._count.accommodationTypes} категорий`
                                : ''}
                            </small>
                          </span>
                          <Icon name="chevron" />
                        </button>
                      </form>
                    ))}
                  </div>
                  <div className="org-card-footer">
                    {group.branches.length > 0 && (
                      <form action={selectBranch}>
                        <input type="hidden" name="id" value={group.branches[0]?.id} />
                        <button type="submit" className="org-open">
                          Открыть <Icon name="arrow" />
                        </button>
                      </form>
                    )}
                    {group.card.canEdit && (
                      <button
                        className="org-edit"
                        aria-label={`Редактировать: ${group.card.name}`}
                        onClick={() => setEditing(group.card)}
                      >
                        <Icon name="edit" />
                        <span>Редактировать</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {singleProject && create && (
            <aside className="org-growth">
              <h2>Структура проекта</h2>
              <p>
                {items.length
                  ? 'Один объект уже готов к работе. Филиалы и другие направления добавляются по необходимости.'
                  : 'Бизнес создан. Добавьте первый объект, чтобы начать работу.'}
              </p>
              <button type="button" onClick={() => openCreate(groups[0]?.vertical, groups[0]?.id)}>
                <Icon name="pin" />
                {items.length ? 'Добавить филиал' : 'Добавить первый объект'}
              </button>
              <h3>Добавить направление бизнеса</h3>
              <p>Выберите направление и заполните данные первого объекта.</p>
              {directions
                .filter(([vertical]) => vertical !== groups[0]?.vertical)
                .map(([vertical, label]) => (
                  <button type="button" key={vertical} onClick={() => openCreate(vertical)}>
                    <Icon name={businessIcons[vertical]} />
                    {label}
                  </button>
                ))}
            </aside>
          )}
        </div>
      ) : (
        <div className="org-empty" role="status">
          <strong>{groups.length ? 'Ничего не найдено' : 'Пока нет доступных проектов'}</strong>
          <p>
            {groups.length
              ? 'Измените поиск или направление бизнеса.'
              : create
                ? 'Добавьте первый объект. Направление бизнеса будет создано вместе с ним.'
                : 'Попросите владельца предоставить доступ к проекту.'}
          </p>
          {groups.length > 0 ? (
            <button
              onClick={() => {
                setSearch('');
                setFilter('ALL');
              }}
            >
              Сбросить фильтры
            </button>
          ) : create ? (
            <button onClick={() => openCreate()}>Добавить первый объект</button>
          ) : null}
        </div>
      )}
      <div className={`org-bottom ${groups.length <= 1 ? 'org-bottom--simple' : ''}`}>
        <section>
          <h2>Оплаты по месяцам</h2>
          <p className="org-panel-note">С начала года по выбранный месяц.</p>
          {trend}
        </section>
        <section>
          <h2>Бизнесы и объекты</h2>
          <table className="org-business-breakdown" aria-label="Бизнесы и объекты по направлениям">
            <thead>
              <tr>
                <th scope="col">Направление</th>
                <th scope="col">Бизнесов</th>
                <th scope="col">Объектов</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{row.count}</td>
                  <td>{row.objects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2>Изменения бизнесов</h2>
          <p className="org-panel-note">Создание и оформление карточек.</p>
          {recent}
        </section>
      </div>
      {editing && (
        <BusinessCardEditor
          business={editing}
          branches={items.filter((branch) => branch.location.businessId === editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
