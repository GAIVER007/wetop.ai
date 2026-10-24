'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { translator, type DeskLocale, type Translate } from './index';

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
