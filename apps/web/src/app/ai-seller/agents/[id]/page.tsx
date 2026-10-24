import { sellerAgentsApi, ApiError } from '../../../../lib/api';
import { Page, BackCrumb } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { AgentEditor } from '../editor';
import '../agents.css';
import '../../../create/wizard.css';
import { serverT } from '../../../../i18n/server';

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await serverT();
  const back = <BackCrumb href="/ai-seller/agents">{t('Мои ИИ-продавцы')}</BackCrumb>;
  try {
    const agent = await sellerAgentsApi.get(id);
    return (
      <Page className="seller-agents" crumbs={back} title={agent.name}>
        <AgentEditor agent={agent} />
      </Page>
    );
  } catch (e) {
    if (e instanceof ApiError)
      // заголовок тот же, что у списка: экран не меняет имя на «Карточка агента» при сбое
      return (
        <Page className="seller-agents" crumbs={back} title={t('ИИ-продавец')}>
          <LoadError testId="seller-agent-error" {...loadErrorProps(e)} />
        </Page>
      );
    throw e;
  }
}
