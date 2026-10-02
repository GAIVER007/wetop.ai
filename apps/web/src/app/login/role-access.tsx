import { can, type MembershipRole, type Permission } from '@pms/domain';
import './role-access.css';
const actions: Array<[string, Permission, string?]> = [
  ['Брони, гости, заселение и выселение', 'desk'],
  ['Приём оплат и начисления в счёт', 'desk'],
  ['Финансы и аналитика', 'reports', 'Просмотр'],
  ['Возвраты и уменьшение начислений', 'refunds'],
  ['Номера, койки и категории', 'property'],
  ['Изменение тарифов и цен', 'rates'],
  ['Настройка каналов продаж', 'channels'],
  ['Диалоги ИИ-продавцов', 'dialogs'],
  ['Настройка ИИ-продавцов', 'seller'],
  ['Объект, сайт и подключения', 'settings'],
  ['Журнал действий', 'journal'],
  ['Приглашение администраторов', 'staff'],
  ['Управляющие и платные расширения', 'owner'],
];
export function RoleAccess({ role }: { role: MembershipRole }) {
  return (
    <dl className="role-access" aria-label="Доступ по роли">
      {actions.map(([label, permission, allowed]) => (
        <div key={permission + label}>
          <dt>{label}</dt>
          <dd data-allowed={can(role, permission)}>
            {can(role, permission) ? (allowed ?? 'Доступно') : 'Недоступно'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
