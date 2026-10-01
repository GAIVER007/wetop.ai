'use client';
import { useId, useRef, useTransition } from 'react';
import type { DeskShell } from '../../lib/desk-person';
import { switchScopeAction } from '../../app/actions/scope';

/**
 * Переключатель филиала (Platform P3, ADR-130; Q-215): у организации с одним филиалом — статичная подпись
 * (филиал строкой, бизнес второй строкой), без списка; при двух и больше — родной `<select>` (компонент `Select` из `ui.tsx`, 38 px),
 * смена значения сразу отправляет форму — выбор кладётся в куку серверным действием, и макет перечитывается.
 * Новых компонентов нет: подпись и поле формы из реестра DESIGN.md §8.
 */
export function ScopeSwitcher({ workspace }: { workspace: NonNullable<DeskShell['workspace']> }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const { business, location, options } = workspace;
  if (options.length === 0) return null;
  // DESIGN.md §14: подпись не склеивается точкой — филиал строкой, бизнес — второй строкой
  if (options.length === 1) {
    return (
      <p className="workspace-scope" data-testid="scope-label">
        <span>{location?.name ?? business?.name}</span>
        {business && location && <small>{business.name}</small>}
      </p>
    );
  }
  const businesses = [...new Set(options.map((o) => o.businessId))];
  const current = location ? `${business?.id ?? ''}/${location.id}` : '';
  return (
    <form
      ref={form}
      action={(data) => start(() => switchScopeAction(data))}
      className="workspace-scope workspace-scope--switch"
      data-testid="scope-switcher"
    >
      <label htmlFor={id}>Филиал</label>
      {/* ключ — текущий выбор: после «Открыть» в таблице макет перечитан, и поле должно показать новый филиал */}
      <select
        key={current}
        id={id}
        name="scope"
        className="input"
        defaultValue={current}
        disabled={pending}
        aria-busy={pending}
        onChange={() => form.current?.requestSubmit()}
      >
        {businesses.length === 1
          ? options.map((o) => (
              <option key={o.locationId} value={`${o.businessId}/${o.locationId}`}>
                {o.locationName}
              </option>
            ))
          : businesses.map((id) => (
              <optgroup key={id} label={options.find((o) => o.businessId === id)?.businessName}>
                {options
                  .filter((o) => o.businessId === id)
                  .map((o) => (
                    <option key={o.locationId} value={`${o.businessId}/${o.locationId}`}>
                      {o.locationName}
                    </option>
                  ))}
              </optgroup>
            ))}
      </select>
      {pending && <span className="muted">Переключаю…</span>}
    </form>
  );
}
