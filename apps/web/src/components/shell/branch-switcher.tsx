'use client';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { branchChoices, selectBranch } from '../../app/branches/actions';
import { Icon } from '../icon';

export function BranchSwitcher({
  children,
  path,
  close,
}: {
  children: ReactNode;
  path: string;
  close?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Awaited<ReturnType<typeof branchChoices>> | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, load] = useTransition();
  const [switching, switchTo] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function refresh() {
    load(async () => {
      setChoices(await branchChoices());
    });
  }
  function choose(branchId: string) {
    setError('');
    switchTo(async () => {
      try {
        const data = new FormData();
        data.set('id', branchId);
        data.set('returnTo', path);
        await selectBranch(data);
        setOpen(false);
        close?.();
      } catch {
        setError('Не удалось переключить филиал. Обновите список и повторите.');
      }
    });
  }
  return (
    <div
      className="branch-switcher"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="workspace-property"
        aria-label="Выбрать филиал"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setSearch('');
          setError('');
          if (!open) refresh();
        }}
      >
        {children}
        <Icon name="chevron" width={14} />
      </button>
      {open && (
        <section
          id={id}
          className="branch-switcher__list"
          aria-label="Выбор филиала"
          aria-busy={loading || switching}
        >
          <strong>Ваши филиалы</strong>
          {loading ? (
            <p role="status">Загружаем…</p>
          ) : choices?.items ? (
            <>
              {choices.items.length > 5 && (
                <input
                  className="inp"
                  aria-label="Найти филиал"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Название или адрес"
                />
              )}
              <div className="branch-switcher__options">
                {choices.items
                  .filter((item) =>
                    `${item.name} ${item.address ?? ''}`
                      .toLocaleLowerCase('ru')
                      .includes(search.toLocaleLowerCase('ru')),
                  )
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={switching}
                      aria-pressed={item.id === choices.currentId}
                      onClick={() =>
                        item.id === choices.currentId ? setOpen(false) : choose(item.id)
                      }
                    >
                      <strong>{item.name}</strong>
                      <span>{item.address || 'Адрес не указан'}</span>
                      {item.id === choices.currentId && <small>Текущий филиал</small>}
                    </button>
                  ))}
                {choices.items.length === 0 && <p>Нет доступных филиалов.</p>}
              </div>
            </>
          ) : (
            <>
              <p role="alert">{choices?.error}</p>
              <button className="btn" type="button" onClick={refresh}>
                Повторить
              </button>
            </>
          )}
          {switching && <p role="status">Переключаем филиал…</p>}
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}
