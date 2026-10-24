import { TelegramPanel } from './telegram-panel';
import Link from 'next/link';
import { InstructionEditor } from './instruction-editor';
import { deskShell } from '../../../lib/desk-shell';
import { notFound } from 'next/navigation';
import '../ai-agents.css';
import { AGENT_STATUS_WORDS, parseBusinessVertical, verticalDefinition } from '@pms/domain';
import { LoadError } from '../../../components/load-error';
import { Page, BackCrumb } from '../../../components/page';
import { Badge, Row, Stack } from '../../../components/ui';
import { ApiError, businessAgentsApi, type BusinessAgentView } from '../../../lib/api';
import { placement } from '../../../lib/ai-agents';
import { loadErrorProps } from '../../../lib/load-error';
import { serverT } from '../../../i18n/server';

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
  const t = await serverT();
  if (!agent) {
    return (
      <Page title={t('ИИ-продавец')} crumbs={<BackCrumb href="/ai-agents">{t('ИИ-продавцы')}</BackCrumb>}>
        <LoadError testId="agent-error" title={t('Не удалось загрузить агента')} {...loadErrorProps(failure)} />
      </Page>
    );
  }
  const vertical = parseBusinessVertical(agent.business.vertical);
  const shell = await deskShell();
  let instruction = null;
  let instructionError: unknown = null;
  try { instruction = await businessAgentsApi.instruction(id); } catch (error) { instructionError = error; }
  return (
    <Page
      title={agent.name}
      subtitle={placement(agent.business, agent.location)}
      crumbs={<BackCrumb href="/ai-agents">{t('ИИ-продавцы')}</BackCrumb>}
      width="wide"
    >
      <Stack>
        <Row>
          {/* состояние словом; сырое значение API («active») и метки «Продажи»/«Hospitality» на экран не выводятся */}
          <Badge data-testid="agent-lifecycle">
            {agent.lifecycle === 'draft'
              ? t(AGENT_STATUS_WORDS.DRAFT)
              : agent.lifecycle === 'archived'
                ? t('В архиве')
                : agent.lifecycle === 'paused'
                  ? t('На паузе')
                  : t(AGENT_STATUS_WORDS.WORKING)}
          </Badge>
          <Badge data-testid="agent-vertical">{vertical ? t(verticalDefinition(vertical).label) : t('Направление не определено')}</Badge>
        </Row>
        <div data-testid="agent-tools">
          <p>{vertical === 'BEAUTY' ? t('Инструменты: активные услуги, цены каталога и длительность.') :
            vertical === 'FOOD_SERVICE' ? t('Инструменты: периоды обслуживания ресторана.') :
            vertical === 'HOSPITALITY' ? t('Инструменты: наличие и стоимость проживания, существующий сценарий бронирования.') :
            t('Инструменты направления недоступны.')}</p>
          <p className="muted">{t('Доступ проверяется сервером при каждом вызове. Черновик и приостановленный агент гостям не отвечают.')}</p>
        </div>
        {instruction ? <InstructionEditor id={id} initial={instruction} vertical={vertical} readOnly={shell.readOnly} /> :
          <LoadError testId="agent-instruction-error" title={t('Не удалось загрузить инструкцию')} {...loadErrorProps(instructionError)} />}
        <TelegramPanel id={id} readOnly={shell.readOnly || agent.lifecycle === 'archived'} />
        <div>
          <Link className="btn btn--secondary" href="/ai-agents">
            {t('К списку агентов')}
          </Link>
        </div>
      </Stack>
    </Page>
  );
}
