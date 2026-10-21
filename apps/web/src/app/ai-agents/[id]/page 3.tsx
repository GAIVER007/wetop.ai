import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../ai-agents.css';
import { AGENT_SETUP_PENDING_WORD, AGENT_STATUS_WORDS } from '@pms/domain';
import { LoadError } from '../../../components/load-error';
import { Page } from '../../../components/page';
import { Badge, Notice, Panel, Row, Stack } from '../../../components/ui';
import { ApiError, businessAgentsApi, type BusinessAgentView } from '../../../lib/api';
import { placement } from '../../../lib/ai-agents';
import { loadErrorProps } from '../../../lib/load-error';

/**
 * Страница AI-продавца-черновика (SA2): где он живёт, в каком состоянии и что ещё настроить. Список настройки — статус,
 * а не шаги мастера: пункты после «Основного» пока недоступны и не ведут никуда (решение владельца 30.09). Запуска нет.
 */
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let agent: BusinessAgentView | null = null;
  let failure: unknown = null;
  try {
    agent = await businessAgentsApi.get(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    failure = error;
  }
  if (!agent) {
    return (
      <Page title="AI-продавец" crumbs={<Link href="/ai-agents">ИИ-агенты</Link>}>
        <LoadError testId="agent-error" title="Не удалось загрузить агента" {...loadErrorProps(failure)} />
      </Page>
    );
  }
  return (
    <Page
      title={agent.name}
      subtitle={placement(agent.business, agent.location)}
      crumbs={<Link href="/ai-agents">ИИ-агенты</Link>}
      width="medium"
    >
      <Stack>
        <Row>
          <Badge>Продажи</Badge>
          <Badge>Hospitality</Badge>
          <Badge data-testid="agent-lifecycle">{agent.lifecycle === 'draft' ? AGENT_STATUS_WORDS.DRAFT : agent.lifecycle}</Badge>
        </Row>
        <Panel title="Настройка" data-testid="agent-setup">
          <ul className="agent-setup">
            {agent.setup.map((item) => (
              <li key={item.code} className={item.done ? 'agent-setup__item agent-setup__item--done' : 'agent-setup__item'} data-testid={`agent-setup-${item.code}`}>
                <span className="agent-setup__mark" aria-hidden="true">
                  {item.done ? '✓' : '○'}
                </span>
                <span className="agent-setup__label">{item.label}</span>
                <span className="agent-setup__state muted">{item.done ? 'Готово' : AGENT_SETUP_PENDING_WORD}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Notice tone="muted" data-testid="agent-draft-note">
          Это черновик: он не отвечает гостям. Запуск появится после настройки поведения, знаний и каналов.
        </Notice>
        <div>
          <Link className="btn btn--secondary" href="/ai-agents">
            К списку агентов
          </Link>
        </div>
      </Stack>
    </Page>
  );
}
