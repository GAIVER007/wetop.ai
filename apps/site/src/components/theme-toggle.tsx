'use client';
import { useEffect, useState } from 'react';
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('wetop-theme');
    } catch {
      /* System theme remains available. */
    }
    const value =
      saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(value);
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
  }, []);
  return (
    <button
      className="theme-toggle"
      aria-label="Переключить тему"
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => {
        const value = !dark;
        setDark(value);
        document.documentElement.dataset.theme = value ? 'dark' : 'light';
        try {
          localStorage.setItem('wetop-theme', value ? 'dark' : 'light');
        } catch {
          /* Choice still applies for this visit. */
        }
      }}
    >
      <span aria-hidden="true">{dark ? '☼' : '◐'}</span>
    </button>
  );
}
