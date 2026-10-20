import type { ReactNode } from 'react';

/**
 * Выключатель «да / нет» (ADR-158, DESIGN.md §8.3): настройка, которая либо включена, либо нет, и действует после
 * «Сохранить». Родной `input[type=checkbox]` с `role="switch"`, поэтому клавиатура, фокус и состояние читалки
 * браузерные: Tab, пробел. Внутри формы шлёт пару значений: скрытое `false` и, если включено, `true`; значением
 * поля считается последнее (`FormData.getAll(name).at(-1)`). Вид только из токенов, без цвета статуса.
 */
export function Switch({
  name,
  label,
  hint,
  icon,
  defaultChecked,
  disabled,
  inverted,
  className,
  checked,
  onChange,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Значок слева от подписи (по желанию) */
  icon?: ReactNode;
  defaultChecked?: boolean | undefined;
  disabled?: boolean | undefined;
  /**
   * Обратный смысл: включено значит `false` («Курение запрещено» над полем «курение разрешено»). `defaultChecked`
   * задают в терминах выключателя, то есть «запрещено», а не значения поля.
   */
  inverted?: boolean | undefined;
  className?: string | undefined;
  /** Управляемый вид без формы (сетка графика): состояние и реакция снаружи */
  checked?: boolean | undefined;
  onChange?: ((checked: boolean) => void) | undefined;
}) {
  return (
    <label className={className ? `switch ${className}` : 'switch'}>
      {icon && <span className="switch__icon">{icon}</span>}
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {hint && <span className="switch__hint">{hint}</span>}
      </span>
      <input type="hidden" name={name} value={inverted ? 'true' : 'false'} disabled={disabled} />
      <input
        className="switch__input"
        type="checkbox"
        role="switch"
        name={name}
        value={inverted ? 'false' : 'true'}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange && ((e) => onChange(e.target.checked))}
        disabled={disabled}
      />
      <span className="switch__track" aria-hidden="true" />
    </label>
  );
}
