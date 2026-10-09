import Link from 'next/link';
import { requireVertical } from '../../lib/vertical-guard';
import './marketing.css';
import { ActionMenu } from '../../components/action-menu';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Badge } from '../../components/ui';

/**
 * Хаб «Маркетинг» (MKT2, ADR-149; макет Marketing 2.0 владельца 09.10.2026, plans/mkt10-marketing-2-audit-2026-10-09.md):
 * три модуля одного вида (сайт, реклама, контент) и колонка результатов справа. Рабочий модуль пока один, «Сайт и SEO»:
 * главная кнопка открывает конструктор, прочие разделы сайта в меню «⋯». Реклама и контент ещё не построены, поэтому
 * у них «Скоро» без кнопок, а не «Подключить». Своих запросов к API у страницы нет (ADR-149): числа результатов хаб не
 * читает, и вместо выдуманных нулей стоит «Нет данных» с причиной. Направление берётся из `/auth/me` через
 * `requireVertical`, право `settings` проверяет общий `AccessGate`.
 */
interface Module {
  key: 'site' | 'ads' | 'content';
  testId: string;
  title: string;
  icon: IconName;
  text: string;
  caps: string[];
}

const MODULES: Module[] = [
  {
    key: 'site',
    testId: 'marketing-site',
    title: 'Сайт и SEO',
    icon: 'analytics',
    text: 'Опишите словами, каким должен быть сайт гостиницы: ИИ соберёт его, вы поправите и опубликуете. Бронирование идёт прямо в WETOP.',
    caps: ['ИИ-конструктор сайта', 'Онлайн-бронирование', 'SEO и аналитика'],
  },
  {
    key: 'ads',
    testId: 'marketing-ads',
    title: 'Реклама',
    icon: 'channels',
    text: 'Рекламные кампании в Facebook и Instagram с ИИ-таргетологом. Без вашего подтверждения бюджет не тратится.',
    caps: ['Подключение рекламных кабинетов', 'Кампании с подтверждением запуска', 'Расходы, заявки и брони'],
  },
  {
    key: 'content',
    testId: 'marketing-content',
    title: 'Контент',
    icon: 'journal',
    text: 'Тексты, фото и видео для сайта и соцсетей с помощью ИИ, план публикаций и согласование.',
    caps: ['Генерация текстов и изображений', 'Медиатека для сайта и рекламы', 'План публикаций'],
  },
];

const RESULTS = ['Переходы на сайт', 'Заявки на бронирование', 'Потрачено на рекламу', 'Доход с рекламы'];

const SITE_MENU = [
  { label: 'Публикация', href: '/marketing/site' },
  { label: 'Изображения', href: '/marketing/site/assets' },
  { label: 'Бронирование и аналитика', href: '/website' },
];

function ModuleCard({ module }: { module: Module }) {
  const live = module.key === 'site';
  const headingId = `${module.testId}-title`;
  return (
    <section
      className={live ? 'panel marketing-module marketing-module--live' : 'panel marketing-module'}
      aria-labelledby={headingId}
      data-testid="marketing-module"
    >
      <div data-testid={module.testId} className="marketing-module__body">
        <div className="marketing-module__head">
          <span className="marketing-module__icon" aria-hidden="true">
            <Icon name={module.icon} />
          </span>
          <h2 id={headingId}>{module.title}</h2>
          <Badge tone={live ? 'ok' : undefined} data-testid={`${module.testId}-status`}>
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
          {live ? (
            <>
              <Link className="btn" href="/marketing/site/editor">
                Открыть конструктор
                <Icon name="arrow" width={16} aria-hidden="true" />
              </Link>
              <ActionMenu label={`Ещё действия: ${module.title}`} items={SITE_MENU} />
            </>
          ) : (
            <span className="marketing-module__note">В разработке</span>
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
      subtitle="Привлекайте гостей, развивайте сайт и продвигайте бизнес с помощью ИИ."
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
            <span className="marketing-module__icon" aria-hidden="true">
              <Icon name="analytics" />
            </span>
            <div className="marketing-start__body">
              <h2 id="marketing-start-title">Больше гостей, меньше рутины</h2>
              <p>Начните с сайта: реклама и контент подключатся к нему, когда выйдут.</p>
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}
