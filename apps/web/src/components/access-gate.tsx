'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { MEMBERSHIP_ROLES, accessDeniedMessage, type Permission } from '@pms/domain';
import { useDeskAccess } from './desk-access';
import { Icon } from './icon';
import { Page } from './page';
import { EmptyState, LoadingState } from './ui';
import { openToEveryRole, pageOpen, routeRule } from '../lib/navigation';

/**
 * Закрытая по роли страница (ADR-107): вместо её содержимого — кому раздел открыт. Проверка здесь, а не в макете: корневой
 * макет Next при переходах по ссылкам не перерисовывается, а путь из `usePathname` меняется на каждом переходе. Данных
 * страница всё равно не получит — API ответит 403 (`RoleGuard`); здесь человек видит понятные слова вместо сбоя.
 * «Платформа» закрывает себя сама (ADR-083), страницы, открытые всем ролям, не ждут ответа `/auth/me`. Роль не узнали
 * (сбой `/auth/me`) — страница открывается: «нет доступа» было бы неправдой, а данных без права API не отдаст.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const rule = routeRule(usePathname() ?? '/');
  if (!rule?.requires || rule.requires === 'platform' || openToEveryRole(rule.requires))
    return children;
  return (
    <Suspense fallback={<LoadingState label="Проверяем доступ…" />}>
      <RoleCheck label={rule.label} requires={rule.requires}>
        {children}
      </RoleCheck>
    </Suspense>
  );
}

function RoleCheck({
  label,
  requires,
  children,
}: {
  label: string;
  requires: Permission;
  children: ReactNode;
}) {
  const access = useDeskAccess();
  if (pageOpen(access, requires)) return children;
  return <NoAccess label={label} requires={requires} role={access.role} />;
}

export function NoAccess({
  label,
  requires,
  role,
}: {
  label: string;
  requires: Permission;
  role: keyof typeof MEMBERSHIP_ROLES | null;
}) {
  return (
    <Page title={label}>
      <EmptyState
        data-testid="no-access"
        icon={<Icon name="shield" width={32} height={32} />}
        title="Нет доступа"
        actions={
          <Link className="btn btn--secondary" href="/today">
            На главную
          </Link>
        }
      >
        {accessDeniedMessage(requires)}
        {role && ` Ваша роль — ${MEMBERSHIP_ROLES[role]}; роль меняет владелец организации.`}
      </EmptyState>
    </Page>
  );
}
