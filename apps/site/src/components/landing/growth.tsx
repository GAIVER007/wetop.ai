import type { ReactNode } from 'react';
import marketStyles from './growth-market.module.css';
import aiStyles from './growth-ai.module.css';
import { getDictionary } from '../../i18n';
import type { IconName } from '../icon';
import { registerLink } from '../../lib/site';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Продажи, маркетинг и ИИ» (пометка владельца 13.10.2026: «упакуй чётко, так же стильно про маркетинг и ИИ»):
 * три витрины во всю ширину, текст и пример экрана чередуются по сторонам. Продажи показывают ленту броней
 * из всех каналов, маркетинг сравнение цен с соседями (ADR-142), ИИ диалог продавца. Примеры подписаны
 * вымышленными (§19.9); якоря `#market` и `#ai-sellers` прежние, старые ссылки не ломаются.
 */
export function Growth() {
  const { growth } = getDictionary();
  // Витрины ведут на регистрацию (аудит 22.10.2026, P1-11): ссылка в стойку открывала гостю экран входа
  const register = registerLink().href;
  return (
    <section id="sales" className="section section--band growth" aria-labelledby="growth-title">
      <div className="container">
        <SectionHeading
          id="growth-title"
          eyebrow={growth.eyebrow}
          title={growth.title}
          lead={growth.lead}
          center
        />
        <div className="growth__big">
          <Module
            id="channels-feed"
            tone="sales"
            {...growth.sales}
            action={
              <>
                <a className="btn btn--primary growth__action" href={register} data-auth="register">
                  {growth.sales.action}
                  <Icon name="arrowRight" size={16} />
                </a>
                <p className="growth__note">{typo(growth.sales.note)}</p>
              </>
            }
          >
            <SalesFeed />
          </Module>
          <Module
            id="market"
            tone="marketing"
            {...growth.market}
            action={
              <a className="btn btn--primary growth__action" href={register} data-auth="register">
                {growth.market.action}
                <Icon name="arrowRight" size={16} />
              </a>
            }
          >
            <MarketPreview />
          </Module>
          <Module
            id="ai-sellers"
            tone="ai"
            {...growth.ai}
            action={
              <>
                <a className="btn btn--primary growth__action" href={register} data-auth="register">
                  {growth.ai.action}
                  <Icon name="arrowRight" size={16} />
                </a>
                <p className="growth__note">{typo(growth.ai.note)}</p>
              </>
            }
          >
            <AiChat />
          </Module>
        </div>
      </div>
    </section>
  );
}

type ModuleProps = {
  id: string;
  tone: 'sales' | 'marketing' | 'ai';
  kicker: string;
  icon: IconName;
  title: string;
  text: string;
  points: string[];
  action: ReactNode;
  children: ReactNode;
};

/** Витрина: метка направления, заголовок, текст, пункты и кнопка; справа (или слева) пример экрана. */
function Module({ id, tone, kicker, icon, title, text, points, action, children }: ModuleProps) {
  return (
    <article
      id={id}
      className={`card glass growth__module growth__module--${tone} ${tone === 'marketing' ? marketStyles.module : tone === 'ai' ? aiStyles.module : ''}`}
    >
      <div className="growth__module-copy">
        <span className="growth__kicker">
          <Icon name={icon} size={16} />
          {kicker}
        </span>
        <h3 className="growth__title">{typo(title)}</h3>
        <p className="card__text">{typo(text)}</p>
        <ul className="growth__points">
          {points.map((point) => (
            <li key={point}>
              <Icon name="check" size={16} />
              <span>{typo(point)}</span>
            </li>
          ))}
        </ul>
        {action}
      </div>
      {children}
    </article>
  );
}

function SalesFeed() {
  const { feed } = getDictionary().growth.sales;
  return (
    <aside className="growth__panel" aria-label={feed.label}>
      <div className="growth__panel-head">
        <strong>{feed.title}</strong>
        <span className="growth__count">{feed.rows.length}</span>
      </div>
      <ul className="growth__feed">
        {feed.rows.map((row) => (
          <li key={`${row.source}-${row.detail}`}>
            <span className="icon-tile icon-tile--sm">
              <Icon name={row.icon} size={16} />
            </span>
            <span className="growth__feed-main">
              <strong>{row.guest}</strong>
              <span>
                {row.source}, {row.detail}
              </span>
            </span>
            <strong className="growth__feed-value">{row.value}</strong>
          </li>
        ))}
      </ul>
      <p className="growth__example">{feed.label}</p>
    </aside>
  );
}

function MarketPreview() {
  const { preview } = getDictionary().growth.market;
  const chart = [36, 30, 40, 22, 34];
  const w = 220;
  const h = 64;
  const step = w / (chart.length - 1);
  const points = chart.map((y, i) => `${i * step},${y}`).join(' ');
  const markerIndex = 3;
  return (
    <aside className={`growth__panel ${marketStyles.panel}`} aria-label={preview.label}>
      <div className={`growth__panel-head ${marketStyles.heading}`}>
        <strong>{typo(preview.title)}</strong>
        <span className="dash__delta">{preview.delta}</span>
      </div>
      <ul className={`growth__prices ${marketStyles.prices}`}>
        {preview.rows.map((row) => (
          <li key={row.name} className={row.own ? 'growth__price--own' : undefined}>
            <span>{row.name}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
      <div className={`growth__chart ${marketStyles.chart}`}>
        <svg viewBox={`0 -14 ${w} ${h + 28}`} role="img" aria-label={preview.label}>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {chart.map((y, i) => (
            <circle
              key={i}
              cx={i * step}
              cy={y}
              r={i === markerIndex ? 4.5 : 3}
              fill="currentColor"
            />
          ))}
        </svg>
        <span className="growth__marker">{preview.marker}</span>
        <div className="growth__days">
          {preview.days.map((day, i) => (
            <span key={day} className={i === markerIndex ? 'growth__day--on' : undefined}>
              {day}
            </span>
          ))}
        </div>
      </div>
      <p className={`growth__example ${marketStyles.example}`}>{preview.label}</p>
    </aside>
  );
}

function AiChat() {
  const { chat } = getDictionary().growth.ai;
  return (
    <aside className={`growth__panel growth__chat ${aiStyles.chat}`} aria-label={chat.label}>
      <div className="growth__chat-head">
        <span className="dash__logo" aria-hidden="true">
          W
        </span>
        <strong>{chat.title}</strong>
        <span className="growth__online">{chat.online}</span>
      </div>
      <p className="growth__bubble growth__bubble--in">{typo(chat.inbound)}</p>
      <p className="growth__bubble growth__bubble--out">{typo(chat.outbound)}</p>
      <p className="growth__bubble growth__bubble--in">{typo(chat.confirmation)}</p>
      <p className={`growth__bubble growth__bubble--out ${aiStyles.confirmed}`}>
        <Icon name="check" size={18} />
        <span>{typo(chat.booked)}</span>
      </p>
      <div className="growth__chat-input" aria-hidden="true">
        <span>{chat.placeholder}</span>
        <Icon name="arrowRight" size={14} />
      </div>
      <p className="growth__example">{chat.label}</p>
    </aside>
  );
}
