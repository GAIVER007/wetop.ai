'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { Button, Input } from './ui';
import './quick-report.css';

/** Слова фильтра: у салона это специалисты (меню «Персонал → Специалисты», 18.10.2026), у ресторана сотрудники */
const WORDS = {
  staff: { one: 'сотрудника', unavailable: 'Сотрудник недоступен', list: 'Сотрудники', none: 'Сотрудники не найдены' },
  specialists: {
    one: 'специалиста',
    unavailable: 'Специалист недоступен',
    list: 'Специалисты',
    none: 'Специалисты не найдены',
  },
};

export function EmployeeFilter({
  options,
  value,
  onChange,
  allLabel = 'Все сотрудники',
  kind = 'staff',
}: {
  options: Array<{ id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  kind?: keyof typeof WORDS;
}) {
  const words = WORDS[kind];
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState('');
  const label = value
    ? (options.find((e) => e.id === value)?.name ?? words.unavailable)
    : allLabel;
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
      <summary className="btn btn--secondary" aria-label={`Выбрать ${words.one}: ${label}`}>
        <Icon name="person" />
        <span>{label}</span>
        <Icon name="down" />
      </summary>
      <div className="employee-filter-menu">
        <Input
          type="search"
          aria-label={`Поиск ${words.one}`}
          placeholder="Найти по имени"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="employee-filter-list" aria-label={words.list}>
          <Button tone="ghost" aria-pressed={!value} onClick={() => choose('')}>
            {allLabel}
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
            ) && <p role="status">{words.none}</p>}
        </div>
      </div>
    </details>
  );
}
