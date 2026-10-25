'use client';
import { useEffect, useRef, useState } from 'react';
import { msg } from '../i18n';
import { useT } from '../i18n/locale-provider';
import { Icon } from './icon';
import { Button, Input } from './ui';
import './quick-report.css';

/** Слова фильтра: у салона это специалисты (меню «Персонал → Специалисты», 18.10.2026), у ресторана сотрудники */
const WORDS = {
  staff: {
    pick: msg('Выбрать сотрудника: {name}'),
    search: msg('Поиск сотрудника'),
    unavailable: msg('Сотрудник недоступен'),
    list: msg('Сотрудники'),
    none: msg('Сотрудники не найдены'),
  },
  specialists: {
    pick: msg('Выбрать специалиста: {name}'),
    search: msg('Поиск специалиста'),
    unavailable: msg('Специалист недоступен'),
    list: msg('Специалисты'),
    none: msg('Специалисты не найдены'),
  },
};

export function EmployeeFilter({
  options,
  value,
  onChange,
  allLabel = msg('Все сотрудники'),
  kind = 'staff',
}: {
  options: Array<{ id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  kind?: keyof typeof WORDS;
}) {
  const t = useT();
  const words = WORDS[kind];
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState('');
  const label = value
    ? (options.find((e) => e.id === value)?.name ?? t(words.unavailable))
    : t(allLabel);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !details.current?.contains(event.target) &&
        details.current
      )
        details.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const choose = (id: string) => {
    onChange(id);
    setSearch('');
    if (details.current) {
      details.current.open = false;
      details.current.querySelector('summary')?.focus();
    }
  };
  return (
    <details
      ref={details}
      className="employee-filter"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && details.current?.open) {
          e.preventDefault();
          details.current.open = false;
          details.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="btn btn--secondary" aria-label={t(words.pick, { name: label })}>
        <Icon name="person" />
        <span>{label}</span>
        <Icon name="down" />
      </summary>
      <div className="employee-filter-menu">
        <Input
          type="search"
          aria-label={t(words.search)}
          placeholder={t('Найти по имени')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="employee-filter-list" aria-label={t(words.list)}>
          <Button tone="ghost" aria-pressed={!value} onClick={() => choose('')}>
            {t(allLabel)}
          </Button>
          {options
            .filter((e) =>
              e.name.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')),
            )
            .map((e) => (
              <Button
                tone="ghost"
                key={e.id}
                aria-pressed={value === e.id}
                onClick={() => choose(e.id)}
              >
                {e.name}
              </Button>
            ))}
          {search &&
            !options.some((e) =>
              e.name.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')),
            ) && <p role="status">{t(words.none)}</p>}
        </div>
      </div>
    </details>
  );
}
