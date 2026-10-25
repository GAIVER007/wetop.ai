'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { MEMBERSHIP_ROLES, accessDeniedMessage, type Permission } from '@pms/domain';
import { useT } from '../i18n/locale-provider';
import { useDeskAccessWhen } from './desk-access';
import { Icon } from './icon';
import { Page } from './page';
import { EmptyState, LoadingState } from './ui';
import { carriesBeautyAccess, openToEveryRole, pageOpen, routeRule } from '../lib/navigation';

/**
 * Закрытая по роли страница (ADR-107): вместо её содержимого — кому раздел открыт. Проверка здесь, а не в макете: корневой
 * макет Next при переходах по ссылкам не перерисовывается, а путь из `usePathname` меняется на каждом переходе. Данных
 * страница всё равно не получит — API ответит 403 (`RoleGuard`); здесь человек видит понятные слова вместо сбоя.
 * «Платформа» закрывает себя сама (ADR-083), страницы, открытые всем ролям, не ждут ответа `/auth/me`. Роль не узнали
 * (сбой `/auth/me`) — страница открывается: «нет доступа» было бы неправдой, а данных без права API не отдаст.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const t = useT();
  const path = usePathname() ?? '/';
  const rule = routeRule(path);
  const check =
    rule?.requires && rule.requires !== 'platform' && (!openToEveryRole(rule.requires) || carriesBeautyAccess(path))
      ? { label: rule.label, requires: rule.requires, path }
      : null;
  // Форма дерева одна на любом адресе. Панель поверх страницы (место в «Номерном фонде», ADR-108) меняет адрес, а
  // страницу под собой — нет; будь здесь `children` то голым, то в обёртке, React пересоздавал бы страницу под
  // панелью при переходе между адресами с проверкой и без, и она теряла бы фильтры и прокрутку.
  return (
    <Suspense fallback={check ? <LoadingState label={t('Проверяем доступ…')} /> : null}>
      <RoleCheck check={check}>{children}</RoleCheck>
    </Suspense>
  );
}

function RoleCheck({
  check,
  children,
}: {
  check: { label: string; requires: Permission; path: string } | null;
  children: ReactNode;
}) {
  const access = useDeskAccessWhen(check !== null);
  if (!check || !access || pageOpen(access, check.requires, check.path)) return children;
  return (
    <NoAccess
      label={check.label}
      requires={check.requires}
      role={access.role}
      homeHref={pageOpen(access, 'desk', '/my-work') ? '/my-work' : '/today'}
    />
  );
}

export function NoAccess({
  label,
  requires,
  role,
  homeHref = '/today',
}: {
  label: string;
  requires: Permission;
  role: keyof typeof MEMBERSHIP_ROLES | null;
  homeHref?: string;
}) {
  const t = useT();
  return (
    <Page title={t(label)}>
      <EmptyState
        data-testid="no-access"
        icon={<Icon name="shield" width={32} height={32} />}
        title={t('Нет доступа')}
        actions={
          <Link className="btn btn--secondary" href={homeHref}>
            {homeHref === '/my-work' ? t('Моя работа') : t('На главную')}
          </Link>
        }
      >
        {accessDeniedMessage(requires)}
        {role &&
          ` ${t('Ваша роль — {role}; роль меняет владелец организации.', { role: t(MEMBERSHIP_ROLES[role]) })}`}
      </EmptyState>
    </Page>
  );
}
