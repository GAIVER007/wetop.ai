import type { ReactNode } from 'react';
import { SetHtmlLang } from '../../components/set-html-lang';

/*
 * Казахское поддерево (фаза 1, 21.10.2026). Атрибут <html lang> живёт в корневом макете и из вложенного
 * не меняется, поэтому его выставляет маленький клиентский компонент; статический HTML остаётся с lang="ru",
 * поисковикам язык пары сообщает hreflang. Полный перевод каркаса на группы маршрутов — фаза 2.
 */
export default function KkLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SetHtmlLang lang="kk" />
      {children}
    </>
  );
}
