import { getDictionary } from '../../i18n';
import { Icon } from '../icon';
import { SectionHeading } from '../section-heading';
import { typo } from '../typo';

/*
 * Три стеклянные колонки, как нижний ряд на снимках направления: что входит в систему, какие каналы
 * подключаются и на каких принципах всё держится. Вместо процентов готовности — состояние «в системе»:
 * доли, которых никто не считал, на сайте не пишем.
 */
export function Toolkit() {
  const { toolkit } = getDictionary();
  return (
    <section id="toolkit" className="section" aria-labelledby="toolkit-title">
      <div className="container">
        <SectionHeading
          id="toolkit-title"
          eyebrow={toolkit.eyebrow}
          title={toolkit.title}
          lead={toolkit.lead}
        />
        <div className="trio">
          <div className="panel glass">
            <p className="eyebrow panel__title">{toolkit.modules.title}</p>
            <ul className="modules">
              {toolkit.modules.items.map((name) => (
                <li key={name}>
                  <span className="modules__name">{typo(name)}</span>
                  <span className="modules__state">
                    <Icon name="check" size={14} />
                    {toolkit.modules.state}
                  </span>
                  <span className="modules__rail" aria-hidden="true">
                    <i />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel glass">
            <p className="eyebrow panel__title">{toolkit.channels.title}</p>
            <ul className="channels">
              {toolkit.channels.items.map((item) => (
                <li key={item.name} className="channel-tile">
                  <span className="channel-tile__mark" aria-hidden="true">
                    {item.mark}
                  </span>
                  <span className="channel-tile__name">{item.name}</span>
                </li>
              ))}
            </ul>
            <p className="panel__connection-note">
              OTA подключаются через Channex. Доступность площадок и обмен данными проверяются для
              вашего объекта; регистрация сама по себе не включает синхронизацию.
            </p>
          </div>

          <div className="panel glass">
            <p className="eyebrow panel__title">{toolkit.principles.title}</p>
            <Principles center={toolkit.principles.center} items={toolkit.principles.items} />
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Четыре принципа по кругу вокруг стеклянной фигуры. Рисунок дублирует список: текст принципов
 * доступен скринридеру обычным списком под фигурой, а сама фигура от него скрыта.
 */
function Principles({
  center,
  items,
}: {
  center: string;
  items: readonly [string, string, string, string];
}) {
  const [top, right, bottom, left] = items;
  return (
    <div className="principles">
      <svg
        className="principles__figure"
        viewBox="0 0 220 220"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="principles__ring" cx="110" cy="110" r="72" />
        <circle className="principles__node" cx="110" cy="38" r="3.4" />
        <circle className="principles__node" cx="182" cy="110" r="3.4" />
        <circle className="principles__node" cx="110" cy="182" r="3.4" />
        <circle className="principles__node" cx="38" cy="110" r="3.4" />
        <text
          className="principles__label principles__label--head"
          x="110"
          y="22"
          textAnchor="middle"
        >
          {top}
        </text>
        <text className="principles__label" x="214" y="113" textAnchor="end">
          {right}
        </text>
        <text
          className="principles__label principles__label--head"
          x="110"
          y="204"
          textAnchor="middle"
        >
          {bottom}
        </text>
        <text className="principles__label" x="6" y="113">
          {left}
        </text>
        <g>
          <path className="principles__gem-face" d="M110 66l34 20v40l-34 20-34-20V86z" />
          <path
            className="principles__gem-face"
            d="M110 66v80M76 86l34 20 34-20M76 126l34-20 34 20"
          />
          <circle className="principles__gem-core" cx="110" cy="106" r="15" />
        </g>
        <text
          className="principles__label principles__label--head"
          x="110"
          y="160"
          textAnchor="middle"
        >
          {center}
        </text>
      </svg>
      <ul className="visually-hidden">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
