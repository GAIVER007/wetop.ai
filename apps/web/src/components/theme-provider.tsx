'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
});
export const themeScript = `(function(){try{var t=localStorage.getItem('wetop.theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setValue] = useState<Theme>('system');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wetop.theme');
      if (saved === 'light' || saved === 'dark') setValue(saved);
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const system = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (system.matches ? 'dark' : 'light') : theme;
    };
    apply();
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [theme, ready]);
  const setTheme = (next: Theme) => {
    setValue(next);
    try {
      localStorage.setItem('wetop.theme', next);
    } catch {
      /* Theme still works in this tab. */
    }
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
