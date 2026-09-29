import Link from 'next/link';
import { Page } from '../../components/page';
import { Badge, Grid, Panel, Row, Stack } from '../../components/ui';
import { deskShell } from '../../lib/desk-shell';

/**
 * Вход в раздел «ИИ-агенты» (S0, `plans/ai-agents-wetop-support-2026-09-29.md`; решение владельца 29.09, Q-A2).
 * Только навигация: у каждого агента свой экран и свои права. Партнёр видит агентов своего бизнеса — сейчас это
 * AI-продавец — и только по действующему расширению организации (ADR-083, ADR-090): без него карточка ведёт не в
 * настройки, а на страницу с объяснением, доступ проверяет сам раздел. WETOP Support — агент платформы: его карточку видит главный администратор, а обычный пользователь
 * говорит с ним через «Техподдержка → Написать в поддержку».
 */
export default async function AiAgentsPage() {
  const { access } = await deskShell();
  return (
    <Page
      title="ИИ-агенты"
      subtitle="Помощники, которые работают в вашей организации: где они и как их настроить."
    >
      <Grid min={280}>
        <Panel title="AI-продавец" data-testid="agent-seller">
          <Stack gap="sm">
            <Row>
              <Badge>Продажи</Badge>
              <Badge>Hospitality</Badge>
            </Row>
            <div>Отвечает гостям в чате на сайте, называет цены по тарифу и зовёт человека.</div>
            {!access.aiSeller && (
              <div data-testid="agent-seller-off" className="muted">
                Расширение «ИИ-продавец» не подключено. Подключает администратор WETOP после оплаты по счёту.
              </div>
            )}
            <div>
              <Link
                className={access.aiSeller ? 'btn' : 'btn btn--secondary'}
                href="/ai-seller"
                aria-label={access.aiSeller ? 'Открыть: AI-продавец' : 'Подробнее: AI-продавец'}
              >
                {access.aiSeller ? 'Открыть' : 'Подробнее'}
              </Link>
            </div>
          </Stack>
        </Panel>
        {access.platform && (
          <Panel title="WETOP Support" data-testid="agent-support">
            <Stack gap="sm">
              <div className="muted">Техническая поддержка платформы</div>
              <div>
                <Badge>Platform Agent</Badge>
              </div>
              <div>Отвечает пользователям всех организаций; диалоги, знания и настройки — здесь.</div>
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
    </Page>
  );
}
