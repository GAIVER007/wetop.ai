import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import './marketing.css';
import { ActionMenu } from '../../components/action-menu';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Badge } from '../../components/ui';

/**
 * Хаб «Маркетинг» (MKT2, ADR-149; макет Marketing 2.0 владельца 09.10.2026, plans/mkt10-marketing-2-audit-2026-10-09.md):
 * три модуля одного вида (сайт, реклама, контент) и колонка результатов справа. У каждого модуля главная кнопка
 * «Открыть» ведёт на его экран: сайт в конструктор, реклама и контент на свои экраны, где пока пустые состояния
 * («Скоро», а не «Подключено»). Прочие разделы сайта в меню «⋯». Своих запросов к API у страницы нет (ADR-149): числа
 * результатов хаб не читает, и вместо выдуманных нулей стоит «Нет данных» с причиной. Направление берётся из
 * `/auth/me` через `requireVertical`, право `settings` проверяет общий `AccessGate`.
 */
interface Module {
  key: 'site' | 'budget' | 'ads' | 'content';
  testId: string;
  title: string;
  icon: IconName;
  href: string;
  text: string;
  caps: string[];
}

const MODULES: Module[] = [
  {
    key: 'site',
    testId: 'marketing-site',
    title: 'Сайт и SEO',
    icon: 'analytics',
    href: '/marketing/site/editor',
    text: 'Создайте сайт гостиницы с помощью ИИ, подключите онлайн-бронирование и продвигайте его в поиске.',
    caps: ['ИИ-конструктор сайта', 'Онлайн-бронирование', 'SEO-оптимизация'],
  },
  {
    // МКТ-В1/В2 (ADR-MKT-B1): учёт бюджета и расходов — работает с базой, в отличие от «Скоро» ниже
    key: 'budget',
    testId: 'marketing-budget',
    title: 'Бюджет',
    icon: 'money',
    href: '/marketing/budget',
    text: 'Планируйте рекламный бюджет, ведите расходы по каналам и следите за прогнозом месяца.',
    caps: ['План месяца и прогноз', 'Журнал расходов по каналам', 'Аналитика бюджета'],
  },
  {
    key: 'ads',
    testId: 'marketing-ads',
    title: 'Реклама',
    icon: 'channels',
    href: '/marketing/ads',
    text: 'Запускайте рекламные кампании в Facebook и Instagram с помощью ИИ-таргетолога.',
    caps: ['Подключение рекламных кабинетов', 'Автоматическая настройка и оптимизация', 'Подробная аналитика и отчёты'],
  },
  {
    key: 'content',
    testId: 'marketing-content',
    title: 'Контент',
    icon: 'journal',
    href: '/marketing/content',
    text: 'Создавайте фото, тексты, видео и посты с помощью ИИ. Планируйте публикации во все соцсети.',
    caps: ['Генерация фото и видео', 'Готовые шаблоны постов', 'Планировщик публикаций'],
  },
];

const RESULTS = ['Переходы на сайт', 'Заявки на бронирование', 'Потрачено на рекламу', 'Доход с рекламы'];

const SITE_MENU = [
  { label: 'Публикация', href: '/marketing/site' },
  { label: 'Изображения', href: '/marketing/site/assets' },
  { label: 'Бронирование и аналитика', href: '/website' },
];

const LIVE = new Set(['site', 'budget']);
const BUDGET_MENU = [
  { label: 'Расходы', href: '/marketing/budget/expenses' },
  { label: 'Аналитика маркетинга', href: '/marketing/analytics' },
];

function ModuleCard({ module }: { module: Module }) {
  const live = LIVE.has(module.key);
  const headingId = `${module.testId}-title`;
  return (
    <section
      className={`panel marketing-module marketing-module--${module.key}`}
      aria-labelledby={headingId}
      data-testid="marketing-module"
    >
      <div data-testid={module.testId} className="marketing-module__body">
        <div className="marketing-module__head">
          <span className="marketing-module__icon" aria-hidden="true">
            <Icon name={module.icon} />
          </span>
          <h2 id={headingId}>{module.title}</h2>
          <Badge tone={live ? 'ok' : 'info'} data-testid={`${module.testId}-status`}>
            {live ? 'Доступно' : 'Скоро'}
          </Badge>
        </div>
        <p className="marketing-module__text">{module.text}</p>
        <ul className="marketing-module__caps">
          {module.caps.map((cap) => (
            <li key={cap}>
              <Icon name="check" width={16} aria-hidden="true" />
              {cap}
            </li>
          ))}
        </ul>
        <div className="marketing-module__foot">
          <Link className="btn" href={module.href} aria-label={`Открыть: ${module.title}`}>
            Открыть
            <Icon name="arrow" width={16} aria-hidden="true" />
          </Link>
          {live && (
            <ActionMenu
              label={`Ещё действия: ${module.title}`}
              items={module.key === 'budget' ? BUDGET_MENU : SITE_MENU}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default async function MarketingPage() {
  await requireVertical(['HOSPITALITY']);
  return (
    <Page
      title="Маркетинг"
      subtitle="Привлекайте гостей, автоматизируйте рекламу и развивайте бренд с помощью ИИ."
    >
      <div className="marketing-hub">
        <div className="marketing-hub__modules">
          {MODULES.map((m) => (
            <ModuleCard key={m.key} module={m} />
          ))}
        </div>
        <aside className="marketing-hub__aside">
          <section
            className="panel marketing-results"
            aria-labelledby="marketing-results-title"
            data-testid="marketing-results"
          >
            <h2 id="marketing-results-title">Результаты за 30 дней</h2>
            <dl className="marketing-results__list">
              {RESULTS.map((label) => (
                <div key={label} className="marketing-results__row" data-testid="marketing-result">
                  <span className="marketing-results__mark" aria-hidden="true" />
                  <dt>{label}</dt>
                  <dd>Нет данных</dd>
                </div>
              ))}
            </dl>
            <p className="marketing-results__note">
              Посещения и заявки сайта смотрите в разделе <Link href="/website/analytics">Аналитика сайта</Link>.
              Расходы и доход появятся, когда будет подключена реклама.
            </p>
          </section>
          <section className="panel marketing-start" aria-labelledby="marketing-start-title">
            <div className="marketing-start__head">
              <span className="marketing-start__icon" aria-hidden="true">
                <Icon name="send" />
              </span>
              <div className="marketing-start__body">
                <h2 id="marketing-start-title">Больше гостей, меньше рутины</h2>
                <p>Начните с сайта: реклама и контент подключатся к нему, когда выйдут.</p>
              </div>
            </div>
            <Link className="btn btn--secondary marketing-start__cta" href="/marketing/site/editor">
              Начать с сайта
            </Link>
          </section>
        </aside>
      </div>
    </Page>
  );
}
