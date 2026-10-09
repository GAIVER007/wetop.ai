'use client';
import { useState } from 'react';
import { S } from './strings';

/**
 * Шаг «Сборка»: опрос из трёх вопросов, пока (в следующих срезах) бот собирается. Каждый вопрос необязателен,
 * «Пропустить» закрывает опрос одним нажатием. Тест бота подключается срезом O4, поэтому кнопка пока неактивна.
 */
export function BuildStep({
  onAnswers,
  onClaim,
  claimDisabled,
}: {
  onAnswers: (answers: Record<string, string>) => void;
  onClaim: () => void;
  claimDisabled: boolean;
}) {
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
      <span className="guest-wizard__eyebrow">{S.build.eyebrow}</span>
      <h1>{done ? S.build.thanks : S.build.title}</h1>
      {!done && question ? (
        <section aria-label="Опрос" className="guest-wizard__survey">
          <p>
            {S.build.lead} ({index + 1}/{S.survey.length})
          </p>
          <fieldset>
            <legend>{question.title}</legend>
            {question.kind === 'text' ? (
              <textarea
                aria-label={question.title}
                rows={3}
                maxLength={1000}
                value={answers[question.key] ?? ''}
                onChange={(e) => setAnswers({ ...answers, [question.key]: e.target.value })}
              />
            ) : (
              <div className="guest-wizard__chips" role="radiogroup" aria-label={question.title}>
                {question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={answers[question.key] === option}
                    onClick={() => setAnswers({ ...answers, [question.key]: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
          <div className="guest-wizard__actions">
            <button type="button" className="btn btn--secondary" onClick={() => finish({})}>
              {S.build.skip}
            </button>
            <button type="button" className="btn" onClick={next}>
              {index + 1 >= S.survey.length ? S.build.done : S.build.next}
            </button>
          </div>
        </section>
      ) : (
        <section aria-label="Тест бота">
          <h2>{S.build.soonTitle}</h2>
          <p>{S.build.soonText}</p>
          <div className="guest-wizard__actions">
            <button type="button" className="btn" disabled aria-describedby="test-soon">
              {S.build.testBtn}
            </button>
            <span id="test-soon" className="guest-wizard__note">
              {S.build.testSoon}
            </span>
          </div>
          <div className="guest-wizard__actions">
            <button type="button" className="btn btn--secondary" disabled={claimDisabled} onClick={onClaim}>
              {S.build.claim}
            </button>
            <a href="/login" target="_blank" rel="noopener noreferrer">
              {S.build.login}
            </a>
          </div>
          <p className="guest-wizard__note">{S.build.claimNote}</p>
        </section>
      )}
    </>
  );
}
