'use client';
import { useState } from 'react';
import type { WizardState } from '../../lib/wizard-types';
import { ScanChallenge } from './scan-challenge';
import { S } from './strings';
import { useT } from '../../i18n/locale-provider';

export function GenerationStep({
  state,
  polling,
  busy,
  onGenerate,
  onRefresh,
  onEdit,
}: {
  state: Pick<
    WizardState,
    'generation' | 'generated' | 'generationsUsed' | 'generateSiteKey' | 'chat' | 'chatSiteKey'
  >;
  polling: boolean;
  busy: boolean;
  onGenerate: (token: string) => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const [challenge, setChallenge] = useState('');
  const [challengeKey, setChallengeKey] = useState(0);
  const phase = state.generation?.state;
  const waiting = polling || phase === 'queued' || phase === 'running';
  const used = state.generationsUsed ?? 0;
  const result = state.generated;
  return (
    <section aria-label={t(S.build.eyebrow)}>
      <h1>
        {t(
          result
            ? S.generation.ready
            : waiting
              ? phase === 'running'
                ? S.generation.running
                : S.generation.queued
              : S.generation.title,
        )}
      </h1>
      {result ? (
        <>
          <p>{t(S.generation.review)}</p>
          <details>
            <summary>{t(S.generation.instruction)}</summary>
            <p className="guest-wizard__generated-text">{result.prompt}</p>
          </details>
          <details>
            <summary>{t(S.generation.knowledge)}</summary>
            {result.knowledge.map((section, i) => (
              <section key={i}>
                <h3>{section.title}</h3>
                <p className="guest-wizard__generated-text">{section.content}</p>
              </section>
            ))}
          </details>
        </>
      ) : waiting ? (
        <div role="status">
          <p>{t(phase === 'running' ? S.generation.running : S.generation.queued)}</p>
          {!polling && (
            <button type="button" className="btn" onClick={onRefresh}>
              {t(S.generation.refresh)}
            </button>
          )}
        </div>
      ) : (
        <>
          {phase === 'failed' && (
            <p role="alert">{state.generation?.error ?? t(S.generation.failed)}</p>
          )}
          {phase === 'stale' && <p>{t(S.generation.stale)}</p>}
          {!state.generateSiteKey ? (
            <p>{t(S.generation.unavailable)}</p>
          ) : used >= 5 ? (
            <p>{t(S.generation.limit)}</p>
          ) : (
            <>
              <p>{t(S.generation.consent)}</p>
              <ScanChallenge
                key={challengeKey}
                siteKey={state.generateSiteKey}
                onToken={setChallenge}
              />
              <button
                type="button"
                className="btn"
                disabled={busy || !challenge}
                onClick={() => {
                  onGenerate(challenge);
                  setChallenge('');
                  setChallengeKey((key) => key + 1);
                }}
              >
                {t(phase === 'failed' ? S.generation.retry : S.generation.start)}
              </button>
            </>
          )}
        </>
      )}
      <p className="guest-wizard__note">{t(S.generation.count, { used })}</p>
      <div className="guest-wizard__actions">
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={onEdit}>
          {t(S.generation.edit)}
        </button>
      </div>
    </section>
  );
}
