import Link from 'next/link';
import { sellerAgentsApi, ApiError } from '../../../../lib/api';
import { AgentEditor } from '../editor';
import '../agents.css';
import '../../../create/wizard.css';
export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const agent = await sellerAgentsApi.get(id);
    return (
      <main className="seller-agents">
        <header>
          <div>
            <Link href="/ai-seller/agents">Все агенты</Link>
            <h1>{agent.name}</h1>
          </div>
        </header>
        <AgentEditor agent={agent} />
      </main>
    );
  } catch (e) {
    if (e instanceof ApiError)
      return (
        <main className="seller-agents">
          <h1>Карточка агента</h1>
          <p role="alert">{e.message}</p>
          <Link href="/ai-seller/agents">Все агенты</Link>
        </main>
      );
    throw e;
  }
}
