'use client';
import { useState } from 'react';
import type { Incident } from '../../lib/api';
import { usePropertyClock } from '../../components/property-time';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { Badge, Button, EmptyState, Field, Input, cx, type BadgeTone } from '../../components/ui';
import { Icon } from '../../components/icon';
import { IncidentButtons } from './buttons';
import { incidentHeadline, guardWords, incidentOrder, repeatWords } from './incident-view';

/**
 * Список открытых неисправностей (правка 21.09.2026 по снимку рабочего экрана: «чтобы каши не было»).
 *
 * Было: таблица из пяти колонок, где в каждой строке стояли два цветных бейджа, класс словами,
 * колонка «что делал сторож» с повторяющимся «не чинит — не его класс», время в минутах («1226 мин»)
 * и две кнопки столбиком; над таблицей — три плитки с числами и три поля отбора, повторяющие те же числа.
 *
 * Стало: строка — карточка из трёх фраз (что случилось и в каком она состоянии; когда замечена и сколько
 * держится; кто её чинит и что уже сделал), один цветной бейдж на карточку, срочность — полосой и словом,
 * отбор — чипами, которые сами и есть счётчики. DESIGN.md §9 (цвет плюс слово) и §14 (слово несёт смысл).
 */

export type IncidentRow = Pick<
  Incident,
  | 'id'
  | 'kind'
  | 'class'
  | 'severity'
  | 'status'
  | 'title'
  | 'occurrences'
  | 'firstSeenAt'
  | 'lastSeenAt'
  | 'fixAttempts'
  | 'lastFixResult'
  | 'alertedAt'
>;

const STATUS_RU: Record<Incident['status'], string> = {
  OPEN: msg('замечена'),
  FIXING: msg('сторож чинит'),
  ESCALATED: msg('ждёт человека'),
  ACKNOWLEDGED: msg('принято'),
  RESOLVED: msg('закрыта'),
};
const STATUS_TONE: Record<Incident['status'], BadgeTone> = {
  OPEN: 'info',
  FIXING: 'info',
  ESCALATED: 'danger',
  ACKNOWLEDGED: 'warn',
  RESOLVED: 'ok',
};

/** Чипы отбора: они же счётчики — отдельных плиток с теми же числами над списком больше нет */
type Chip = 'ALL' | 'CRITICAL' | 'ESCALATED' | 'ACKNOWLEDGED';
const CHIPS: ReadonlyArray<readonly [Chip, string, (i: IncidentRow) => boolean]> = [
  ['ALL', msg('Все'), () => true],
  ['CRITICAL', msg('Срочные'), (i) => i.severity === 'CRITICAL'],
  ['ESCALATED', msg('Ждут человека'), (i) => i.status === 'ESCALATED'],
  ['ACKNOWLEDGED', msg('Принятые'), (i) => i.status === 'ACKNOWLEDGED'],
];

export function IncidentList({
  incidents,
  emptyTitle,
  emptyHint,
}: {
  incidents: IncidentRow[];
  emptyTitle: string;
  emptyHint: string;
}) {
  const clock = usePropertyClock();
  const t = useT();
  const locale = useLocale();
  const [chip, setChip] = useState<Chip>('ALL');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('ru');
  const chipLabel = CHIPS.find(([id]) => id === chip)?.[1];
  const matches = CHIPS.find(([id]) => id === chip)?.[2] ?? (() => true);
  const rows = incidents
    .filter(
      (i) =>
        matches(i) &&
        `${i.title} ${i.kind} ${i.lastFixResult ?? ''}`.toLocaleLowerCase('ru').includes(needle),
    )
    .sort(incidentOrder);
  const conditions = [
    needle ? t('по запросу «{q}»', { q: query.trim() }) : '',
    chip === 'ALL' ? '' : t('отбор «{chip}»', { chip: chipLabel ? t(chipLabel) : '' }),
  ].filter(Boolean);
  const found = countLabel(locale, t, rows.length, [msg('неисправность'), 'неисправности', msg('неисправностей')]); // kk-allow: форма склонения
  const reset = () => {
    setChip('ALL');
    setQuery('');
  };

  if (incidents.length === 0)
    return (
      <EmptyState icon={<Icon name="check" />} title={emptyTitle} data-testid="incidents-empty">
        {emptyHint}
      </EmptyState>
    );

  return (
    <section className="incidents" aria-label={t('Открытые неисправности')}>
      <div className="incidents__controls">
        <div className="chips" data-testid="incidents-filter">
          {CHIPS.map(([id, label, test]) => {
            const count = incidents.filter(test).length;
            if (count === 0 && id !== 'ALL') return null;
            return (
              <button
                key={id}
                type="button"
                className={cx(chip === id && 'is-active')}
                aria-pressed={chip === id}
                onClick={() => setChip(id)}
              >
                {t(label)} <span className="chips__count">{count}</span>
              </button>
            );
          })}
        </div>
        <Field label={t('Поиск неисправности')} className="incidents__search">
          <Input
            type="search"
            placeholder={t('Название или результат проверки')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>
      {conditions.length > 0 && (
        <p className="control-result" role="status">
          {`${found} ${conditions.join(', ')}`}
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Icon name="search" />}
          title={t('По этим условиям открытых неисправностей нет')}
          data-testid="incidents-filter-empty"
          actions={
            <Button tone="secondary" type="button" onClick={reset}>
              {t('Сбросить фильтры')}
            </Button>
          }
        >
          {t('Ничего не нашлось {conditions}. Открытых всего {n}.', { conditions: conditions.join(', '), n: incidents.length })}
        </EmptyState>
      ) : (
        <ul className="incident-cards">
          {rows.map((i) => (
            <li
              key={i.id}
              className={cx('incident', i.severity === 'CRITICAL' && 'incident--critical')}
              data-testid="incident-row"
              data-kind={i.kind}
              data-id={i.id}
              data-severity={i.severity}
            >
              <div className="incident__head">
                <h3 className="incident__title">{incidentHeadline(i.title).headline}</h3>
                <Badge tone={STATUS_TONE[i.status]} data-testid="incident-status">
                  {t(STATUS_RU[i.status])}
                </Badge>
              </div>
              {incidentHeadline(i.title).details && (
                <details className="incident__details">
                  <summary>{t('Технические подробности')}</summary>
                  <pre>{incidentHeadline(i.title).details}</pre>
                </details>
              )}
              <p className="incident__facts">
                {i.severity === 'CRITICAL' && <span className="incident__urgent">{t('Срочно.')} </span>}
                {t('Замечена')} <time dateTime={i.firstSeenAt}>{clock.when(i.firstSeenAt)}</time>.{' '}
                {repeatWords(i, locale, t)}{' '}
                {i.alertedAt && (
                  <>
                    {t('Будильник сработал')} <time dateTime={i.alertedAt}>{clock.when(i.alertedAt)}</time>
                    .
                  </>
                )}
              </p>
              <p className="incident__guard">{guardWords(i, locale, t)}</p>
              <div className="incident__actions">
                <IncidentButtons id={i.id} canAcknowledge={i.status !== 'ACKNOWLEDGED'} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
