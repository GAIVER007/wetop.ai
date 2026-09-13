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
                <h2 className="section-title">Рабочее пространство администратора</h2>
                <p className="muted">
                  Управление сотрудниками, ролями и сменами появится после подключения авторизации.
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
