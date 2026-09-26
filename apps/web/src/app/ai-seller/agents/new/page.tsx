import Link from 'next/link';
import '../../agents/agents.css';
import '../../../create/wizard.css';
import { AgentEditor } from '../editor';
export default function NewAgentPage() {
  return (
    <main className="seller-agents">
      <header>
        <div>
          <Link href="/ai-seller/agents">Мои ИИ-продавцы</Link>
          <h1>Новый ИИ-продавец</h1>
          <p>Задайте имя, компанию и задачу. Сначала сохраним черновик.</p>
        </div>
      </header>
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
    </main>
  );
}
