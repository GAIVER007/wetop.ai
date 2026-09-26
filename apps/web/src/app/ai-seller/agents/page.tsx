import Link from 'next/link';
import './agents.css';
import { sellerAgentsApi, ApiError } from '../../../lib/api';

export default async function AgentsPage() {
  let items: Awaited<ReturnType<typeof sellerAgentsApi.list>>['items'] = [];
  let error = '';
  try {
    items = (await sellerAgentsApi.list()).items;
  } catch (e) {
    if (e instanceof ApiError) error = e.message;
    else throw e;
  }
  return (
    <main className="seller-agents">
      <header>
        <div><h1>Мои ИИ-продавцы</h1>
        <p>Агенты вашей организации. Черновик становится рабочим после подключения и проверки.</p></div>
        <Link className="btn" href="/create">
          Создать агента
        </Link>{' '}
        <Link href="/ai-seller">Действующий продавец гостиницы</Link>
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : items.length === 0 ? (
        <section className="panel">
          <h2>Создайте первого агента</h2>
          <p>
            Укажите компанию, задачу и стиль помощника. Настройки сохранятся в вашей организации.
          </p>
        </section>
      ) : (
        <div className="seller-agents__grid">
          {items.map((agent) => (
            <article className="panel" key={agent.id}>
              <h2>{agent.name}</h2>
              <p>Черновик · {agent.scenario === 'support' ? 'Поддержка' : 'Продажи'}</p>
              <dl>
                <dt>Компания</dt>
                <dd>{agent.profile.businessName}</dd>
                <dt>Задача</dt>
                <dd>{agent.profile.goal || 'Не указана'}</dd>
              </dl>
              <p>
                Сохранён в аккаунте. Подключение этого агента к модели и каналам ещё не настроено.
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
