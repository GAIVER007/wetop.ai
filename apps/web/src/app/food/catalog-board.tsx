'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, EmptyState, Panel } from '../../components/ui';
import type { FoodWorkspace } from '../../lib/food-types';
import { weekdays } from '../../lib/food-data';
import { CatalogForm, type CatalogDraft } from './catalog-form';
export function CatalogBoard({ data }: { data: FoodWorkspace }) {
  const [tab, setTab] = useState<'areas' | 'periods'>('areas');
  const [switching, setSwitching] = useState(false);
  const [draft, setDraft] = useState<CatalogDraft | null>(null);
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
  // A refresh may finish after an operator reopens a just-saved catalog item.
  const currentDraft: CatalogDraft | null = !draft?.item
    ? draft
    : draft.kind === 'area'
      ? { ...draft, item: data.areas.find((a) => a.id === draft.item?.id) ?? draft.item }
      : draft.kind === 'table'
        ? { ...draft, item: data.tables.find((t) => t.id === draft.item?.id) ?? draft.item }
        : { ...draft, item: data.periods.find((p) => p.id === draft.item?.id) ?? draft.item };
  const write = data.canProperty && !data.readOnly;
  const tables = [...data.tables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'),
  );
  return (
    <div className="food-workspace">
      <nav className="food-tabs" aria-label="Каталог ресторана">
        <Button tone="secondary" aria-pressed={tab === 'areas'} onClick={() => setTab('areas')}>
          Залы и столы
        </Button>
        <Button tone="secondary" aria-pressed={tab === 'periods'} onClick={() => setTab('periods')}>
          Периоды обслуживания
        </Button>
      </nav>
      <div className="food-section-heading">
        <p className="muted">
          {tab === 'areas'
            ? 'Залы, вместимость и порядок столов'
            : 'Время работы и длительность бронирования'}
        </p>
        {write && (
          <Button onClick={() => setDraft(tab === 'areas' ? { kind: 'area' } : { kind: 'period' })}>
            {tab === 'areas' ? '+ Добавить зал' : '+ Добавить период'}
          </Button>
        )}
      </div>
      {tab === 'areas' ? (
        <div className="food-catalog-grid">
          {data.areas.length === 0 ? (
            <EmptyState title="Сначала добавьте зал и столы" />
          ) : (
            [...data.areas]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((area) => (
                <Panel key={area.id}>
                  <div className="food-section-heading">
                    <div>
                      <h2>{area.name}</h2>
                      <span className="muted">
                        {tables.filter((t) => t.areaId === area.id).length} столов ·{' '}
                        {area.active ? 'Активен' : 'В архиве'}
                      </span>
                    </div>
                    {write && (
                      <div className="food-inline-actions">
                        <Button
                          tone="secondary"
                          size="sm"
                          onClick={() => setDraft({ kind: 'area', item: area })}
                        >
                          Изменить
                        </Button>
                        {area.active && (
                          <Button
                            tone="secondary"
                            size="sm"
                            onClick={() => setDraft({ kind: 'table', areaId: area.id })}
                          >
                            + Стол
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {tables.filter((t) => t.areaId === area.id).length === 0 ? (
                    <p className="muted">В этом зале пока нет столов</p>
                  ) : (
                    <ul className="food-catalog-list">
                      {tables
                        .filter((t) => t.areaId === area.id)
                        .map((t) => (
                          <li key={t.id}>
                            <div>
                              <strong>{t.name}</strong>
                              <span>{t.capacity} мест</span>
                            </div>
                            <Badge tone={t.active ? 'ok' : 'neutral'}>
                              {t.active ? 'Активен' : 'В архиве'}
                            </Badge>
                            {write && (
                              <Button
                                tone="ghost"
                                size="sm"
                                aria-label={`Изменить стол ${t.name}`}
                                onClick={() =>
                                  setDraft({ kind: 'table', areaId: area.id, item: t })
                                }
                              >
                                Изменить
                              </Button>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </Panel>
              ))
          )}
        </div>
      ) : (
        <div className="food-catalog-grid">
          {data.periods.length === 0 ? (
            <EmptyState title="Настройте период обслуживания" />
          ) : (
            data.periods.map((p) => (
              <Panel key={p.id}>
                <div className="food-section-heading">
                  <h2>{p.name}</h2>
                  <Badge tone={p.active ? 'ok' : 'neutral'}>
                    {p.active ? 'Активен' : 'В архиве'}
                  </Badge>
                </div>
                <p>
                  {weekdays[p.weekday]}, {p.timeFrom}–{p.timeTo}
                  {p.endsNextDay ? ' (+1 день)' : ''}
                </p>
                <p className="muted">Длительность брони {p.defaultDurationMinutes} мин</p>
                {write && (
                  <Button tone="secondary" onClick={() => setDraft({ kind: 'period', item: p })}>
                    Изменить
                  </Button>
                )}
              </Panel>
            ))
          )}
        </div>
      )}
      {currentDraft && (
        <CatalogForm
          key={`${currentDraft.item?.id ?? 'new'}:${currentDraft.item?.active ?? true}`}
          draft={currentDraft}
          scopeKey={data.scopeKey}
          close={() => setDraft(null)}
        />
      )}
    </div>
  );
}
