import { TelegramPanel } from './telegram-panel';
import Link from 'next/link';
import { InstructionEditor } from './instruction-editor';
import { deskShell } from '../../../lib/desk-shell';
import { notFound } from 'next/navigation';
import '../ai-agents.css';
import { AGENT_STATUS_WORDS } from '@pms/domain';
import { LoadError } from '../../../components/load-error';
import { Page } from '../../../components/page';
import { Badge, Row, Stack } from '../../../components/ui';
import { ApiError, businessAgentsApi, type BusinessAgentView } from '../../../lib/api';
import { placement } from '../../../lib/ai-agents';
import { loadErrorProps } from '../../../lib/load-error';

/** Настройка конкретного агента; сохранение инструкции не меняет lifecycle. */
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
      <Page title="AI-продавец" crumbs={<Link href="/ai-agents">ИИ-продавцы</Link>}>
        <LoadError testId="agent-error" title="Не удалось загрузить агента" {...loadErrorProps(failure)} />
      </Page>
    );
  }
  const shell = await deskShell();
  let instruction = null;
  let instructionError: unknown = null;
  try { instruction = await businessAgentsApi.instruction(id); } catch (error) { instructionError = error; }
  return (
    <Page
      title={agent.name}
      subtitle={placement(agent.business, agent.location)}
      crumbs={<Link href="/ai-agents">ИИ-продавцы</Link>}
      width="wide"
    >
      <Stack>
        <Row>
          <Badge>Продажи</Badge>
          <Badge>Hospitality</Badge>
          <Badge data-testid="agent-lifecycle">{agent.lifecycle === 'draft' ? AGENT_STATUS_WORDS.DRAFT : agent.lifecycle}</Badge>
        </Row>
        {instruction ? <InstructionEditor id={id} initial={instruction} readOnly={shell.readOnly} /> :
          <LoadError testId="agent-instruction-error" title="Не удалось загрузить инструкцию" {...loadErrorProps(instructionError)} />}
        <TelegramPanel id={id} readOnly={shell.readOnly || agent.lifecycle === 'archived'} />
        <div>
          <Link className="btn btn--secondary" href="/ai-agents">
            К списку агентов
          </Link>
        </div>
      </Stack>
    </Page>
  );
}
