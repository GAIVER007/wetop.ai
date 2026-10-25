'use client';
import { useState, type ReactNode } from 'react';
import { msg } from '../i18n';
import { useT } from '../i18n/locale-provider';
import { IconField } from './icon-field';
import { Tabs } from './tabs';
import { Field, Input, Table } from './ui';

/**
 * Экран персонала, один вид для салона, ресторана и гостиницы (вариант A «Рабочая таблица», решение владельца
 * 20.10.2026, docs/decisions/2026-10-20-unified-staff-screen.md, DESIGN.md §8.4). Плиток сводки нет (владелец
 * 20.10.2026: «убери вообще»). Карточка: поиск и период в одной полосе, вкладки, таблица (каждый человек в одну строку), итог под таблицей.
 * Направление передаёт только слова, строки и ячейки; раскладку и стили не трогает.
 */
export interface StaffColumn<T> {
  key: string;
  label: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'start' | 'end';
  /** колонки нет у направления (у гостиницы нет смены): не рисуется вовсе */
  hidden?: boolean;
  /** класс ячеек колонки: например, скрыть второстепенную колонку на телефоне */
  className?: string;
  /** testid ячейки, как было у раздела */
  testId?: string;
}
export interface StaffTab<T> {
  id: string;
  label: string;
  rows: T[];
  /** «Не назначено»: число подсвечивается предупреждением */
  warn?: boolean;
  /** подсказка над таблицей вкладки */
  note?: ReactNode;
  empty?: ReactNode;
}

const cellClass = (c: { align?: 'start' | 'end'; className?: string }) =>
  [c.align === 'end' && 'staff-board__end', c.className].filter(Boolean).join(' ') || undefined;

export function StaffBoard<T extends { id: string }>({
  caption,
  tabs,
  columns,
  search,
  period,
  footer,
  actions,
  searchPlaceholder = msg('Поиск по имени или телефону'),
  rowTestId = 'staff-row',
  tableTestId,
  notice,
  emptyAction,
}: {
  /** кнопка в пустом состоянии вкладки «Все» (аудит 21.10.2026, п. 19) */
  emptyAction?: ReactNode;
  caption: string;
  tabs: StaffTab<T>[];
  columns: StaffColumn<T>[];
  /** текст строки для поиска; нет = поиска нет */
  search?: (row: T) => string;
  /** «День / Неделя / Месяц» ссылками; нет права на отчёты = null */
  period?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  searchPlaceholder?: string;
  /** прежние имена для тестов раздела: строка и таблица */
  rowTestId?: string;
  tableTestId?: string;
  /** отказ действия или предупреждение над таблицей */
  notice?: ReactNode;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('ru');
  const shown = columns.filter((c) => !c.hidden);
  const match = (row: T) => !needle || !search || search(row).toLocaleLowerCase('ru').includes(needle);
  const all = tabs[0]?.rows.length ?? 0;
  const visible = tabs[0]?.rows.filter(match).length ?? 0;
  const table = (tab: StaffTab<T>) => {
    const rows = tab.rows.filter(match);
    if (rows.length === 0)
      return (
        <div className="staff-board__empty">
          <p className="muted">{needle ? t('Никого не нашли') : (tab.empty ?? t('Пока никого нет'))}</p>
          {!needle && all === 0 && emptyAction}
        </div>
      );
    return (
      <Table
        density="compact"
        caption={caption}
        captionHidden
        nowrap
        className="staff-board__table"
        {...(tableTestId ? { 'data-testid': tableTestId } : {})}
      >
        <thead>
          <tr>
            {shown.map((c) => (
              <th key={c.key} scope="col" className={cellClass(c)}>
                {typeof c.label === 'string' ? t(c.label) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={rowTestId}>
              {shown.map((c) => {
                const v = c.cell(row);
                return (
                  <td key={c.key} className={cellClass(c)} data-testid={c.testId}>
                    {v === null || v === undefined || v === '' ? <span className="muted">—</span> : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };
  return (
    <div className="staff-board" data-testid="staff-board">
      {actions && <div className="staff-board__actions">{actions}</div>}
      <section className="staff-board__card">
        <div className="staff-board__tools">
          {search && (
            <Field label={<span className="sr-only">{t('Поиск')}</span>}>
              <IconField icon="search">
                <Input
                  type="search"
                  placeholder={t(searchPlaceholder)}
                  data-page-search
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </IconField>
            </Field>
          )}
          {/* период нужен только колонке «Принёс»: без строк его нет (п. 18) */}
          {all > 0 && period}
        </div>
        {notice}
        {tabs.length === 1 ? (
          <>
            {tabs[0]!.note && <p className="staff-board__note muted">{tabs[0]!.note}</p>}
            {table(tabs[0]!)}
          </>
        ) : (
        <Tabs
          key={tabs.map((tab) => tab.id).join(' ')}
          label={t('Назначение в персонале')}
          className="staff-board__tabs"
          panels={tabs.map((tab) => ({
            id: tab.id,
            label: t(tab.label),
            count: tab.rows.length,
            content: (
              <>
                {tab.note && <p className="staff-board__note muted">{tab.note}</p>}
                {table(tab)}
              </>
            ),
          }))}
        />
        )}
        <div className="staff-board__foot">
          <span>{footer}</span>
          <span>
            {t('Показано {visible} из {all}', { visible, all })}
          </span>
        </div>
      </section>
    </div>
  );
}
