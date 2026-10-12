import '../../agents/agents.css';
import '../../../create/wizard.css';
import { Page, BackCrumb } from '../../../../components/page';
import { AgentEditor } from '../editor';
export default function NewAgentPage() {
  return (
    <Page
      className="seller-agents"
      crumbs={<BackCrumb href="/ai-seller/agents">Мои ИИ-продавцы</BackCrumb>}
      title="Новый ИИ-продавец"
      subtitle="Задайте имя, компанию и задачу. Сначала сохраним черновик."
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
