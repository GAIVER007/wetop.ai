import '../../agents/agents.css';
import '../../../create/wizard.css';
import { Page, BackCrumb } from '../../../../components/page';
import { AgentEditor } from '../editor';
import { serverT } from '../../../../i18n/server';
export default async function NewAgentPage() {
  const t = await serverT();
  return (
    <Page
      className="seller-agents"
      crumbs={<BackCrumb href="/ai-seller/agents">{t('Мои ИИ-продавцы')}</BackCrumb>}
      title={t('Новый ИИ-продавец')}
      subtitle={t('Задайте имя, компанию и задачу. Сначала сохраним черновик.')}
    >
      <AgentEditor
        creating
        agent={{
          id: '',
          name: '',
          scenario: 'sales',
          lifecycle: 'draft',
          profile: {},
          updatedAt: '',
        }}
      />
    </Page>
  );
}
