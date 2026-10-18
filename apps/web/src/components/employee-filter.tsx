'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { Button, Input } from './ui';
import './quick-report.css';

export function EmployeeFilter({
  options,
  value,
  onChange,
  allLabel = 'Все сотрудники',
}: {
  options: Array<{ id: string; name: string }>;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState('');
  const label = value
    ? (options.find((e) => e.id === value)?.name ?? 'Сотрудник недоступен')
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
      <summary className="btn btn--secondary" aria-label={`Выбрать сотрудника: ${label}`}>
        <Icon name="person" />
        <span>{label}</span>
        <Icon name="down" />
      </summary>
      <div className="employee-filter-menu">
        <Input
          type="search"
          aria-label="Поиск сотрудника"
          placeholder="Найти по имени"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="employee-filter-list" aria-label="Сотрудники">
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
            ) && <p role="status">Сотрудники не найдены</p>}
        </div>
      </div>
    </details>
  );
}
