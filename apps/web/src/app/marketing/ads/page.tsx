import { requireVertical } from '../../../lib/vertical-guard';
import '../marketing.css';
import { Icon } from '../../../components/icon';
import { Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Button, EmptyState, Stat, Stats } from '../../../components/ui';
import { BackToModules, ModuleSoon } from '../parts';

/**
 * Модуль «Реклама» (макет Marketing 2.0 владельца 09.10.2026, экран 2 «ИИ-таргетолог»; MKT10.4–10.6 в
 * plans/mkt10-marketing-2-audit-2026-10-09.md). Рекламный кабинет ещё не подключается: модели данных и приложения
 * Meta нет, поэтому экран показывает устройство модуля пустыми состояниями. Чисел нет («Нет данных»), кнопки
 * неактивны и объясняют почему. Своих запросов к API у страницы нет, право `settings` как у хаба.
 */
const METRICS = ['Потрачено', 'Заявки', 'Стоимость заявки', 'Доход с рекламы'];
const SOON = 'marketing-ads-soon';

function Campaigns() {
  return (
    <div className="marketing-screen__stack">
      <Stats min={160} data-testid="marketing-ads-metrics">
        {METRICS.map((label) => (
          <Stat key={label} label={label} value="Нет данных" size="sm" />
        ))}
      </Stats>
      <div className="marketing-screen__bar">
        <Button disabled aria-describedby={SOON}>
          <Icon name="plus" width={16} aria-hidden="true" />
          Создать кампанию
        </Button>
        <span className="marketing-screen__period">Последние 30 дней</span>
      </div>
      {/* на телефоне таблица прокручивается вбок: область доступна с клавиатуры (axe scrollable-region-focusable) */}
      <div className="tbl-wrap" role="region" aria-label="Кампании" tabIndex={0}>
        <table className="tbl" data-testid="marketing-ads-campaigns">
          <thead>
            <tr>
              <th scope="col">Кампания</th>
              <th scope="col">Платформа</th>
              <th scope="col">Бюджет</th>
              <th scope="col">Результаты</th>
              <th scope="col">Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="marketing-screen__empty-row">
                Кампаний пока нет. Они появятся после подключения рекламного кабинета.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="marketing-screen__pair">
        <section className="panel marketing-assistant" aria-labelledby="marketing-ads-assistant">
          <div className="marketing-assistant__head">
            <span className="marketing-assistant__icon" aria-hidden="true">
              <Icon name="chat" />
            </span>
            <h2 id="marketing-ads-assistant">ИИ-помощник</h2>
          </div>
          <p>
            Изучит аудиторию гостиницы и предложит кампанию: кому показывать, какой текст и бюджет. Запуск только после
            вашего подтверждения.
          </p>
        </section>
        <section className="panel marketing-assistant" aria-labelledby="marketing-ads-budget">
          <h2 id="marketing-ads-budget">Бюджет</h2>
          <dl className="marketing-facts">
            <div>
              <dt>Лимит в день</dt>
              <dd>задаёте вы</dd>
            </div>
            <div>
              <dt>Период</dt>
              <dd>задаёте вы</dd>
            </div>
            <div>
              <dt>Сверх лимита</dt>
              <dd>не тратится</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

const empty = (text: string) => <EmptyState title="Пока пусто">{text}</EmptyState>;

export default async function MarketingAdsPage() {
  await requireVertical(['HOSPITALITY']);
  return (
    <Page
      crumbs={<BackToModules />}
      title="Реклама"
      subtitle="Подключите рекламные кабинеты и запускайте кампании с помощью ИИ."
      actions={
        <Button tone="secondary" disabled aria-describedby={SOON}>
          Подключить кабинет
        </Button>
      }
    >
      <div className="marketing-screen" data-testid="marketing-ads-screen">
        <ModuleSoon id={SOON} testId={SOON}>
          Модуль в разработке: подключение кабинета Facebook и Instagram и запуск кампаний появятся в следующих этапах.
          Без вашего подтверждения бюджет не тратится.
        </ModuleSoon>
        <Tabs
          label="Разделы рекламы"
          panels={[
            { id: 'campaigns', label: 'Кампании', content: <Campaigns /> },
            { id: 'audiences', label: 'Аудитории', content: empty('Аудитории ИИ соберёт из гостей и посетителей сайта.') },
            { id: 'creatives', label: 'Креативы', content: empty('Картинки и тексты объявлений придут из модуля «Контент».') },
            { id: 'analytics', label: 'Аналитика', content: empty('Расходы, заявки и брони по кампаниям появятся после первых запусков.') },
            { id: 'settings', label: 'Настройки', content: empty('Рекламный кабинет, лимиты бюджета и уведомления.') },
          ]}
        />
      </div>
    </Page>
  );
}
