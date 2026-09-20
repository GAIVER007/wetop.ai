'use client';
import { Page } from '../../components/page';
import { Icon } from '../../components/icon';
import { useTheme, type Theme } from '../../components/theme-provider';
import { RecordTabs } from '../../components/record-tabs';
import Link from 'next/link';
export default function ProfilePage() {
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
                {/* Правда на 20.09 (ADR-046, ADR-049): два входа и приглашения есть, ролей нет (ADR-023) */}
                <p className="muted" data-testid="profile-access">
                  Кто вошёл, приглашения администраторов и выход — на экране входа. Вход по паролю
                  или по коду из письма. Ролей пока нет: каждый вошедший видит и делает всё.
                </p>
                <Link href="/login" className="btn btn--secondary">
                  Экран входа
                </Link>
              </section>
            ),
          },
        ]}
      />
    </Page>
  );
}
