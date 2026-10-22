'use client';
import { useEffect, useState } from 'react';
export function ThemeToggle({
  labels,
}: {
  labels: { toggle: string; light: string; dark: string };
}) {
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
      aria-label={labels.toggle}
      title={dark ? labels.light : labels.dark}
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
