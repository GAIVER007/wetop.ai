import Link from 'next/link';
import './ai-agents.css';
import { AGENT_STATUS_WORDS } from '@pms/domain';
import { LoadError } from '../../components/load-error';
import { Page } from '../../components/page';
import { Badge, Fact, Grid, Notice, Panel, Row, Stack } from '../../components/ui';
import { agentHref, channelLines, createButton, placementLine, statusTone } from '../../lib/ai-agents';
import { sellerApi, type AgentCardView, type AgentCatalogView } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { loadErrorProps } from '../../lib/load-error';

/**
 * Каталог «ИИ-агентов» (S0: `plans/ai-agents-wetop-support-2026-09-29.md`, Q-A2; SA1: `plans/business-ai-seller-v2-2026-09-29.md`
 * §8). Партнёр видит агентов своей организации: рабочего AI-продавца и черновики гостевого мастера. Расширение
 * «ИИ-продавец» включает администратор WETOP (ADR-083): без него вместо списка одна карточка с объяснением, а не отказ.
 * Статусы и каналы показывают только то, что видно в данных сегодня (SA1); хранимого состояния агента пока нет.
 * WETOP Support — агент платформы: его карточку видит главный администратор, а обычный пользователь говорит с ним
 * через «Техподдержка → Написать в поддержку».
 */
export default async function AiAgentsPage() {
  const { access, readOnly } = await deskShell();
  let catalog: AgentCatalogView | null = null;
  let failure: unknown = null;
  try {
    catalog = await sellerApi.catalog();
  } catch (error) {
    failure = error;
  }
  const button = catalog ? createButton(catalog, readOnly) : null;
  const disabledReasonId = 'agent-add-reason';
  return (
    <Page
      title="ИИ-агенты"
      subtitle="Помощники, которые работают в вашей организации: где они и как их настроить."
    >
      {failure !== null && (
        <LoadError
          testId="agents-error"
          title="Не удалось загрузить агентов"
          {...loadErrorProps(failure)}
        />
      )}
      <Stack>
        <Grid min={280}>
          {catalog && catalog.extension?.access === 'off' && <OffCard />}
          {catalog?.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          {access.platform && (
            <Panel title="WETOP Support" className="agent-card" data-testid="agent-support">
              <Stack gap="sm">
                <div className="muted">Техническая поддержка платформы</div>
                <div>
                  <Badge>Platform Agent</Badge>
                </div>
                <div>
                  Отвечает пользователям всех организаций; диалоги, знания и настройки — здесь.
                </div>
                <div>
                  <Link
                    className="btn"
                    href="/platform/support"
                    prefetch={false}
                    aria-label="Открыть: WETOP Support"
                  >
                    Открыть
                  </Link>
                </div>
              </Stack>
            </Panel>
          )}
        </Grid>
        {button && (
          <div data-testid="agent-add">
            <Stack gap="sm">
              {button.href !== null ? (
                <div>
                  <Link className="btn" href={button.href}>
                    {button.label}
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled
                      aria-describedby={disabledReasonId}
                    >
                      {button.label}
                    </button>
                  </div>
                  <Notice id={disabledReasonId} tone="muted">
                    {button.reason}
                  </Notice>
                </>
              )}
              {button.connectHref && (
                <div>
                  <Link href={button.connectHref}>Как подключить расширение</Link>
                </div>
              )}
            </Stack>
          </div>
        )}
      </Stack>
    </Page>
  );
}

/** Расширение не подключено: вместо списка — что даёт продавец и как его подключить (Q-SA-1: счёт, цены здесь нет) */
function OffCard() {
  return (
    <Panel title="AI-продавец" className="agent-card" data-testid="agent-seller">
      <Stack gap="sm">
        <Row>
          <Badge>Продажи</Badge>
          <Badge>Hospitality</Badge>
        </Row>
        <div>Автоматизируйте ответы гостям, подбор размещения и продажи.</div>
        <div data-testid="agent-seller-off" className="muted">
          Расширение «ИИ-продавец» не подключено. Подключает администратор WETOP после оплаты по
          счёту.
        </div>
      </Stack>
    </Panel>
  );
}

function AgentCard({ agent }: { agent: AgentCardView }) {
  const isSeller = agent.kind === 'seller';
  const isSales = isSeller || agent.kind === 'agent';
  const channels = channelLines(agent);
  return (
    <Panel
      title={agent.name}
      className="agent-card"
      data-testid={isSeller ? 'agent-seller' : agent.kind === 'agent' ? 'agent-created' : 'agent-draft'}
    >
      <Stack gap="sm">
        <Row>
          {isSales && (
            <>
              <Badge>Продажи</Badge>
              <Badge>Hospitality</Badge>
            </>
          )}
          <Badge tone={statusTone(agent.status)} data-testid="agent-status">
            {AGENT_STATUS_WORDS[agent.status]}
          </Badge>
        </Row>
        <div className="muted">{placementLine(agent)}</div>
        {channels.length > 0 && (
          <Row gap="lg" data-testid="agent-channels">
            {channels.map((c) => (
              <Fact key={c.label} label={c.label} value={c.word} />
            ))}
          </Row>
        )}
        <div>
          <Link
            className="btn btn--secondary"
            href={agentHref(agent)}
            aria-label={`Открыть: ${agent.name}`}
          >
            Открыть
          </Link>
        </div>
      </Stack>
    </Panel>
  );
}
