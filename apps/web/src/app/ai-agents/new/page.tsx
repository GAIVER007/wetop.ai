import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import '../ai-agents.css';
import { LoadError } from '../../../components/load-error';
import { Page, BackCrumb } from '../../../components/page';
import { Notice, Panel, Stack } from '../../../components/ui';
import { READ_ONLY_MESSAGE } from '@pms/domain';
import { deskShell } from '../../../lib/desk-shell';
import { businessAgentsApi, type AgentOptionsView } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { AgentCreateForm } from './form';
import { serverT } from '../../../i18n/server';

/**
 * Создание AI-продавца (SA2, plans/business-ai-seller-sa2-2026-09-30.md): один экран, а не мастер из шагов. Создаётся
 * черновик; дальше, страница агента со списком настройки. Можно ли создавать, решает сервер (`options.canCreate`).
 */
export default async function NewAgentPage() {
  const { readOnly } = await deskShell();
  let options: AgentOptionsView | null = null;
  let failure: unknown = null;
  try {
    options = await businessAgentsApi.options();
  } catch (error) {
    failure = error;
  }
  const t = await serverT();
  return (
    <Page
      title={t('Новый AI-продавец')}
      subtitle={t('Выберите объект и дайте продавцу имя.')}
      width="narrow"
      crumbs={<BackCrumb href="/ai-agents">{t('ИИ-продавцы')}</BackCrumb>}
    >
      {failure !== null && (
        <LoadError testId="agents-error" title={t('Не удалось загрузить варианты')} {...loadErrorProps(failure)} />
      )}
      {options && (readOnly || !options.canCreate) && (
        <Panel title={t('Создать нельзя')} data-testid="agent-create-blocked">
          <Stack gap="sm">
            <div>{readOnly ? t(READ_ONLY_MESSAGE) : options.reason ? t(options.reason) : options.reason}</div>
            <div>
              <Link className="btn btn--secondary" href="/ai-agents">
                {t('К списку агентов')}
              </Link>
            </div>
          </Stack>
        </Panel>
      )}
      {options?.canCreate && !readOnly && (
        <Stack>
          <Panel title={t('Основное')}>
            <AgentCreateForm idempotencyKey={randomUUID()} businesses={options.businesses} />
          </Panel>
          <Notice tone="muted">
            {t('Далее: рассказ текстом или голосом и редактор инструкции. Агент останется черновиком до подключения и проверки.')}
          </Notice>
        </Stack>
      )}
    </Page>
  );
}
