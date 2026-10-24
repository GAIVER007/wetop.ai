'use client';
import { useState } from 'react';
import { ChatStep } from './chat-step';
import { GenerationStep } from './generation-step';
import type { WizardState } from '../../lib/wizard-types';
import { S } from './strings';
import { Textarea } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';

/** Сборка, необязательный опрос и тест по актуальной инструкции и знаниям. */
export function BuildStep({
  onMessage,
  onAnswers,
  onClaim,
  claimDisabled,
  generationState,
  generationPolling,
  busy,
  onGenerate,
  onRefresh,
  onEdit,
}: {
  onMessage: (text: string, requestId: string, challenge: string) => Promise<boolean>;
  onAnswers: (answers: Record<string, string>) => void;
  onClaim: () => void;
  claimDisabled: boolean;
  generationState: Pick<
    WizardState,
    'generation' | 'generated' | 'generationsUsed' | 'generateSiteKey' | 'chat' | 'chatSiteKey'
  >;
  generationPolling: boolean;
  busy: boolean;
  onGenerate: (token: string) => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const question = S.survey[index];
  const finish = (final: Record<string, string>) => {
    const filled = Object.fromEntries(Object.entries(final).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(filled).length) onAnswers(filled);
    setDone(true);
  };
  const next = () => {
    if (index + 1 >= S.survey.length) finish(answers);
    else setIndex(index + 1);
  };
  return (
    <>
      <GenerationStep
        state={generationState}
        polling={generationPolling}
        busy={busy}
        onGenerate={onGenerate}
        onRefresh={onRefresh}
        onEdit={onEdit}
      />
      {generationState.generated &&
        generationState.chat?.enabled &&
        generationState.chatSiteKey && (
          <ChatStep
            state={generationState.chat}
            siteKey={generationState.chatSiteKey}
            busy={busy}
            onMessage={onMessage}
            onRefresh={onRefresh}
          />
        )}
      <span className="guest-wizard__eyebrow">{t(S.build.eyebrow)}</span>
      <h2>{t(done ? S.build.thanks : S.build.title)}</h2>
      {!done && question ? (
        <section aria-label={t('Опрос')} className="guest-wizard__survey">
          <p>
            {t(S.build.lead)} ({index + 1}/{S.survey.length})
          </p>
          <fieldset>
            <legend>{t(question.title)}</legend>
            {question.kind === 'text' ? (
              <Textarea
                aria-label={t(question.title)}
                rows={3}
                maxLength={1000}
                value={answers[question.key] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [question.key]: e.target.value })}
              />
            ) : (
              <div className="guest-wizard__chips" role="radiogroup" aria-label={t(question.title)}>
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={answers[question.key] === option}
                    onClick={() => setAnswers({ ...answers, [question.key]: option })}
                  >
                    {t(option)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
          <div className="guest-wizard__actions">
            <button type="button" className="btn btn--secondary" onClick={() => finish({})}>
              {t(S.build.skip)}
            </button>
            <button type="button" className="btn" onClick={next}>
              {t(index + 1 >= S.survey.length ? S.build.done : S.build.next)}
            </button>
          </div>
        </section>
      ) : (
        <section aria-label={t('Тест бота')}>
          {!generationState.generateSiteKey && <p>{t(S.build.soonText)}</p>}
          {!generationState.chat?.enabled && (
            <div className="guest-wizard__actions">
              <button type="button" className="btn" disabled aria-describedby="test-soon">
                {t(S.build.testBtn)}
              </button>
              <span id="test-soon" className="guest-wizard__note">
                {t(S.build.testSoon)}
              </span>
            </div>
          )}
          <div className="guest-wizard__actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={claimDisabled}
              onClick={onClaim}
            >
              {t(S.build.claim)}
            </button>
            <a href="/login" target="_blank" rel="noopener noreferrer">
              {t(S.build.login)}
            </a>
          </div>
          <p className="guest-wizard__note">
            {t(generationState.generated ? S.generation.handoff : S.build.claimNote)}
          </p>
        </section>
      )}
    </>
  );
}
