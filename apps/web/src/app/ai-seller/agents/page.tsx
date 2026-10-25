import Link from 'next/link';
import './agents.css';
import { sellerAgentsApi, ApiError } from '../../../lib/api';
import { RefreshButton } from '../../../components/refresh-button';
import { Page } from '../../../components/page';
import { Badge, EmptyState } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';

/** Состояние агента словом: сырое значение из API («active») на экран не попадает */
const LIFECYCLE: Record<string, { label: string; tone: 'neutral' | 'ok' | 'warn' }> = {
  draft: { label: msg('Черновик'), tone: 'neutral' },
  active: { label: msg('Работает'), tone: 'ok' },
  paused: { label: msg('На паузе'), tone: 'warn' },
  archived: { label: msg('В архиве'), tone: 'neutral' },
};

const FAILURE: Record<number, { title: string; text: string }> = {
  503: {
    title: msg('Создание агентов пока недоступно'),
    text: msg('Новый каталог ещё не подключён в этой среде. Настройки продавца гостиницы доступны отдельно.'),
  },
  401: { title: msg('Войдите в аккаунт'), text: msg('Откройте вход в этой же среде и вернитесь к списку.') },
  403: {
    title: msg('Нужен доступ владельца'),
    text: msg('Управление агентами доступно владельцу организации с активным доступом.'),
  },
};

export default async function AgentsPage() {
  const t = await serverT();
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
        title: msg('Не удалось загрузить агентов'),
        text: msg('Повторите загрузку. Сохранённые настройки не изменены.'),
      })
    : null;
  return (
    <Page
      className="seller-agents"
      title={t('Мои ИИ-продавцы')}
      subtitle={t('Создание и настройка помощников для вашего бизнеса.')}
      actions={
        !failure && (
          <Link className="btn btn--primary" href="/ai-seller/agents/new">
            {t('Создать агента')}
          </Link>
        )
      }
    >
      <nav className="seller-agents__nav" aria-label={t('Рабочее пространство ИИ-продавцов')}>
        <Link href="/ai-seller/agents" aria-current="page">
          {t('Мои агенты')}
        </Link>
        <Link href="/ai-seller">{t('Продавец гостиницы')}</Link>
      </nav>
      {failed ? (
        <EmptyState
          role="status"
          icon={<Icon name="chat" width={32} height={32} />}
          title={t(failed.title)}
          actions={
            <>
              <Link className="btn" href={failure === 401 ? '/login' : '/ai-seller'}>
                {failure === 401 ? t('Войти') : t('Настроить продавца гостиницы')}
              </Link>
              <RefreshButton />
            </>
          }
        >
          {t(failed.text)}
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Icon name="chat" width={32} height={32} />}
          title={t('Начните с первого агента')}
          actions={
            <Link className="btn btn--primary" href="/ai-seller/agents/new">
              {t('Создать первого агента')}
            </Link>
          }
        >
          {t('Расскажите о компании и задаче: настройки сохранятся в черновике вашей организации.')}
        </EmptyState>
      ) : (
        <>
          <div className="seller-agents__count">{t('Всего агентов: {n}', { n: items.length })}</div>
          <div className="seller-agents__grid">
            {items.map((agent) => {
              const state = LIFECYCLE[agent.lifecycle] ?? { label: msg('Черновик'), tone: 'neutral' };
              return (
                <article key={agent.id}>
                  <div className="seller-agents__card-top">
                    <span className="seller-agents__symbol" aria-hidden="true">
                      <Icon name="chat" />
                    </span>
                    <Badge tone={state.tone}>{t(state.label)}</Badge>
                  </div>
                  <h2>
                    <Link href={`/ai-seller/agents/${agent.id}`}>{agent.name}</Link>
                  </h2>
                  <p>{agent.profile.businessName || t('Компания не указана')}</p>
                  <dl>
                    <dt>{t('Сценарий')}</dt>
                    <dd>{agent.scenario === 'support' ? t('Поддержка клиентов') : t('Продажи')}</dd>
                    <dt>{t('Задача')}</dt>
                    <dd>{agent.profile.goal || t('Добавьте задачу в настройках')}</dd>
                  </dl>
                  <Link className="btn btn--secondary" href={`/ai-seller/agents/${agent.id}`}>
                    {t('Открыть настройки')}
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
