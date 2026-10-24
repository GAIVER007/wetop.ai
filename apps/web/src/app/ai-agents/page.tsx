import Link from 'next/link';
import './ai-agents.css';
import { LoadError } from '../../components/load-error';
import { Page } from '../../components/page';
import { Badge, Fact, Grid, Notice, Panel, Row, Stack } from '../../components/ui';
import {
  agentHref,
  channelLines,
  createButton,
  placementLine,
  agentReadiness,
} from '../../lib/ai-agents';
import { sellerApi, type AgentCardView, type AgentCatalogView } from '../../lib/api';
import { deskShell } from '../../lib/desk-shell';
import { loadErrorProps } from '../../lib/load-error';
import { sellerVerticalUiCopy } from '../../lib/ai-seller';
import type { WebVertical } from '../../lib/vertical-landing';
import { supportContacts } from '../../lib/support-contacts';
import { BackToModules } from '../marketing/parts';
import { serverT } from '../../i18n/server';
import type { Translate } from '../../i18n';

/**
 * Каталог «ИИ-агентов» (S0: `plans/ai-agents-wetop-support-2026-09-29.md`, Q-A2; SA1: `plans/business-ai-seller-v2-2026-09-29.md`
 * §8). Партнёр видит агентов своей организации: рабочего AI-продавца и черновики гостевого мастера. Расширение
 * «ИИ-продавец» включает администратор WETOP (ADR-083): без него вместо списка одна карточка с объяснением, а не отказ.
 * Статусы и каналы показывают только то, что видно в данных сегодня (SA1); хранимого состояния агента пока нет.
 * WETOP Support — агент платформы: его карточку видит главный администратор, а обычный пользователь говорит с ним
 * через «Техподдержка → Написать в поддержку».
 */
export default async function AiAgentsPage() {
  const { readOnly, vertical } = await deskShell();
  let catalog: AgentCatalogView | null = null;
  let failure: unknown = null;
  try {
    catalog = await sellerApi.catalog();
  } catch (error) {
    failure = error;
  }
  // расширения нет: одна карточка с действием, без неактивной кнопки снаружи (аудит 21.10.2026 п. 3)
  const off = catalog?.extension?.access === 'off';
  const button = catalog && !off ? createButton(catalog, readOnly) : null;
  const disabledReasonId = 'agent-add-reason';
  const t = await serverT();
  return (
    <Page crumbs={<BackToModules />} title={t('ИИ-продавец')} subtitle={t('Настройка продавцов, инструкции и каналы общения.')}>
      {failure !== null && (
        <LoadError
          testId="agents-error"
          title={t('Не удалось загрузить агентов')}
          {...loadErrorProps(failure)}
        />
      )}
      <Stack>
        <Grid min={280}>
          {off && <OffCard vertical={vertical} t={t} />}
          {catalog?.agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} t={t} />
          ))}
        </Grid>
        {button && (
          <div data-testid="agent-add">
            <Stack gap="sm">
              {button.href !== null ? (
                <div>
                  <Link className="btn" href={button.href}>
                    {t(button.label)}
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
                      {t(button.label)}
                    </button>
                  </div>
                  <Notice id={disabledReasonId} tone="muted">
                    {button.reason ? t(button.reason) : null}
                  </Notice>
                </>
              )}
              {button.connectHref && (
                <div>
                  <Link href={button.connectHref}>{t('Как подключить расширение')}</Link>
                </div>
              )}
            </Stack>
          </div>
        )}
      </Stack>
    </Page>
  );
}

/** Расширение не подключено: вместо списка что даёт продавец и кнопка в поддержку (Q-SA-1: счёт, цены здесь нет) */
function OffCard({ vertical, t }: { vertical: WebVertical; t: Translate }) {
  const copy = sellerVerticalUiCopy(vertical);
  const href = supportContacts(process.env)?.whatsapp ?? '/help#support';
  return (
    <Panel title={t('Что умеет ИИ-продавец')} className="agent-card" data-testid="agent-seller">
      <Stack gap="sm">
        <div>{t(copy.agentCard)}</div>
        <div data-testid="agent-seller-off" className="muted">
          {t('Расширение не подключено. Его подключает команда WETOP после оплаты по счёту.')}
        </div>
        <div>
          {href.startsWith('/') ? (
            <Link className="btn" href={href} data-testid="agent-seller-ask">
              {t('Связаться с поддержкой')}
            </Link>
          ) : (
            <a className="btn" href={href} target="_blank" rel="noreferrer" data-testid="agent-seller-ask">
              {t('Связаться с поддержкой')}
            </a>
          )}
        </div>
      </Stack>
    </Panel>
  );
}

function AgentCard({ agent, t }: { agent: AgentCardView; t: Translate }) {
  const isSeller = agent.kind === 'seller';
  const channels = channelLines(agent);
  const readiness = agentReadiness(agent);
  return (
    <Panel
      title={agent.name}
      className="agent-card"
      data-testid={
        isSeller ? 'agent-seller' : agent.kind === 'agent' ? 'agent-created' : 'agent-draft'
      }
    >
      <Stack gap="sm">
        <Row>
          <Badge tone={readiness.tone} data-testid="agent-status">
            {t(readiness.label)}
          </Badge>
        </Row>
        <div className="muted">{t(placementLine(agent))}</div>
        <p className="agent-card__hint">{t(readiness.hint)}</p>
        {channels.length > 0 && (
          <Row gap="lg" data-testid="agent-channels">
            {channels.map((c) => (
              <Fact key={c.label} label={t(c.label)} value={t(c.word)} />
            ))}
          </Row>
        )}
        <div>
          <Link
            className="btn btn--secondary"
            href={agentHref(agent)}
            aria-label={t('Открыть: {name}', { name: agent.name })}
          >
            {t('Открыть')}
          </Link>
        </div>
      </Stack>
    </Panel>
  );
}
