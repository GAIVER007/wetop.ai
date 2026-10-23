'use client';

import { useEffect, useState } from 'react';
import { passwordStrength } from '../lib/password-strength';

import styles from './password-strength.module.css';

/**
 * Полоска надёжности нового пароля под полем регистрации (пожелание владельца 22.10.2026, образец
 * `PasswordStrength`). Без Tailwind и `motion`: переходы на CSS, при «уменьшить движение» их нет. Озвучка для
 * экранного диктора приходит с задержкой, чтобы не читать оценку на каждой букве.
 */
export function PasswordStrengthMeter({ value }: { value: string }) {
  const state = passwordStrength(value);
  const [announcement, setAnnouncement] = useState('');
  const spoken = value
    ? `Надёжность пароля: ${state.label.toLowerCase()}.${state.guessable ? ' Похоже на частый пароль.' : ''}`
    : '';
  useEffect(() => {
    const id = window.setTimeout(() => setAnnouncement(spoken), 700);
    return () => window.clearTimeout(id);
  }, [spoken]);

  return (
    <div className={styles.strength} data-score={state.score}>
      <div
        className={styles.bars}
        role="meter"
        aria-label="Надёжность пароля"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={state.score}
        aria-valuetext={state.label || 'Пароль не введён'}
      >
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={styles.bar} data-on={i <= state.score} />
        ))}
      </div>
      <div className={styles.caption} aria-hidden="true">
        <span className={styles.level}>{state.label}</span>
        {state.guessable ? <span className={styles.warn}>Похоже на частый пароль</span> : null}
      </div>
      <ul className={styles.rules}>
        {state.rules.map((rule) => (
          <li key={rule.id} className={styles.rule} data-met={rule.met}>
            <span className={styles.mark} aria-hidden="true">
              <svg viewBox="0 0 12 12" fill="none">
                <path d="M2 6.2 4.7 8.9 10 3.3" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              {rule.label}
              {rule.required ? ' (обязательно)' : ''}
            </span>
            <span className={styles.srOnly}>{rule.met ? 'выполнено' : 'не выполнено'}</span>
          </li>
        ))}
      </ul>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
