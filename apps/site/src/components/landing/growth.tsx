import { getDictionary } from '../../i18n';
import { siteConfig } from '../../site.config';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * «Продажи, которые помогают зарабатывать больше» (по снимку владельца): две большие карточки,
 * «Загрузка конкурентов» (ADR-142) с примером цен одной даты и «ИИ-продавец» с примером диалога,
 * ниже полоса «Откуда приходят брони». Примеры помечены вымышленными, слова «пилот» нет; честная
 * пометка про отдельное подключение ИИ остаётся строкой под карточкой.
 */
export function Growth() {
  const { growth } = getDictionary();
  const appUrl = siteConfig.appUrl.replace(/\/+$/, '');
  const chart = [36, 30, 40, 22, 34];
  const w = 220;
  const h = 64;
  const step = w / (chart.length - 1);
  const points = chart.map((y, i) => `${i * step},${y}`).join(' ');
  const markerIndex = 3;
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
          {/* Загрузка конкурентов */}
          <article id="market" className="card glass growth__module">
            <div className="growth__module-copy">
              <span className="icon-tile">
                <Icon name={growth.market.icon} />
              </span>
              <h3 className="card__title">{typo(growth.market.title)}</h3>
              <p className="card__text">{typo(growth.market.text)}</p>
              <ul className="growth__points">
                {growth.market.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={16} />
                    {point}
                  </li>
                ))}
              </ul>
              <a className="btn btn--primary growth__action" href={`${appUrl}/market`}>
                {growth.market.action}
                <Icon name="arrowRight" size={16} />
              </a>
            </div>
            <aside className="growth__panel" aria-label={growth.market.preview.label}>
              <div className="growth__panel-head">
                <strong>{typo(growth.market.preview.title)}</strong>
                <span className="dash__delta">{growth.market.preview.delta}</span>
              </div>
              <ul className="growth__prices">
                {growth.market.preview.rows.map((row) => (
                  <li key={row.name} className={row.own ? 'growth__price--own' : undefined}>
                    <span>{row.name}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
              <div className="growth__chart">
                <svg viewBox={`0 -14 ${w} ${h + 28}`} role="img" aria-label={growth.market.preview.label}>
                  <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {chart.map((y, i) => (
                    <circle key={i} cx={i * step} cy={y} r={i === markerIndex ? 4.5 : 3} fill="currentColor" />
                  ))}
                </svg>
                <span className="growth__marker">{growth.market.preview.marker}</span>
                <div className="growth__days">
                  {growth.market.preview.days.map((day, i) => (
                    <span key={day} className={i === markerIndex ? 'growth__day--on' : undefined}>
                      {day}
                    </span>
                  ))}
                </div>
              </div>
              <p className="growth__example">{growth.market.preview.label}</p>
            </aside>
          </article>

          {/* ИИ-продавец */}
          <article id="ai-sellers" className="card glass growth__module">
            <div className="growth__module-copy">
              <span className="icon-tile">
                <Icon name={growth.ai.icon} />
              </span>
              <h3 className="card__title">{typo(growth.ai.title)}</h3>
              <p className="card__text">{typo(growth.ai.text)}</p>
              <ul className="growth__points">
                {growth.ai.points.map((point) => (
                  <li key={point}>
                    <Icon name="check" size={16} />
                    {point}
                  </li>
                ))}
              </ul>
              <a className="btn btn--primary growth__action" href={`${appUrl}/ai-seller/agents`}>
                {growth.ai.action}
                <Icon name="arrowRight" size={16} />
              </a>
              <p className="growth__note">{typo(growth.ai.note)}</p>
            </div>
            <aside className="growth__panel growth__chat" aria-label={growth.ai.chat.label}>
              <div className="growth__chat-head">
                <span className="dash__logo" aria-hidden="true">
                  W
                </span>
                <strong>{growth.ai.chat.title}</strong>
                <span className="growth__online">{growth.ai.chat.online}</span>
              </div>
              <p className="growth__bubble growth__bubble--in">{typo(growth.ai.chat.inbound)}</p>
              <p className="growth__bubble growth__bubble--out">{typo(growth.ai.chat.outbound)}</p>
              <div className="growth__chat-input" aria-hidden="true">
                <span>{growth.ai.chat.placeholder}</span>
                <Icon name="arrowRight" size={14} />
              </div>
              <p className="growth__example">{growth.ai.chat.label}</p>
            </aside>
          </article>
        </div>

        <div className="growth__sources glass glass--quiet">
          <div className="growth__sources-heading">
            <h3 className="card__title">{typo(growth.sources.title)}</h3>
            <p className="card__text">{typo(growth.sources.lead)}</p>
          </div>
          <ul className="growth__sources-grid">
            {growth.sources.items.map((item) => (
              <li key={item.title}>
                <span className="icon-tile icon-tile--sm">
                  <Icon name={item.icon} size={18} />
                </span>
                <div>
                  <strong>{typo(item.title)}</strong>
                  <span>{typo(item.text)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
