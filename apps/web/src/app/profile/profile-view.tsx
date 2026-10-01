'use client';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { useTheme, type Theme } from '../../components/theme-provider';
import { RecordTabs } from '../../components/record-tabs';
import { Badge } from '../../components/ui';
import type { ExtensionAccessView } from '../../lib/api';
import type { DeskPerson } from '../../lib/desk-person';
import { extensionLine } from '../../lib/platform';
import Link from 'next/link';

/**
 * «Настройки рабочего места»: тема, доступ и расширения организации. Кто вошёл и что открыто организации — от
 * серверной страницы (`page.tsx`): тема живёт в браузере, а права — в API (ADR-083).
 */
export function ProfileView({
  person,
  seller,
}: {
  person: DeskPerson | null;
  seller: ExtensionAccessView | null;
}) {
  const { theme, setTheme } = useTheme();
  return (
    <Page
      title="Настройки рабочего места"
      subtitle="Ваш интерфейс, в удобном для вас виде"
      width="narrow"
    >
      <RecordTabs
        tabs={[
          {
            id: 'appearance',
            label: 'Оформление',
            content: (
              <section className="panel">
                <h2 className="section-title">Тема интерфейса</h2>
                <p className="muted">Выбор сохраняется на этом устройстве.</p>
                <div className="theme-options">
                  {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                    <button
                      key={t}
                      className={`theme-option ${theme === t ? 'is-selected' : ''}`}
                      onClick={() => setTheme(t)}
                      aria-pressed={theme === t}
                    >
                      <Icon name={t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'system'} />
                      <strong>
                        {t === 'light' ? 'Светлая' : t === 'dark' ? 'Тёмная' : 'Как на устройстве'}
                      </strong>
                      {theme === t && <Icon name="check" width={16} />}
                    </button>
                  ))}
                </div>
              </section>
            ),
          },
          {
            id: 'access',
            label: 'Доступ',
            content: (
              <section className="panel">
                <span className="round-icon">
                  <Icon name="shield" />
                </span>
                <h2 className="section-title">Вход и сотрудники</h2>
                {/* Правда на 25.09 (ADR-053, ADR-083): вход по почте и паролю; на стойке все равны (ADR-023), у владельца
                    организации — приглашения и настройки ИИ-продавца */}
                <p className="muted" data-testid="profile-access">
                  Приглашения сотрудников, активные сессии и выход на всех устройствах — в
                  управлении доступом. Вход по почте и паролю. На стойке все вошедшие видят и делают
                  одно и то же; владелец организации ещё приглашает сотрудников и настраивает
                  ИИ-продавца.
                </p>
                {person && (
                  <p data-testid="profile-role">
                    Вы вошли как <strong>{person.name}</strong> —{' '}
                    {person.caption.toLocaleLowerCase('ru')}.
                  </p>
                )}
                <Link href="/profile/access" className="btn btn--secondary">
                  Управление доступом
                </Link>
              </section>
            ),
          },
          {
            id: 'extensions',
            label: 'Расширения',
            content: <SellerExtension seller={seller} signedIn={person !== null} />,
          },
        ]}
      />
    </Page>
  );
}

/** Карточка «ИИ-продавец» (ADR-083, Q-183): подключён ли и до какого дня; не подключён — кто подключает */
function SellerExtension({
  seller,
  signedIn,
}: {
  seller: ExtensionAccessView | null;
  signedIn: boolean;
}) {
  const line = seller ? extensionLine(seller) : null;
  return (
    <section className="panel" data-testid="profile-seller">
      <span className="round-icon">
        <Icon name="chat" />
      </span>
      <h2 className="section-title">ИИ-продавец</h2>
      {!signedIn || !seller || !line ? (
        <p className="muted">Состояние расширения видно после входа.</p>
      ) : (
        <>
          <p>
            <Badge tone={line.tone}>{line.label}</Badge>{' '}
            <span className="muted">{line.detail}</span>
          </p>
          <p className="muted">
            {seller.access === 'active'
              ? 'Бот отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, берёт контакт и зовёт человека.'
              : seller.access === 'expired'
                ? 'Срок вышел: раздел только для чтения, ничего не удалено. Продлевает администратор WETOP.'
                : 'Бот отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, берёт контакт и зовёт человека. Подключает администратор WETOP после оплаты по счёту.'}
          </p>
          {seller.access !== 'off' && (
            <Link href="/ai-seller" className="btn btn--secondary">
              Открыть ИИ-продавца
            </Link>
          )}
        </>
      )}
    </section>
  );
}
