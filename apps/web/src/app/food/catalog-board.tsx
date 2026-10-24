'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, EmptyState, Panel } from '../../components/ui';
import type { FoodWorkspace } from '../../lib/food-types';
import { weekdays } from '../../lib/food-data';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { compareTables } from '../../lib/table-title';
import { CatalogForm, type CatalogDraft } from './catalog-form';
const TABLE_FORMS: [string, string, string] = [msg('стол'), 'стола', msg('столов')]; // kk-allow: форма склонения
const SEAT_FORMS: [string, string, string] = [msg('место@@стол'), 'места', msg('мест@@стол')]; // kk-allow: форма склонения

export function CatalogBoard({ data }: { data: FoodWorkspace }) {
  const t = useT();
  const locale = useLocale();
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
  if (switching) return <p role="status">{t('Переключаем ресторан…')}</p>;
  // A refresh may finish after an operator reopens a just-saved catalog item.
  const currentDraft: CatalogDraft | null = !draft?.item
    ? draft
    : draft.kind === 'area'
      ? { ...draft, item: data.areas.find((a) => a.id === draft.item?.id) ?? draft.item }
      : draft.kind === 'table'
        ? { ...draft, item: data.tables.find((tb) => tb.id === draft.item?.id) ?? draft.item }
        : { ...draft, item: data.periods.find((p) => p.id === draft.item?.id) ?? draft.item };
  const write = data.canProperty && !data.readOnly;
  const tables = [...data.tables].sort(compareTables);
  return (
    <div className="food-workspace">
      <nav className="food-tabs" aria-label={t('Каталог ресторана')}>
        <Button tone="secondary" aria-pressed={tab === 'areas'} onClick={() => setTab('areas')}>
          {t('Залы и столы')}
        </Button>
        <Button tone="secondary" aria-pressed={tab === 'periods'} onClick={() => setTab('periods')}>
          {t('Периоды обслуживания')}
        </Button>
      </nav>
      <div className="food-section-heading">
        <p className="muted">
          {tab === 'areas'
            ? t('Залы, вместимость и порядок столов')
            : t('Время работы и длительность бронирования')}
        </p>
        {write && (
          <Button onClick={() => setDraft(tab === 'areas' ? { kind: 'area' } : { kind: 'period' })}>
            {tab === 'areas' ? t('+ Добавить зал') : t('+ Добавить период')}
          </Button>
        )}
      </div>
      {tab === 'areas' ? (
        <div className="food-catalog-grid">
          {data.areas.length === 0 ? (
            <EmptyState title={t('Сначала добавьте зал и столы')} />
          ) : (
            [...data.areas]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((area) => (
                <Panel key={area.id}>
                  <div className="food-section-heading">
                    <div>
                      <h2>{area.name}</h2>
                      <span className="muted">
                        {countLabel(locale, t, tables.filter((tb) => tb.areaId === area.id).length, TABLE_FORMS)} ·{' '}
                        {area.active ? t('Активен') : t('В архиве')}
                      </span>
                    </div>
                    {write && (
                      <div className="food-inline-actions">
                        <Button
                          tone="secondary"
                          size="sm"
                          onClick={() => setDraft({ kind: 'area', item: area })}
                        >
                          {t('Изменить')}
                        </Button>
                        {area.active && (
                          <Button
                            tone="secondary"
                            size="sm"
                            onClick={() => setDraft({ kind: 'table', areaId: area.id })}
                          >
                            {t('+ Стол')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {tables.filter((tb) => tb.areaId === area.id).length === 0 ? (
                    <p className="muted">{t('В этом зале пока нет столов')}</p>
                  ) : (
                    <ul className="food-catalog-list">
                      {tables
                        .filter((tb) => tb.areaId === area.id)
                        .map((tb) => (
                          <li key={tb.id}>
                            <div>
                              <strong>{tb.name}</strong>
                              <span>{countLabel(locale, t, tb.capacity, SEAT_FORMS)}</span>
                            </div>
                            <Badge tone={tb.active ? 'ok' : 'neutral'}>
                              {tb.active ? t('Активен') : t('В архиве')}
                            </Badge>
                            {write && (
                              <Button
                                tone="ghost"
                                size="sm"
                                aria-label={t('Изменить стол {name}', { name: tb.name })}
                                onClick={() =>
                                  setDraft({ kind: 'table', areaId: area.id, item: tb })
                                }
                              >
                                {t('Изменить')}
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
            <EmptyState title={t('Настройте период обслуживания')} />
          ) : (
            data.periods.map((p) => (
              <Panel key={p.id}>
                <div className="food-section-heading">
                  <h2>{p.name}</h2>
                  <Badge tone={p.active ? 'ok' : 'neutral'}>
                    {p.active ? t('Активен') : t('В архиве')}
                  </Badge>
                </div>
                <p>
                  {t(weekdays[p.weekday] ?? '')}, {p.timeFrom}–{p.timeTo}
                  {p.endsNextDay ? t(' (+1 день)') : ''}
                </p>
                <p className="muted">{t('Длительность брони {n} мин', { n: p.defaultDurationMinutes })}</p>
                {write && (
                  <Button tone="secondary" onClick={() => setDraft({ kind: 'period', item: p })}>
                    {t('Изменить')}
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
