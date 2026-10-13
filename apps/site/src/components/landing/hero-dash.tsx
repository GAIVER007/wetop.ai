'use client';

import { useState } from 'react';
import type { Dictionary } from '../../i18n/types';
import { Icon } from '../icon';
import Image from 'next/image';
import styles from './hero-preview.module.css';

type Dash = Dictionary['hero']['dash'];

const PREVIEWS = {
  HOSPITALITY: '/design-only/hospitality.svg',
  BEAUTY: '/design-only/beauty.svg',
  FOOD_SERVICE: '/design-only/restaurant.svg',
} as const;

/*
 * Иллюстрации рабочих экранов на вымышленных данных. Существующий переключатель
 * выбирает шахматку, расписание мастеров или план зала. Общий DashMock не меняется.
 */
export function HeroDash({ dash }: { dash: Dash }) {
  const [active, setActive] = useState(0);
  const view = dash.views[active] ?? dash.views[0];
  if (!view) return null;
  return (
    <>
      <div className="dash-switch" role="group" aria-label={dash.switchLabel}>
        {dash.views.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="dash-switch__button"
            aria-pressed={index === active}
            onClick={() => setActive(index)}
          >
            {item.tab}
          </button>
        ))}
      </div>
      <div aria-live="polite" className={styles.preview}>
        <Image
          className={styles.image}
          src={PREVIEWS[view.id]}
          alt={`${view.tab}. ${dash.label}`}
          width={720}
          height={540}
          loading="eager"
          unoptimized
        />
      </div>
      {view.toasts.map((toast, i) => (
        <div className={`dash-toast dash-toast--${i + 1}`} key={`${view.id}-${toast.title}`} aria-hidden="true">
          <span className="icon-tile icon-tile--sm">
            <Icon name={toast.icon} size={16} />
          </span>
          <span>
            <strong>{toast.title}</strong>
            <span>{toast.text}</span>
          </span>
        </div>
      ))}
    </>
  );
}
