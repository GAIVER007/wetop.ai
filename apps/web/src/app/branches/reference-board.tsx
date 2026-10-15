'use client';
import { FinancialWidgets } from './financial-widgets';
import { useState, type ReactNode } from 'react';
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
  preview,
  period,
  financial,
  archive,
}: Props) {
  const [editing, setEditing] = useState<BusinessCardView | null>(null);
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
  const visible = [...groups].sort(
    (a, b) =>
      directions.findIndex(([vertical]) => vertical === a.vertical) -
      directions.findIndex(([vertical]) => vertical === b.vertical),
  );
  const singleProject = groups.length === 1 && items.length <= 1;
  const hasHospitality = groups.some((g) => g.vertical === 'HOSPITALITY');
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
          {archive}
          {create}
        </div>
      </div>
      <FinancialWidgets summary={financial} />
      {visible.length ? (
        <div className="org-cards">
          {visible.map((group) => {
            const coverStyle = group.card.coverUrl
              ? { backgroundImage: `url(${JSON.stringify(group.card.coverUrl)})` }
              : undefined;
            return (
              <article key={group.id} className={`org-card org-card--${group.vertical} ${!group.card.coverUrl ? 'org-card--no-cover' : ''}`}>
                {group.card.coverUrl && (
                  <div
                    className="org-cover org-cover--custom"
                    style={coverStyle} /* slop-allow: inline-style cover */
                  />
                )}
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
                  {group.card.description && (
                    <p className="org-description" title={group.card.description}>
                      {group.card.description}
                    </p>
                  )}
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
                        <button type="submit" aria-label={`Открыть объект: ${branch.name}`}>
                          <span className="org-branch-symbol">
                            <Icon name={businessIcons[branch.vertical]} />
                          </span>
                          <span className="org-branch-info">
                            <strong>{branch.name}</strong>
                            <small
                              className="org-branch-address"
                              title={branch.address || undefined}
                            >
                              {branch.address || 'Адрес не указан'}
                            </small>
                            {branch.vertical === 'HOSPITALITY' && (
                              <span className="org-branch-capacity">
                                <span>Номеров и коек: {branch._count.inventoryUnits}</span>
                                <span>Категорий: {branch._count.accommodationTypes}</span>
                              </span>
                            )}
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
          <strong>Пока нет доступных проектов</strong>
          <p>
            {create
              ? 'Добавьте первый объект. Направление бизнеса будет создано вместе с ним.'
              : 'Попросите владельца предоставить доступ к проекту.'}
          </p>
          {create ? <button onClick={() => openCreate()}>Добавить первый объект</button> : null}
        </div>
      )}
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
