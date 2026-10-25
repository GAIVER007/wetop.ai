'use client';
import { can, type MembershipRole, type Permission } from '@pms/domain';
import './role-access.css';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
const actions: Array<[string, Permission, string?]> = [
  [msg('Брони, гости, заселение и выселение'), 'desk'],
  [msg('Приём оплат и начисления в счёт'), 'desk'],
  [msg('Финансы и аналитика'), 'reports', msg('Просмотр')],
  [msg('Возвраты и уменьшение начислений'), 'refunds'],
  [msg('Номера, койки и категории'), 'property'],
  [msg('Изменение тарифов и цен'), 'rates'],
  [msg('Настройка каналов продаж'), 'channels'],
  [msg('Диалоги ИИ-продавцов'), 'dialogs'],
  [msg('Настройка ИИ-продавцов'), 'seller'],
  [msg('Объект, сайт и подключения'), 'settings'],
  [msg('Журнал действий'), 'journal'],
  [msg('Приглашение администраторов'), 'staff'],
  [msg('Управляющие и платные расширения'), 'owner'],
];
export function RoleAccess({ role }: { role: MembershipRole }) {
  const t = useT();
  return (
    <dl className="role-access" aria-label={t('Доступ по роли')}>
      {actions.map(([label, permission, allowed]) => (
        <div key={permission + label}>
          <dt>{t(label)}</dt>
          <dd data-allowed={can(role, permission)}>
            {can(role, permission) ? (allowed ? t(allowed) : t('Доступно')) : t('Недоступно')}
          </dd>
        </div>
      ))}
    </dl>
  );
}
