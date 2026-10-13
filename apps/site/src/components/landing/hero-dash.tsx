'use client';

import { useState } from 'react';
import type { Dictionary } from '../../i18n/types';
import { Icon } from '../icon';
import { DashMock } from './dash-mock';

type Dash = Dictionary['hero']['dash'];

/*
 * Мокап экрана «Сегодня» на первом экране (пометка владельца 13.10.2026: показать, что система не только
 * для отелей). Переключатель над мокапом меняет показатели, список дня и график на гостиницу, салон
 * или ресторан. Переключатель стоит вне `.dash`: внутри мокапа кнопок нет, он не имитирует интерфейс.
 * Все данные вымышленные, подпись примера под мокапом.
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
      <div aria-live="polite">
        <DashMock dash={dash} view={view} />
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
