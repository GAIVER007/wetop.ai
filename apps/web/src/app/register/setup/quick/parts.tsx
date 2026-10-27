'use client';
import Link from 'next/link';
import type { ClipboardEvent, ReactNode } from 'react';
import { Button, Input, Select } from '../../../../components/ui';
import { useT } from '../../../../i18n/locale-provider';
import type { QuickIssue } from './model';

/**
 * Общие части окна быстрого запуска (салон, гостиница, ресторан, владелец 27.10.2026): плитки разделов, таблица строк
 * с полями в окне, список замечаний с кнопкой исправления и итоговый экран варианта А.
 */

export type TileState = 'done' | 'empty' | 'warning' | 'error';
export function Tiles<S extends string>({
  tiles,
  open,
  onOpen,
}: {
  tiles: Array<{ id: S; title: string; count: number; state: TileState; optional?: boolean }>;
  open: S;
  onOpen: (id: S) => void;
}) {
  const t = useT();
  return (
    <div className="quick-tiles" role="tablist">
      {tiles.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={open === s.id}
          className={`quick-tile is-${s.state}${open === s.id ? ' is-open' : ''}`}
          onClick={() => onOpen(s.id)}
        >
          <b>{s.count}</b>
          <span>{t(s.title)}</span>
          <small>
            {s.state === 'done'
              ? t('готово')
              : s.state === 'empty'
                ? s.optional
                  ? t('можно позже')
                  : t('заполнить')
                : t('проверить')}
          </small>
        </button>
      ))}
    </div>
  );
}

export interface Column<R> {
  field: keyof R & string;
  label: string;
  kind?: 'text' | 'number' | 'email' | 'tel' | 'select';
  options?: Array<[string, string]>;
  /** поле не показывается в этой строке (например, оклад у «без оклада») */
  hidden?: (row: R) => boolean;
}
export function RowsTable<R extends Record<string, string>>({
  rows,
  columns,
  cellClass,
  onChange,
  onRemove,
  onPaste,
}: {
  rows: R[];
  columns: Column<R>[];
  cellClass: (row: number, field: string) => string;
  onChange: (row: number, patch: Partial<R>) => void;
  onRemove: (row: number) => void;
  onPaste: (e: ClipboardEvent<HTMLTableSectionElement>) => void;
}) {
  const t = useT();
  return (
    <table className="quick-table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.field} scope="col" className={c.kind === 'number' || c.kind === 'select' ? `quick-col--${c.kind}` : undefined}>
              {t(c.label)}
            </th>
          ))}
          <th scope="col">
            <span className="sr-only">{t('Убрать')}</span>
          </th>
        </tr>
      </thead>
      <tbody onPaste={onPaste}>
        {rows.map((r, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.field} className={cellClass(i, c.field)}>
                {c.hidden?.(r) ? null : c.kind === 'select' ? (
                  <Select aria-label={t(c.label)} value={r[c.field]} onChange={(e) => onChange(i, { [c.field]: e.target.value } as Partial<R>)}>
                    {c.options!.map(([v, label]) => (
                      <option key={v} value={v}>
                        {t(label)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    aria-label={t(c.label)}
                    type={c.kind === 'email' || c.kind === 'tel' ? c.kind : 'text'}
                    inputMode={c.kind === 'number' ? 'decimal' : undefined}
                    value={r[c.field]}
                    onChange={(e) => onChange(i, { [c.field]: e.target.value } as Partial<R>)}
                  />
                )}
              </td>
            ))}
            <td>
              <Button type="button" tone="ghost" size="sm" aria-label={t('Убрать')} onClick={() => onRemove(i)}>
                ×
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IssueList<S extends string>({
  issues,
  rowName,
  onFix,
}: {
  issues: QuickIssue<S>[];
  rowName: (i: QuickIssue<S>) => string;
  onFix: (i: QuickIssue<S>) => void;
}) {
  const t = useT();
  if (!issues.length) return null;
  return (
    <ul className="quick-issues" data-testid="quick-issues">
      {issues.map((i, n) => (
        <li key={n} className={i.level === 'error' ? 'quick-fix is-error' : 'quick-fix is-warning'}>
          <span>
            {rowName(i) && <b>{rowName(i)} </b>}
            {t(i.text, i.params ?? {})}
          </span>
          {i.fix && (
            <Button type="button" tone="secondary" size="sm" onClick={() => onFix(i)}>
              {i.fix.kind === 'set' ? i.fix.label : t(i.fix.label)}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Chips<V extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<[V, string]>;
  value: V[];
  onChange: (next: V[]) => void;
}) {
  const t = useT();
  return (
    <div className="quick-chips">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value.includes(v)}
          className="quick-chip"
          onClick={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])}
        >
          {t(label)}
        </button>
      ))}
    </div>
  );
}

/** Итоговый экран варианта А: шапка, пять цифр, три колонки созданного, действия */
export interface DoneCard {
  title: string;
  rows: Array<{ key: string; cells: ReactNode[] }>;
  more?: { href: string; label: string };
}
export function DoneLayout({
  title,
  line,
  kpis,
  cards,
  warnings,
  actions,
}: {
  title: string;
  line: string;
  kpis: Array<[number, string]>;
  cards: DoneCard[];
  warnings: string[];
  actions: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  const t = useT();
  return (
    <section className="quick-done" data-testid="quick-done" aria-labelledby="quick-done-title">
      <header className="quick-done__hero">
        <h2 id="quick-done-title">{title}</h2>
        <p>{line}</p>
      </header>
      <dl className="quick-done__kpis">
        {kpis.map(([n, label]) => (
          <div key={label} className="quick-done__kpi">
            <dd>{n}</dd>
            <dt>{t(label)}</dt>
          </div>
        ))}
      </dl>
      <div className="quick-done__grid">
        {cards.map((c, n) => (
          <section key={c.title} className="quick-done__card" aria-labelledby={`quick-done-card-${n}`}>
            <h3 id={`quick-done-card-${n}`}>{t(c.title)}</h3>
            <table>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.key}>
                    {r.cells.map((cell, k) => (
                      <td key={k} className={k ? 'quick-done__num' : undefined}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {c.more && (
              <Link className="quick-done__more" href={c.more.href}>
                {c.more.label}
              </Link>
            )}
          </section>
        ))}
      </div>
      {warnings.length > 0 && (
        <p className="quick-done__warn" role="status">
          {warnings.join('; ')}
        </p>
      )}
      <div className="quick-done__actions">
        {actions.map((a) => (
          <Link key={a.href} className={a.primary ? 'btn quick-go' : 'btn btn--secondary'} href={a.href}>
            {t(a.label)}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Person({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join('');
  return (
    <span className="quick-done__person">
      <span className="quick-done__avatar" aria-hidden="true">
        {initials}
      </span>
      {name}
    </span>
  );
}

export function InvitePill({ state }: { state: 'sent' | 'failed' | 'none' }) {
  const t = useT();
  return (
    <span className={`quick-done__pill is-${state}`}>
      {state === 'sent' ? t('письмо ушло') : state === 'failed' ? t('не отправлено') : t('без входа')}
    </span>
  );
}
