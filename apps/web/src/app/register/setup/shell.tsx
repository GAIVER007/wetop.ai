'use client';
import { landingForVertical } from '../../../lib/vertical-landing';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { onboardingFlow } from '@pms/domain';
import { Alert, Button, Field, Input } from '../../../components/ui';
import { OnboardingForm, type Row } from '../../onboarding/onboarding-form';
import type { SharedOnboardingState, OnboardingStatus } from '../../../lib/api';
import { BeautyChecklist } from './beauty-checklist';
import type { BookingPreview } from './setup-path';
import { progressRequest, recoveryDecision, sameProgressScope, type Command, type ProgressReply } from './command';

export function OnboardingShell(props: {
  initial: SharedOnboardingState;
  hotel: OnboardingStatus | null;
  preview?: BookingPreview | null;
}) {
  return props.initial.vertical === 'BEAUTY' ? (
    <BeautyChecklist initial={props.initial} preview={props.preview ?? null} />
  ) : (
    <LegacyOnboardingShell initial={props.initial} hotel={props.hotel} />
  );
}

function LegacyOnboardingShell({
  initial,
  hotel,
}: {
  initial: SharedOnboardingState;
  hotel: OnboardingStatus | null;
}) {
  const router = useRouter();
  const edited = useRef(false);
  const active = useRef(true);
  const busy = useRef(false);
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<{ before: SharedOnboardingState; command: Command } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const flow = onboardingFlow(state.vertical);
  const index = flow.steps.findIndex((step) => step.id === state.currentStep);
  const accept = (reply: ProgressReply, preserveDraft = false) => {
    if (!active.current) return;
    if (reply.status === 401 && reply.loginUrl) { window.location.assign(reply.loginUrl); return; }
    if (reply.status >= 400 || !reply.state) {
      setError(reply.error || 'Не удалось проверить настройку. Данные остались в форме.');
      if (reply.status === 409) setConflict(true);
      return;
    }
    if (!sameProgressScope(initial, reply.state)) {
      setError('Контекст настройки изменился. Данные остались в форме. Откройте нужный филиал заново.');
      setConflict(true);
      return;
    }
    if (reply.state.vertical !== 'HOSPITALITY' && reply.state.completedAt) {
      router.replace(landingForVertical(reply.state.vertical)); return;
    }
    setState(reply.state);
    if (!preserveDraft) setDraft(reply.state.draft);
    setFailed(null); setConflict(false); setReloadFailed(false); setError(null);
    setNotice(preserveDraft ? 'Сохранён предыдущий запрос. В форме есть новые изменения.' : 'Сохранено');
  };
  useEffect(() => {
    active.current = true;
    void progressRequest().then((reply) => {
      if (!active.current || edited.current) return;
      if (reply.status >= 400 || !reply.state) setReloadFailed(true);
      accept(reply);
    });
    return () => { active.current = false; };
    // The server keys this shell by business/location; never cross-adopt another scope.
  }, [initial]);
  const save = (action: Command['action']) => {
    if (!state.canEdit || busy.current || conflict) return;
    edited.current = true; busy.current = true;
    setError(null); setNotice('');
    const command: Command = { action, draft: structuredClone(draft), updatedAt: state.updatedAt };
    start(async () => {
      try {
        if (failed) {
          const latest = await progressRequest();
          if (!active.current) return;
          if (latest.status >= 400 || !latest.state) { accept(latest); return; }
          // Readback ALWAYS concerns the frozen failed intent, never today's edited draft/action.
          const decision = recoveryDecision(failed.before, latest.state, failed.command);
          if (decision === 'committed') {
            accept(latest, JSON.stringify(draft) !== JSON.stringify(failed.command.draft)); return;
          }
          if (decision === 'conflict') {
            accept({ status: 409, error: 'Настройка изменена. Введённые данные остались в форме. Загрузите сохранённую версию.' }); return;
          }
        }
        const reply = await progressRequest(command);
        if (!active.current) return;
        setFailed(reply.status >= 500 ? { before: state, command } : null);
        accept(reply);
      } finally { busy.current = false; }
    });
  };
  const loadSaved = () => {
    if (busy.current) return;
    edited.current = true; busy.current = true;
    start(async () => {
      try { accept(await progressRequest()); } finally { busy.current = false; }
    });
  };
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
          {reloadFailed && <Button disabled={pending} onClick={loadSaved}>Повторить загрузку</Button>}
          {failed && !conflict && state.canEdit && <Button disabled={pending} onClick={() => save(failed.command.action)}>Повторить</Button>}
          {conflict && <Button disabled={pending} onClick={loadSaved}>Загрузить сохранённую версию</Button>}
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
