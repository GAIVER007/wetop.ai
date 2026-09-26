import Link from 'next/link';
import './agents.css';
import { sellerAgentsApi, ApiError } from '../../../lib/api';
import { RefreshButton } from '../../../components/refresh-button';

export default async function AgentsPage() {
  let items: Awaited<ReturnType<typeof sellerAgentsApi.list>>['items'] = [];
  let failure: number | null = null;
  try {
    items = (await sellerAgentsApi.list()).items;
  } catch (e) {
    if (e instanceof ApiError) failure = e.status;
    else throw e;
  }
  return (
    <main className="seller-agents">
      <header className="seller-agents__header">
        <div>
          <span className="seller-agents__eyebrow">Продажи / ИИ-продавцы</span>
          <h1>Мои ИИ-продавцы</h1>
          <p>Создание и настройка помощников для вашего бизнеса.</p>
        </div>
        {!failure && (
          <Link className="btn" href="/create">
            Создать агента
          </Link>
        )}
      </header>
      <nav className="seller-agents__nav" aria-label="Рабочее пространство ИИ-продавцов">
        <Link href="/ai-seller/agents" aria-current="page">
          Мои агенты
        </Link>
        <Link href="/ai-seller">Продавец гостиницы</Link>
      </nav>
      {failure ? (
        <section className="seller-agents__empty" role="status">
          <span className="seller-agents__symbol" aria-hidden="true">
            AI
          </span>
          <h2>
            {failure === 503
              ? 'Создание агентов пока недоступно'
              : failure === 401
                ? 'Войдите в аккаунт'
                : failure === 403
                  ? 'Нужен доступ владельца'
                  : 'Не удалось загрузить агентов'}
          </h2>
          <p>
            {failure === 503
              ? 'Новый каталог ещё не подключён в этой среде. Настройки продавца гостиницы доступны отдельно.'
              : failure === 401
                ? 'Откройте вход в этой же среде и вернитесь к списку.'
                : failure === 403
                  ? 'Управление агентами доступно владельцу организации с активным доступом.'
                  : 'Повторите загрузку. Сохранённые настройки не изменены.'}
          </p>
          <div className="seller-agents__actions">
            <Link className="btn" href={failure === 401 ? '/login' : '/ai-seller'}>
              {failure === 401 ? 'Войти' : 'Настроить продавца гостиницы'}
            </Link>
            <RefreshButton />
          </div>
        </section>
      ) : items.length === 0 ? (
        <section className="seller-agents__empty">
          <span className="seller-agents__symbol" aria-hidden="true">
            AI
          </span>
          <h2>Начните с первого агента</h2>
          <p>
            Расскажите о компании и задаче — настройки сохранятся в черновике вашей организации.
          </p>
          <Link className="btn" href="/create">
            Создать первого агента
          </Link>
        </section>
      ) : (
        <>
          <div className="seller-agents__count">Агенты · {items.length}</div>
          <div className="seller-agents__grid">
            {items.map((agent) => (
              <article key={agent.id}>
                <div className="seller-agents__card-top">
                  <span className="seller-agents__symbol" aria-hidden="true">
                    AI
                  </span>
                  <span className="seller-agents__badge">
                    {agent.lifecycle === 'draft' ? 'Черновик' : agent.lifecycle}
                  </span>
                </div>
                <h2>
                  <Link href={`/ai-seller/agents/${agent.id}`}>{agent.name}</Link>
                </h2>
                <p>{agent.profile.businessName || 'Компания не указана'}</p>
                <dl>
                  <dt>Сценарий</dt>
                  <dd>{agent.scenario === 'support' ? 'Поддержка клиентов' : 'Продажи'}</dd>
                  <dt>Задача</dt>
                  <dd>{agent.profile.goal || 'Добавьте задачу в настройках'}</dd>
                </dl>
                <Link className="btn btn--secondary" href={`/ai-seller/agents/${agent.id}`}>
                  Открыть настройки
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
