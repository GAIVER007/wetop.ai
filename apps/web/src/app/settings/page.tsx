import Link from 'next/link';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { deskShell } from '../../lib/desk-shell';
import { settingsGroupsFor } from '../../lib/settings-hub';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';
import './settings-hub.css';

const TITLE = {
  HOSPITALITY: msg('Настройки гостиницы'),
  BEAUTY: msg('Настройки салона'),
  FOOD_SERVICE: msg('Настройки ресторана'),
} as const;

/**
 * «Настройки» (поручение владельца 21.10.2026): одна страница карточками со ссылками, как «Настройки» записи клиентов.
 * Карточки и подписи общие у всех направлений, за ссылкой свой экран направления (`settings-hub.ts`); закрытых
 * человеку страниц в карточках нет. Сами настройки остаются на своих компактных экранах, хаб их не дублирует.
 */
export default async function SettingsHubPage() {
  const [shell, t] = await Promise.all([deskShell(), serverT()]);
  const groups = settingsGroupsFor(shell.access, shell.vertical);
  return (
    <Page title={t(TITLE[shell.vertical])} width="wide">
      <div className="settings-hub" data-testid="settings-hub">
        {groups.map((group) => (
          <section key={group.id} className="settings-hub__card" aria-labelledby={`settings-hub-${group.id}`}>
            <h2 id={`settings-hub-${group.id}`} className="settings-hub__title">
              <Icon name={group.icon} width={18} height={18} aria-hidden="true" />
              {t(group.title)}
            </h2>
            <ul className="settings-hub__links">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch={false}>
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
