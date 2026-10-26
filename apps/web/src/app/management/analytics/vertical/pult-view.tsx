import Link from 'next/link';
import type { ReactNode } from 'react';
import { Panel } from '../../../../components/ui';
import { ShareBar, type ShareBarTone } from '../../../../components/share-bar';
import { cx } from '../../../../components/ui';
import type { Translate } from '../../../../i18n';
import type { Insight } from './pult';
import '../analytics.css';
import './pult.css';

/**
 * Общие блоки пульта владельца (вариант A, 25.10.2026) для салона, ресторана и гостиницы: подсказки «что сделать
 * сейчас» и доли полосками. Данные направления собирают свои экраны, разметка и стили одни.
 */
export function InsightsPanel({
  items,
  money,
  t,
  words,
}: {
  items: Insight[];
  /** сумма `sum` подсказки в минорных единицах словами валюты филиала */
  money: (minor: string) => string;
  t: Translate;
  /** подстановки, которые сами переводятся (день недели, часть дня) */
  words?: (x: Insight) => Record<string, string>;
}) {
  const vars = (x: Insight) => ({
    ...Object.fromEntries(
      Object.entries(x.vars ?? {}).map(([k, v]) => [k, k === 'sum' ? money(String(v)) : v]),
    ),
    ...(words ? words(x) : {}),
  });
  return (
    <Panel title={t('Что сделать сейчас')} className="pult-insights" data-testid="pult-insights">
      <ul>
        {items.map((x) => (
          <li
            key={x.id}
            className={cx('pult-insight', `pult-insight--${x.tone}`)}
            data-testid={`insight-${x.id}`}
          >
            <b>{t(x.title, vars(x))}</b>
            <span className="muted">{t(x.text, vars(x))}</span>
            <Link className="btn btn--secondary btn--sm" href={x.href}>
              {t(x.action)}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export interface ShareRow {
  key: string;
  label: string;
  value: number;
  /** подпись справа: число или сумма */
  text: ReactNode;
  tone?: ShareBarTone;
  testId?: string;
}

export function ShareList({ rows, empty, t }: { rows: ShareRow[]; empty: string; t: Translate }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  if (!rows.length || max === 0) return <p className="pult-empty">{t(empty)}</p>;
  return (
    <ul className="pult-shares">
      {rows.map((r) => (
        <li key={r.key}>
          <span>{r.label}</span>
          <ShareBar
            label={r.label}
            value={r.value}
            max={max}
            {...(r.tone ? { tone: r.tone } : {})}
          />
          <b {...(r.testId ? { 'data-testid': r.testId } : {})}>{r.text}</b>
        </li>
      ))}
    </ul>
  );
}

export function Facts({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode; testId?: string }>;
}) {
  return (
    <dl className="pult-facts">
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd {...(r.testId ? { 'data-testid': r.testId } : {})}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
