'use client';
import { useRef, useState, type ReactNode } from 'react';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
const steps = [
  [msg('Инструкция'), msg('Опишите стиль общения и задачи. Сохраните инструкцию перед проверкой.')],
  [msg('Подключения'), msg('Настройте модель и выберите канал общения с гостями.')],
  [msg('Проверка'), msg('Задайте вопрос от лица гостя и проверьте ответ.')],
  [msg('Готовность'), msg('Проверьте сохранение и подключение выбранного канала.')],
] as const;
export function SetupWizard({ children }: { children: ReactNode[] }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const current = steps[step] ?? steps[0];
  const heading = useRef<HTMLHeadingElement>(null);
  const go = (next: number) => {
    setStep(next);
    heading.current?.focus();
  };
  return (
    <div className="seller-wizard">
      <nav className="seller-wizard__steps" aria-label={t('Шаги настройки продавца')}>
        {steps.map(([label], i) => (
          <button
            key={label}
            type="button"
            aria-current={i === step ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <span>{i + 1}</span>
            {t(label)}
          </button>
        ))}
      </nav>
      <header className="seller-wizard__heading">
        <span className="muted">
          {t('Шаг {n} из {total}', { n: step + 1, total: steps.length })}
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {t(current[0])}
        </h2>
        <p>{t(current[1])}</p>
      </header>
      {children.map((child, i) => (
        <div key={i} hidden={i !== step} className="seller-wizard__body">
          {child}
        </div>
      ))}
      <footer className="seller-wizard__footer">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          {t('Назад')}
        </button>
        <span className="muted">{t('Сохраните изменения перед следующим шагом.')}</span>
        {step < steps.length - 1 ? (
          <button type="button" className="btn" onClick={() => go(step + 1)}>
            {t('Далее')}
          </button>
        ) : (
          <a className="btn" href="/ai-agents">
            {t('Все агенты')}
          </a>
        )}
      </footer>
    </div>
  );
}
