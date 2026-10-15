import { sellerAgentsApi, ApiError } from '../../../../lib/api';
import { Page, BackCrumb } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { loadErrorProps } from '../../../../lib/load-error';
import { AgentEditor } from '../editor';
import '../agents.css';
import '../../../create/wizard.css';

const back = <BackCrumb href="/ai-seller/agents">Мои ИИ-продавцы</BackCrumb>;

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        <Page className="seller-agents" crumbs={back} title="ИИ-продавец">
          <LoadError testId="seller-agent-error" {...loadErrorProps(e)} />
        </Page>
      );
    throw e;
  }
}
