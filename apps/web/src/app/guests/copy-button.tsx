'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * «Копировать» рядом с телефоном и почтой в панели гостя. Слово меняется на «Скопировано» на пару секунд и
 * объявляется читалке; буфер недоступен (старый браузер, запрет): кнопка молча остаётся «Копировать».
 */
export function CopyButton({ text, what }: { text: string; what: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="gb-copy"
      aria-label={`Копировать: ${what}`}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setDone(false), 2000);
          },
          () => undefined,
        );
      }}
    >
      {done ? 'Скопировано' : 'Копировать'}
      <span className="sr-only" role="status">
        {done ? `${what} скопировано` : ''}
      </span>
    </button>
  );
}
