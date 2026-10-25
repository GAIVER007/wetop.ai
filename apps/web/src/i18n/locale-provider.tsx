'use client';
import { createContext, createElement, useContext, type HTMLAttributes, type ReactNode } from 'react';
import { translator, type DeskLocale, type Translate, type Vars } from './index';

const LocaleContext = createContext<DeskLocale>('ru');

/** Язык человека клиентским компонентам; ставит корневой макет по `/auth/me` или куке */
export function LocaleProvider({ locale, children }: { locale: DeskLocale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): DeskLocale {
  return useContext(LocaleContext);
}

export function useT(): Translate {
  return translator(useContext(LocaleContext));
}

/**
 * Фраза на языке человека в общих компонентах, которые рисует и сервер, и клиент (`ui.tsx`, `page.tsx`): у серверного
 * компонента нет хука `useT`, а этот клиентский кусок в нём рисуется. Фраза размечается `msg('…')`.
 */
export function T({ text, vars }: { text: string; vars?: Vars }) {
  return useT()(text, vars);
}

/** Блок с `aria-label` на языке человека для общего компонента, который рисует и сервер */
export function Labelled({
  as = 'div',
  label,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'nav'; label: string }) {
  const t = useT();
  return createElement(as, { ...rest, 'aria-label': t(label) });
}
