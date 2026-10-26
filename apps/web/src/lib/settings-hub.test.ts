import { describe, expect, it } from 'vitest';
import { CLOSED_ACCESS } from './navigation';
import { SETTINGS_GROUPS, settingsGroupsFor } from './settings-hub';

const owner = { ...CLOSED_ACCESS, role: 'OWNER' as const };
const staff = { ...CLOSED_ACCESS, role: 'STAFF' as const };
const flat = (groups: ReturnType<typeof settingsGroupsFor>) =>
  groups.map((g) => [g.title, g.links.map((l) => `${l.label} ${l.href}`)] as const);

describe('хаб «Настройки» одной таблицей для всех направлений', () => {
  it('у владельца карточки в одном порядке и со своими экранами направления', () => {
    expect(flat(settingsGroupsFor(owner, 'BEAUTY'))).toEqual([
      ['Основные', ['Филиалы и реквизиты /branches', 'Режим работы /beauty-settings?section=hours', 'Сотрудники и доступ /team', 'Права ролей /team/roles', 'Мой профиль /profile']],
      ['Журнал', ['Сотрудники /employees', 'График работы /beauty/schedule', 'Каталог услуг /services']],
      ['Клиенты и продажи', ['Напоминания клиентам /beauty-settings?section=reminders', 'Бонусы /beauty-settings?section=bonuses', 'Сертификаты /finance/certificates', 'Сайт и онлайн-запись /marketing/site/editor', 'ИИ-продавец /ai-agents']],
      ['Система', ['Способы оплаты /branch-payment-methods', 'История действий /journal']],
    ]);
    expect(flat(settingsGroupsFor(owner, 'FOOD_SERVICE'))).toEqual([
      ['Основные', ['Филиалы и реквизиты /branches', 'Режим работы /restaurant-settings?section=hours', 'Сотрудники и доступ /team', 'Права ролей /team/roles', 'Мой профиль /profile']],
      ['Журнал', ['Сотрудники /employees', 'График работы /employees/shifts', 'Залы и столы /dining-areas', 'Правила бронирования /restaurant-settings?section=bookings', 'Меню /menu']],
      ['Клиенты и продажи', ['Напоминания клиентам /restaurant-settings?section=reminders', 'Сайт и онлайн-бронь /marketing/site/editor', 'ИИ-продавец /ai-agents']],
      ['Система', ['Способы оплаты /branch-payment-methods', 'История действий /journal']],
    ]);
    expect(flat(settingsGroupsFor(owner, 'HOSPITALITY'))).toEqual([
      ['Основные', ['Карточка объекта /hotel-settings', 'Филиалы и реквизиты /branches', 'Режим работы /hotel-settings/stay', 'Сотрудники и доступ /team', 'Права ролей /team/roles', 'Мой профиль /profile']],
      ['Журнал', ['Номера /inventory', 'Каталог услуг /hotel-settings/services']],
      ['Клиенты и продажи', ['Каналы продаж /channels', 'Сайт и онлайн-запись /website', 'ИИ-продавец /ai-agents']],
      ['Система', ['Способы оплаты и статьи кассы /hotel-settings/directories', 'Документы и договор /hotel-settings/documents', 'Подключения /connections', 'Неисправности /incidents', 'История действий /journal']],
    ]);
  });

  it('закрытых страниц нет: администратор не видит настроек владельца, «Организации» только главному администратору', () => {
    const hrefs = (a: typeof owner | typeof staff, v: 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE') =>
      settingsGroupsFor(a, v).flatMap((g) => g.links.map((l) => l.href));
    for (const v of ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const) {
      expect(hrefs(owner, v), v).not.toContain('/platform');
      expect(hrefs({ ...owner, platform: true }, v), v).toContain('/platform');
    }
    expect(hrefs(staff, 'HOSPITALITY')).not.toContain('/hotel-settings');
    expect(hrefs(staff, 'HOSPITALITY')).not.toContain('/connections');
    expect(settingsGroupsFor(CLOSED_ACCESS, 'HOSPITALITY').every((g) => g.links.length > 0)).toBe(true);
  });

  it('подпись ссылки одна во всех направлениях, повторов в карточке нет', () => {
    for (const group of SETTINGS_GROUPS) {
      const labels = group.links.map((l) => l.label);
      expect(new Set(labels).size, group.title).toBe(labels.length);
    }
  });
});
