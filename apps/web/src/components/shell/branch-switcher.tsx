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
  const filtered =
    choices?.items?.filter((item) =>
      `${item.name} ${item.address ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(search.trim().toLocaleLowerCase('ru')),
    ) ?? [];
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
    setOpen(false);
    window.dispatchEvent(new Event('wetop-scope-switch'));
    switchTo(async () => {
      try {
        const data = new FormData();
        data.set('id', branchId);
        data.set('returnTo', path);
        await selectBranch(data);
        setOpen(false);
        close?.();
      } catch {
        window.dispatchEvent(new Event('wetop-scope-switch-failed'));
        setError('Не удалось переключить филиал. Обновите список и повторите.');
      }
    });
  }
  return (
    <div
      className="branch-switcher"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
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
        disabled={switching}
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
          <div className="branch-switcher__heading">
            <strong>Выберите филиал</strong>
            <span>{choices?.items?.length ?? ''}</span>
          </div>
          {loading ? (
            <p role="status">Загружаем…</p>
          ) : choices?.items ? (
            <>
              {choices.items.length > 1 && (
                <input
                  className="inp"
                  aria-label="Найти филиал"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Название или адрес"
                />
              )}
              <div className="branch-switcher__options">
                {filtered.map((item) => (
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
                    {item.id === choices.currentId && <Icon name="check" width={16} />}
                    <span title={item.address || undefined}>
                      {item.address || 'Адрес не указан'}
                    </span>
                    {item.id === choices.currentId && (
                      <small className="sr-only">Текущий филиал</small>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p role="status">{search ? 'Филиалы не найдены' : 'Нет доступных филиалов.'}</p>
                )}
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
