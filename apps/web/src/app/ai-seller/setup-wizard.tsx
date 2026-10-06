'use client';
import { useRef, useState, type ReactNode } from 'react';
const steps = [
  ['Объект', 'Проверьте, какие данные будет использовать продавец.'],
  ['Инструкция', 'Опишите стиль общения и задачи. Сохраните инструкцию перед проверкой.'],
  ['Подключения', 'Настройте модель и выберите канал общения с гостями.'],
  ['Проверка', 'Задайте вопрос от лица гостя и проверьте ответ.'],
  ['Готовность', 'Проверьте сохранение и подключение выбранного канала.'],
] as const;
export function SetupWizard({ children }: { children: ReactNode[] }) {
  const [step, setStep] = useState(0);
  const current = steps[step] ?? steps[0];
  const heading = useRef<HTMLHeadingElement>(null);
  const go = (next: number) => {
    setStep(next);
    heading.current?.focus();
  };
  return (
    <div className="seller-wizard">
      <nav className="seller-wizard__steps" aria-label="Шаги настройки продавца">
        {steps.map(([label], i) => (
          <button
            key={label}
            type="button"
            aria-current={i === step ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      <header className="seller-wizard__heading">
        <span className="muted">
          Шаг {step + 1} из {steps.length}
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {current[0]}
        </h2>
        <p>{current[1]}</p>
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
          Назад
        </button>
        <span className="muted">Изменения сохраняются кнопками внутри шага.</span>
        {step < steps.length - 1 ? (
          <button type="button" className="btn" onClick={() => go(step + 1)}>
            Далее
          </button>
        ) : (
          <a className="btn" href="/ai-agents">
            Все агенты
          </a>
        )}
      </footer>
    </div>
  );
}
