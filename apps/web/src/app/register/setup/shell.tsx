'use client';
import { useState, useTransition } from 'react';
import { onboardingFlow } from '@pms/domain';
import { Alert, Button, Field, Input } from '../../../components/ui';
import { OnboardingForm, type Row } from '../../onboarding/onboarding-form';
import type { SharedOnboardingState, OnboardingStatus } from '../../../lib/api';
import { saveOnboarding } from './actions';

export function OnboardingShell({
  initial,
  hotel,
}: {
  initial: SharedOnboardingState;
  hotel: OnboardingStatus | null;
}) {
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();
  const flow = onboardingFlow(state.vertical);
  const index = flow.steps.findIndex((step) => step.id === state.currentStep);
  const save = (action: 'save' | 'next' | 'back' | 'complete') => {
    setError(null);
    setNotice('');
    start(async () => {
      const result = await saveOnboarding({ action, draft, updatedAt: state.updatedAt });
      if (result.error || !result.state) {
        setError(result.error);
        return;
      }
      setState(result.state);
      setDraft(result.state.draft);
      setNotice('Сохранено');
    });
  };
  const field = (key: string, label: string, maxLength: number) => (
    <Field label={label}>
      <Input
        value={String(draft[key] ?? '')}
        maxLength={maxLength}
        disabled={!state.canEdit || pending}
        onChange={(e) => {
          setDraft({ ...draft, [key]: e.target.value });
          setNotice('Есть несохранённые изменения');
        }}
      />
    </Field>
  );
  return (
    <main id="main-content" className="onboarding setup-shell">
      <header className="onboarding__head">
        <p>Настройка рабочего пространства</p>
        <h1>
          {state.completedAt
            ? 'Настройка сохранена'
            : flow.vertical === 'HOSPITALITY'
              ? 'Настройте отель'
              : flow.vertical === 'BEAUTY'
                ? 'Настройте Beauty'
                : 'Настройте Food Service'}
        </h1>
        <ol className="onboarding__steps" aria-label="Прогресс настройки">
          {flow.steps.map((step, i) => (
            <li
              key={step.id}
              aria-current={!state.completedAt && i === index ? 'step' : undefined}
              className={state.completedAt || i < index ? 'is-done' : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>
      </header>
      {state.completedAt ? (
        <section aria-label="Завершение">
          <p role="status">{flow.completion}</p>
          <a href="https://wetop.ai">На главную WETOP</a>
        </section>
      ) : (
        <>
          {!state.canEdit && (
            <p role="status">
              Настройку выполняет владелец или управляющий. Сохранённые данные доступны для
              просмотра.
            </p>
          )}
          {hotel ? (
            <OnboardingForm
              hotelName={hotel.name}
              currency={hotel.currency}
              embedded
              initialRows={Array.isArray(draft.rows) ? (draft.rows as Row[]) : []}
              onRowsChange={(rows) => {
                setDraft({ rows });
                setNotice('Есть несохранённые изменения');
              }}
              readOnly={!state.canEdit || pending}
            />
          ) : (
            <section className="onboarding__section" aria-label={flow.steps[index]!.label}>
              <h2>{flow.steps[index]!.label}</h2>
              {state.currentStep === 'business' && field('businessName', 'Название бизнеса', 200)}
              {state.currentStep === 'location' && (
                <div className="setup-fields">
                  {field('locationName', 'Название филиала', 200)}
                  {field('timezone', 'Часовой пояс IANA', 50)}
                  {field('currency', 'Валюта', 3)}
                </div>
              )}
              {state.currentStep === 'review' && (
                <dl>
                  {(
                    [
                      ['businessName', 'Бизнес'],
                      ['locationName', 'Филиал'],
                      ['timezone', 'Часовой пояс'],
                      ['currency', 'Валюта'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{String(draft[key] ?? '')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}
          {error && <Alert boxed>{error}</Alert>}
          <p role="status" aria-live="polite">
            {pending
              ? 'Сохраняем…'
              : notice || 'Нажмите «Сохранить», чтобы продолжить после перезагрузки.'}
          </p>
          {state.canEdit && (
            <div className="onboarding__actions">
              {index > 0 && (
                <Button tone="ghost" disabled={pending} onClick={() => save('back')}>
                  Назад
                </Button>
              )}
              <Button tone="ghost" disabled={pending} onClick={() => save('save')}>
                Сохранить
              </Button>
              {!hotel && (
                <Button
                  disabled={pending}
                  onClick={() => save(index === flow.steps.length - 1 ? 'complete' : 'next')}
                >
                  {index === flow.steps.length - 1 ? 'Завершить настройку' : 'Продолжить'}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
