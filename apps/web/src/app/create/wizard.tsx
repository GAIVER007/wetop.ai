'use client';
import Link from 'next/link';
import { WizardFields } from './wizard-fields';
import { useGuestDraft } from './use-guest-draft';

export function GuestWizard() {
  const {
    values,
    setValues,
    step,
    ready,
    busy,
    error,
    expired,
    saved,
    setSaved,
    dirty,
    open,
    save,
    restart,
  } = useGuestDraft();
  return (
    <main className="guest-wizard">
      <header className="guest-wizard__header">
        <Link href="/" className="guest-wizard__brand">
          WETOP<span>.AI</span>
        </Link>
        <Link href="/login">Войти в аккаунт</Link>
      </header>
      <ol className="guest-wizard__progress" aria-label="Этапы создания">
        {['Источник', 'Проверка', 'Тест', 'Сохранение в аккаунт'].map((name, i) => (
          <li key={name} aria-current={(step === 'review' ? 1 : 0) === i ? 'step' : undefined}>
            <span>{i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <div className="guest-wizard__layout">
        <section className="guest-wizard__card" aria-busy={busy}>
          {error && (
            <div role="alert" className="guest-wizard__error">
              {error}
            </div>
          )}
          {!ready ? (
            <>
              <h1>Создайте ИИ-продавца</h1>
              <p>Настройте помощника для вашего бизнеса.</p>
              {busy ? (
                <p>Открываем черновик…</p>
              ) : (
                <div className="guest-wizard__actions">
                  <button className="btn" onClick={() => void open()}>
                    Повторить подключение
                  </button>
                  {expired && (
                    <button className="btn btn--secondary" onClick={restart}>
                      Начать новый черновик
                    </button>
                  )}
                </div>
              )}
            </>
          ) : step === 'intro' ? (
            <>
              <span className="guest-wizard__eyebrow">Ваш будущий помощник</span>
              <h1>Создайте ИИ-продавца</h1>
              <p>
                Расскажите о бизнесе и настройте агента. Черновик можно заполнить до регистрации.
              </p>
              <button className="btn" disabled={busy} onClick={() => void save('source')}>
                Начать создание
              </button>
            </>
          ) : step === 'source' ? (
            <>
              <h1>С чего начнём?</h1>
              <p>Заполните информацию о компании. Она станет основой знаний вашего агента.</p>
              <div className="guest-wizard__source">
                <h2>Расскажите о бизнесе</h2>
                <p>Название, задачи и преимущества — всё можно изменить позже.</p>
                <button className="btn" disabled={busy} onClick={() => void save('review')}>
                  Настроить вручную
                </button>
              </div>
              <p className="guest-wizard__note">
                Автоанализ сайта ещё не подключён. Сейчас доступно заполнение черновика вручную.
              </p>
            </>
          ) : (
            <>
              <span className="guest-wizard__eyebrow">Информация об агенте</span>
              <h1>Расскажите о бизнесе</h1>
              <p>Название компании и ниша обязательны. Остальное можно дополнить позже.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <WizardFields
                  values={values}
                  onChange={(key, value) => {
                    setValues((v) => ({ ...v, [key]: value }));
                    setSaved('');
                  }}
                />
                <div className="guest-wizard__actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={busy}
                    onClick={() => void save('source')}
                  >
                    Назад
                  </button>
                  <button className="btn" type="submit" disabled={busy}>
                    Сохранить черновик
                  </button>
                </div>
              </form>
              <p className="guest-wizard__note">
                Генерация и тестовый чат ещё не подключены. Сохранённый черновик не является
                запущенным агентом.
              </p>
            </>
          )}
          <p role="status" className="guest-wizard__save-state">
            {busy ? 'Сохраняем…' : dirty ? 'Есть несохранённые изменения' : saved}
          </p>
        </section>
        <aside className="guest-wizard__preview" aria-label="Превью агента">
          <span className="guest-wizard__eyebrow">Живое превью</span>
          <div className="guest-wizard__avatar" aria-hidden="true">
            AI
          </div>
          <h2>{values.assistantName || 'Ваш помощник'}</h2>
          <p>{values.businessName || 'Название компании'}</p>
          <dl>
            <div>
              <dt>Задача</dt>
              <dd>{values.goal || 'Добавьте цель агента'}</dd>
            </div>
            <div>
              <dt>Валюта</dt>
              <dd>{values.currency}</dd>
            </div>
            <div>
              <dt>Часовой пояс</dt>
              <dd>{values.timezone}</dd>
            </div>
          </dl>
          {values.advantages && <p className="guest-wizard__advantages">{values.advantages}</p>}
          <p className="guest-wizard__note">Превью настроек: агент ещё не запущен</p>
        </aside>
      </div>
    </main>
  );
}
