'use client';
import { useRouter } from 'next/navigation';
import { landingForVertical } from '../../../lib/vertical-landing';
import { useEffect, useRef, useState, useTransition } from 'react';
import { onboardingFlow } from '@pms/domain';
import { Alert, Button, Field, Input } from '../../../components/ui';
import { OnboardingForm, type Row } from '../../onboarding/onboarding-form';
import type { SharedOnboardingState, OnboardingStatus } from '../../../lib/api';
import { committedCommand, progressRequest, type Command, type ProgressReply } from './command';

export function OnboardingShell({
  initial,
  hotel,
}: {
  initial: SharedOnboardingState;
  hotel: OnboardingStatus | null;
}) {
  const router = useRouter();
  const edited = useRef(false);
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<Command | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const flow = onboardingFlow(state.vertical);
  const index = flow.steps.findIndex((step) => step.id === state.currentStep);
  const accept = (reply: ProgressReply) => {
    if (reply.status === 401 && reply.loginUrl) {
      window.location.assign(reply.loginUrl);
      return;
    }
    if (!reply.state || reply.status >= 400) {
      setError(reply.error || 'Не удалось сохранить. Повторите после восстановления связи.');
      setConflict(reply.status === 409);
      return;
    }
    if (reply.state.vertical !== 'HOSPITALITY' && reply.state.completedAt) {
      router.replace(landingForVertical(reply.state.vertical));
      return;
    }
    setState(reply.state);
    setDraft(reply.state.draft);
    setFailed(null);
    setConflict(false);
    setNotice('Сохранено');
    setReloadFailed(false);
  };
  useEffect(() => {
    // History may restore a cached server-rendered step. Read the guarded state without re-rendering the page.
    let active = true;
    void progressRequest().then((reply) => {
      if (!active || edited.current) return;
      if (reply.status === 401 && reply.loginUrl) {
        window.location.assign(reply.loginUrl);
        return;
      }
      if (!reply.state || reply.status >= 400) {
        setError(reply.error || 'Не удалось проверить сохранённую настройку. Повторите загрузку.');
        setReloadFailed(true);
        return;
      }
      if (reply.state.updatedAt !== initial.updatedAt) {
        setState(reply.state);
        setDraft(reply.state.draft);
      }
    });
    return () => {
      active = false;
    };
  }, [initial]);
  const save = (action: Command['action']) => {
    edited.current = true;
    setError(null);
    setNotice('');
    const command = { action, draft, updatedAt: state.updatedAt };
    start(async () => {
      if (failed) {
        const latest = await progressRequest();
        if (!latest.state || latest.status >= 400) {
          accept(latest);
          return;
        }
        if (committedCommand(state, latest.state, command)) {
          accept(latest);
          return;
        }
        if (latest.state.updatedAt !== state.updatedAt) {
          accept({
            status: 409,
            error:
              'Настройка изменена. Введённые данные остались в форме. Загрузите сохранённую версию перед новой записью.',
          });
          return;
        }
      }
      const reply = await progressRequest(command);
      setFailed(reply.status >= 500 ? command : null);
      accept(reply);
    });
  };
  const loadSaved = () =>
    start(async () => {
      edited.current = true;
      const latest = await progressRequest();
      accept(latest);
    });
  const field = (key: string, label: string, maxLength: number) => (
    <Field label={label}>
      <Input
        value={String(draft[key] ?? '')}
        maxLength={maxLength}
        disabled={!state.canEdit || pending}
        onChange={(e) => {
          edited.current = true;
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
                edited.current = true;
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
          {reloadFailed && (
            <Button disabled={pending} onClick={loadSaved}>
              Повторить загрузку
            </Button>
          )}
          {failed && !conflict && (
            <Button disabled={pending || conflict} onClick={() => save(failed.action)}>
              Повторить
            </Button>
          )}
          {conflict && (
            <Button disabled={pending} onClick={loadSaved}>
              Загрузить сохранённую версию
            </Button>
          )}
          <p role="status" aria-live="polite">
            {pending
              ? 'Сохраняем…'
              : notice || 'Нажмите «Сохранить», чтобы продолжить после перезагрузки.'}
          </p>
          {state.canEdit && (
            <div className="onboarding__actions">
              {index > 0 && (
                <Button tone="ghost" disabled={pending || conflict} onClick={() => save('back')}>
                  Назад
                </Button>
              )}
              <Button tone="ghost" disabled={pending || conflict} onClick={() => save('save')}>
                Сохранить
              </Button>
              {!hotel && (
                <Button
                  disabled={pending || conflict}
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
