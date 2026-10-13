import Link from 'next/link';
import './agents.css';
import { sellerAgentsApi, ApiError } from '../../../lib/api';
import { RefreshButton } from '../../../components/refresh-button';
import { Page } from '../../../components/page';
import { Badge, EmptyState } from '../../../components/ui';
import { Icon } from '../../../components/icon';

/** Состояние агента словом: сырое значение из API («active») на экран не попадает */
const LIFECYCLE: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  active: { label: 'Работает', tone: 'ok' },
  paused: { label: 'На паузе', tone: 'warn' },
  archived: { label: 'В архиве', tone: 'neutral' },
};

const FAILURE: Record<number, { title: string; text: string }> = {
  503: {
    title: 'Создание агентов пока недоступно',
    text: 'Новый каталог ещё не подключён в этой среде. Настройки продавца гостиницы доступны отдельно.',
  },
  401: { title: 'Войдите в аккаунт', text: 'Откройте вход в этой же среде и вернитесь к списку.' },
  403: {
    title: 'Нужен доступ владельца',
    text: 'Управление агентами доступно владельцу организации с активным доступом.',
  },
};

export default async function AgentsPage() {
  let items: Awaited<ReturnType<typeof sellerAgentsApi.list>>['items'] = [];
  let failure: number | null = null;
  try {
    items = (await sellerAgentsApi.list()).items;
  } catch (e) {
    if (e instanceof ApiError) failure = e.status;
    else throw e;
  }
  const failed = failure
    ? (FAILURE[failure] ?? {
        title: 'Не удалось загрузить агентов',
        text: 'Повторите загрузку. Сохранённые настройки не изменены.',
      })
    : null;
  return (
    <Page
      className="seller-agents"
      title="Мои ИИ-продавцы"
      subtitle="Создание и настройка помощников для вашего бизнеса."
      actions={
        !failure && (
          <Link className="btn btn--primary" href="/ai-seller/agents/new">
            Создать агента
          </Link>
        )
      }
    >
      <nav className="seller-agents__nav" aria-label="Рабочее пространство ИИ-продавцов">
        <Link href="/ai-seller/agents" aria-current="page">
          Мои агенты
        </Link>
        <Link href="/ai-seller">Продавец гостиницы</Link>
      </nav>
      {failed ? (
        <EmptyState
          role="status"
          icon={<Icon name="chat" width={32} height={32} />}
          title={failed.title}
          actions={
            <>
              <Link className="btn" href={failure === 401 ? '/login' : '/ai-seller'}>
                {failure === 401 ? 'Войти' : 'Настроить продавца гостиницы'}
              </Link>
              <RefreshButton />
            </>
          }
        >
          {failed.text}
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon name="chat" width={32} height={32} />}
          title="Начните с первого агента"
          actions={
            <Link className="btn btn--primary" href="/ai-seller/agents/new">
              Создать первого агента
            </Link>
          }
        >
          Расскажите о компании и задаче: настройки сохранятся в черновике вашей организации.
        </EmptyState>
      ) : (
        <>
          <div className="seller-agents__count">Всего агентов: {items.length}</div>
          <div className="seller-agents__grid">
            {items.map((agent) => {
              const state = LIFECYCLE[agent.lifecycle] ?? { label: 'Черновик', tone: 'neutral' };
              return (
                <article key={agent.id}>
                  <div className="seller-agents__card-top">
                    <span className="seller-agents__symbol" aria-hidden="true">
                      <Icon name="chat" />
                    </span>
                    <Badge tone={state.tone}>{state.label}</Badge>
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
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
