'use client';

import { useEffect } from 'react';

/** Выставляет <html lang> для языкового поддерева: корневой макет один, из вложенного атрибут не задать. */
export function SetHtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);
  return null;
}
