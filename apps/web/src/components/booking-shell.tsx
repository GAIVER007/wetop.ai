'use client';
import type { ReactNode } from 'react';
import '../app/booking-shell.css';

/**
 * Окно брони одного вида во всех направлениях (решение владельца 23.10.2026, вариант B,
 * `docs/decisions/2026-10-23-booking-window.md`): слева форма (даты, гость, детали), справа выбор кнопками
 * (номера гостиницы, время мастера салона, столы ресторана), внизу итог и главная кнопка. Раздел отдаёт только
 * своё содержимое; раскладку, отступы и подвал держит этот каркас.
 */
export function BookingShell({
  form,
  pick,
  pickLabel,
  footer,
  className = '',
  footerClassName = '',
}: {
  form: ReactNode;
  pick: ReactNode;
  /** имя правой части для чтения с экрана: «Свободные номера», «Свободное время», «Свободные столы» */
  pickLabel: string;
  footer: ReactNode;
  className?: string;
  /** класс подвала раздела (гостиница: `booking-footer`, его ищут проверки телефона) */
  footerClassName?: string;
}) {
  return (
    <div className={`booking-shell ${className}`.trim()}>
      <div className="booking-shell__form">{form}</div>
      <section className="booking-shell__pick" aria-label={pickLabel}>
        {pick}
      </section>
      <div className={`booking-shell__footer ${footerClassName}`.trim()}>{footer}</div>
    </div>
  );
}

/** Шапка правой части: что выбираем и на какое время, справа подсказка или состояние проверки */
export function PickHeading({ title, note }: { title: ReactNode; note?: ReactNode }) {
  return (
    <div className="booking-pick__head">
      <h3>{title}</h3>
      {note ? <span className="booking-pick__note">{note}</span> : null}
    </div>
  );
}

/**
 * Группа выбора: категория номеров, специалист, зал. Шапка называет группу и даёт факты (свободно N, вместимость),
 * кнопки внутри. Неподходящая группа видна серой и без кнопок: понятно, почему её нельзя выбрать.
 */
export function PickGroup({
  title,
  facts,
  selected = false,
  unavailable,
  children,
  testId,
}: {
  title: ReactNode;
  facts?: ReactNode;
  selected?: boolean;
  /** почему группа не подходит («до 1 гостя»): без кнопок и серым */
  unavailable?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="booking-pick__group"
      data-selected={selected || undefined}
      data-unavailable={unavailable ? true : undefined}
      data-testid={testId}
    >
      <div className="booking-pick__group-head">
        <b>{title}</b>
        {unavailable ? (
          <span className="booking-pick__muted">{unavailable}</span>
        ) : (
          facts && <span className="booking-pick__facts">{facts}</span>
        )}
      </div>
      {!unavailable && children ? <div className="booking-pick__options">{children}</div> : null}
    </div>
  );
}

/** Кнопка выбора: номер, время, стол. Отметка (точка) говорит о том, что стоит учесть, словами в подсказке */
export function PickButton({
  children,
  selected,
  onClick,
  disabled = false,
  label,
  mark,
  wide = false,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** полное имя для чтения с экрана и подсказки: «Номер 12, ещё не убран» */
  label: string;
  /** отметка внимания: номер не убран */
  mark?: boolean;
  /** для «Назначить позже» и других слов */
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className="booking-pick__option"
      data-mark={mark || undefined}
      data-wide={wide || undefined}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Подвал окна: итог слева (сумма, срок), строка сути посередине, кнопки справа */
export function BookingFooter({
  total,
  digest,
  digestTestId,
  children,
}: {
  total?: ReactNode;
  digest?: ReactNode;
  digestTestId?: string;
  children: ReactNode;
}) {
  return (
    <>
      {total ? <div className="booking-shell__total">{total}</div> : null}
      <p className="booking-shell__digest" data-testid={digestTestId}>
        {digest}
      </p>
      <div className="booking-shell__actions">{children}</div>
    </>
  );
}
