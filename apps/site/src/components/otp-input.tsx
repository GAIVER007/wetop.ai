'use client';

import { useId, useImperativeHandle, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from 'react';

import styles from './otp-input.module.css';

export type OtpStatus = 'idle' | 'pending' | 'success' | 'error';

export type OtpInputHandle = { clear: () => void; focus: () => void };

type Props = {
  /** Сколько цифр. В WETOP код подтверждения почты из шести. */
  length?: number;
  status?: OtpStatus;
  label: string;
  hint?: string;
  errorMessage?: string | null;
  successMessage?: string;
  disabled?: boolean;
  onComplete: (code: string) => void;
  ref?: Ref<OtpInputHandle>;
};

/**
 * Поле кода из письма: отдельная клетка на каждую цифру (пожелание владельца 22.10.2026, образец `OtpInput`).
 * Сайт без Tailwind и без анимационных пакетов, поэтому собран на CSS-модуле. Доступность: одна подпись на группу,
 * у каждой клетки своё имя «цифра N из 6», `autocomplete="one-time-code"` у первой клетки подставляет код из СМС или
 * уведомления почты на телефоне, вставка всего кода в любую клетку раскладывает цифры по местам.
 */
export function OtpInput({
  length = 6,
  status = 'idle',
  label,
  hint,
  errorMessage,
  successMessage,
  disabled = false,
  onComplete,
  ref,
}: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ''));
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const messageId = useId();
  const firstEmpty = () => {
    const i = digits.findIndex((d) => d === '');
    return i === -1 ? length - 1 : i;
  };

  useImperativeHandle(ref, () => ({
    clear: () => {
      setDigits(Array.from({ length }, () => ''));
      cells.current[0]?.focus();
    },
    focus: () => cells.current[firstEmpty()]?.focus(),
  }));

  const commit = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const fill = (from: number, raw: string) => {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    // Весь код целиком (вставка или подстановка телефона) всегда кладётся с первой клетки
    const start = incoming.length >= length ? 0 : from;
    const next = [...digits];
    for (let i = 0; i < incoming.length && start + i < length; i++) next[start + i] = incoming[i]!;
    commit(next);
    cells.current[Math.min(start + incoming.length, length - 1)]?.focus();
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      cells.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      cells.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      cells.current[index + 1]?.focus();
    }
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fill(index, event.clipboardData.getData('text'));
  };

  const busy = disabled || status === 'pending' || status === 'success';
  const message =
    status === 'error' && errorMessage ? errorMessage : status === 'success' ? successMessage : hint;

  return (
    <div className={styles.otp} data-status={status}>
      <div className={styles.cells} role="group" aria-label={label} aria-describedby={messageId}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              cells.current[index] = node;
            }}
            className={styles.cell}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            // первая клетка принимает весь код от подстановки телефона, остальные по одной цифре
            maxLength={index === 0 ? length : 1}
            aria-label={`Цифра ${index + 1} из ${length}`}
            aria-invalid={status === 'error'}
            value={digit}
            disabled={busy}
            autoFocus={index === 0}
            onChange={(event) => {
              const value = event.target.value;
              if (value === '') {
                const next = [...digits];
                next[index] = '';
                setDigits(next);
                return;
              }
              // клетка уже с цифрой: новая цифра заменяет старую, а не дописывается
              const incoming = value.replace(/\D/g, '');
              fill(index, digit && incoming.length === 2 ? incoming.replace(digit, '') : incoming);
            }}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
      {message ? (
        <p
          id={messageId}
          className={styles.message}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
