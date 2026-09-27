'use client';
import { createContext, createElement, use, useContext, type ReactNode } from 'react';
import type { Permission } from '@pms/domain';
import type { DeskShell } from '../lib/desk-person';
import { CLOSED_ACCESS, mayAccess, type NavigationAccess } from '../lib/navigation';

/**
 * Кто вошёл — для клиентских компонентов (ADR-100): кнопки, которых нет у роли, стойка не рисует. Макет кладёт в контекст
 * то же обещание `deskShell()`, что уходит в меню (один `/auth/me` на отрисовку), а компонент дожидается его через `use`.
 * Защита — только в API: здесь лишь не показываем то, что API всё равно отклонит.
 */
const DeskAccess = createContext<Promise<DeskShell> | null>(null);

export function DeskAccessProvider({
  desk,
  children,
}: {
  desk: Promise<DeskShell>;
  children: ReactNode;
}) {
  // Без JSX: модуль читают и модульные тесты, у которых нет JSX-преобразования стойки
  return createElement(DeskAccess.Provider, { value: desk }, children);
}

/** Что открыто вошедшему; вне макета — как без входа (роль не известна, ничего не прячем) */
export function useDeskAccess(): NavigationAccess {
  const desk = useContext(DeskAccess);
  return desk ? use(desk).access : CLOSED_ACCESS;
}

/** Есть ли у вошедшего право (DATA_MODEL §16.5) */
export function useMay(permission: Permission): boolean {
  return mayAccess(useDeskAccess(), permission);
}
