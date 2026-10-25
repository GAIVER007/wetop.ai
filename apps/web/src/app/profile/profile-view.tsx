'use client';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { useTheme, type Theme } from '../../components/theme-provider';
import { Tabs } from '../../components/tabs';
import { Badge } from '../../components/ui';
import type { ExtensionAccessView } from '../../lib/api';
import type { DeskPerson } from '../../lib/desk-person';
import type { StaffTelegramStatus } from '../../lib/api';
import Link from 'next/link';
import { TelegramNotifications } from './telegram-panel';
import { useT } from '../../i18n/locale-provider';
import { sellerText } from '../platform/words';
import { extensionLine } from '../../lib/platform';

/**
 * «Настройки рабочего места»: тема, доступ и расширения организации. Кто вошёл и что открыто организации — от
 * серверной страницы (`page.tsx`): тема живёт в браузере, а права — в API (ADR-083).
 */
export function ProfileView({
  person,
  seller,
  hospitality = true,
  telegram = null,
}: {
  person: DeskPerson | null;
  seller: ExtensionAccessView | null;
  /** «Уведомления»: своё подключение Telegram (STAFF-TG-20261020); null до входа или при сбое API */
  telegram?: StaffTelegramStatus | null;
  /** ИИ-продавец пока работает только у гостиницы: салону и ресторану вкладка расширений не нужна */
  hospitality?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const t = useT();
  return (
    <Page
      title={t('Настройки рабочего места')}
      subtitle={t('Ваш интерфейс, в удобном для вас виде')}
      width="narrow"
    >
      <Tabs
        label={t('Разделы карточки')}
        panels={[
          {
            id: 'appearance',
            label: t('Оформление'),
            content: (
              <section className="panel">
                <h2 className="section-title">{t('Тема интерфейса')}</h2>
                <p className="muted">{t('Выбор сохраняется на этом устройстве.')}</p>
                <div className="theme-options">
                  {(['light', 'dark', 'system'] as Theme[]).map((option) => (
                    <button
                      key={option}
                      className={`theme-option ${theme === option ? 'is-selected' : ''}`}
                      onClick={() => setTheme(option)}
                      aria-pressed={theme === option}
                    >
                      <Icon name={option === 'light' ? 'sun' : option === 'dark' ? 'moon' : 'system'} />
                      <strong>
                        {option === 'light' ? t('Светлая') : option === 'dark' ? t('Тёмная') : t('Как на устройстве')}
                      </strong>
                      {theme === option && <Icon name="check" width={16} />}
                    </button>
                  ))}
                </div>
              </section>
            ),
          },
          {
            id: 'access',
            label: t('Доступ'),
            content: (
              <section className="panel">
                <span className="round-icon">
                  <Icon name="shield" />
                </span>
                <h2 className="section-title">{t('Вход и сотрудники')}</h2>
                {/* Вход по почте и паролю (ADR-053); права даёт должность (ADR-107), приглашения в «Сотрудниках и доступе» */}
                <p className="muted" data-testid="profile-access">
                  {t(
                    'Вход по почте и паролю. Активные сессии и выход на всех устройствах: в управлении доступом. Права зависят от должности; владелец организации и управляющий приглашают сотрудников в разделе «Персонал → Сотрудники».',
                  )}
                </p>
                {person && (
                  <p data-testid="profile-role">
                    {t('Вы вошли как')} <strong>{person.name}</strong> —{' '}
                    {person.caption.toLocaleLowerCase('ru')}.
                  </p>
                )}
                <Link href="/profile/access" className="btn btn--secondary">
                  {t('Управление доступом')}
                </Link>
              </section>
            ),
          },
          {
            id: 'notifications',
            label: t('Уведомления'),
            content: <TelegramNotifications initial={telegram} />,
          },
          ...(hospitality
            ? [
                {
                  id: 'extensions',
                  label: t('Расширения'),
                  content: <SellerExtension seller={seller} signedIn={person !== null} />,
                },
              ]
            : []),
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
  const t = useT();
  const line = seller ? extensionLine(seller) : null;
  const words = seller ? sellerText(seller, t) : null;
  return (
    <section className="panel" data-testid="profile-seller">
      <span className="round-icon">
        <Icon name="chat" />
      </span>
      <h2 className="section-title">{t('ИИ-продавец')}</h2>
      {!signedIn || !seller || !line || !words ? (
        <p className="muted">{t('Состояние расширения видно после входа.')}</p>
      ) : (
        <>
          <p>
            <Badge tone={line.tone}>{words.label}</Badge>{' '}
            <span className="muted">{words.detail}</span>
          </p>
          <p className="muted">
            {seller.access === 'active'
              ? t('Бот отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, берёт контакт и зовёт человека.')
              : seller.access === 'expired'
                ? t('Срок вышел: раздел только для чтения, ничего не удалено. Продлевает администратор WETOP.')
                : t('Бот отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, берёт контакт и зовёт человека. Подключает администратор WETOP после оплаты по счёту.')}
          </p>
          {seller.access !== 'off' && (
            <Link href="/ai-seller" className="btn btn--secondary">
              {t('Открыть ИИ-продавца')}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
