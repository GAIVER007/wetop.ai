'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../icon';
import { typo } from '../typo';

export type FeatureGroup = {
  title: string;
  items: Array<{ icon: IconName; title: string; text: string; soon?: boolean }>;
};

/*
 * Вкладки «Возможностей» (пометка владельца 13.10.2026: «круче, чётко, понятно, удобно»): вместо стены
 * из 15 карточек три вкладки. Все панели есть в HTML (поиск и читалки видят весь текст), неактивные
 * скрыты атрибутом hidden. Клавиатура по шаблону WAI-ARIA Tabs: стрелки, Home, End.
 */
export function FeatureTabs({ groups }: { groups: FeatureGroup[]; soon: string }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const next = (index + groups.length) % groups.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: groups.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <div className="feature-tabs">
      <div className="feature-tabs__list" role="tablist" aria-label={groups.map((g) => g.title).join(', ')}>
        {groups.map((group, index) => (
          <button
            key={group.title}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${index}`}
            aria-controls={`${base}-panel-${index}`}
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            className="feature-tabs__tab"
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
          >
            {group.title}
            <span className="feature-tabs__count">{group.items.length}</span>
          </button>
        ))}
      </div>
      {groups.map((group, index) => (
        <div
          key={group.title}
          role="tabpanel"
          id={`${base}-panel-${index}`}
          aria-labelledby={`${base}-tab-${index}`}
          hidden={index !== active}
        >
          <ul className="card-grid card-grid--3 features__grid">
          {group.items.map((item) => (
            <li key={item.title} className="card card--compact glass">
              <span className="icon-tile icon-tile--sm">
                <Icon name={item.icon} size={20} />
              </span>
              <div className="card__body">
                <h3 className="card__title">
                  {typo(item.title)}
                </h3>
                <p className="card__text">{typo(item.text)}</p>
              </div>
            </li>
          ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
