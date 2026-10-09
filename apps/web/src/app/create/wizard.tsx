'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BuildStep } from './build-step';
import { guessRegional } from './regional';
import {
  PROGRESS,
  PROGRESS_INDEX,
  S,
  SCENARIOS,
  SITE_SCAN_READY,
  SOON_WORD,
  STEP_NAME,
  type BotType,
} from './strings';
import { useGuestDraft } from './use-guest-draft';
import { WizardFields } from './wizard-fields';

/** «hostel.kz» без схемы принимаем как https://hostel.kz; всё, что не похоже на адрес, вернём как есть для отказа */
function normalizeUrl(raw: string): string {
  const text = raw.trim();
  if (!text || /^https?:\/\//i.test(text)) return text;
  return /^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(text) ? `https://${text}` : text;
}

export function GuestWizard() {
  const {
    values,
    setValues,
    step,
    resumed,
    setResumed,
    track,
    sendSurvey,
    ready,
    busy,
    error,
    expired,
    saved,
    setSaved,
    dirty,
    open,
    save,
    restart,
    claim,
  } = useGuestDraft();
  const [urlError, setUrlError] = useState('');
  // пока O3 не дал поддержке свой промпт, сценарий один: что бы ни лежало в черновике, это продавец
  const botType: BotType = 'sales';
  const scenario = SCENARIOS.find((item) => item.value === botType);
  const canContinue = values.businessName.trim() !== '' && values.niche.trim() !== '';

  const proceed = (withSite: boolean) => {
    const url = withSite ? normalizeUrl(values.siteUrl) : '';
    if (url && !/^https?:\/\/\S+$/i.test(url)) {
      setUrlError(S.source.urlBad);
      return;
    }
    setUrlError('');
    if (url) void track('source_submitted');
    const regional = url ? guessRegional(url, undefined) : null;
    void save('review', { siteUrl: url, ...(regional ?? {}) });
  };
  const edit = (key: keyof typeof values, value: string) => {
    setValues((v) => {
      // правка найденного по сайту поля снимает пометку «найдено на сайте»: теперь это слова человека
      const found = v.foundFields
        .split(',')
        .filter((name) => name && name !== key)
        .join(',');
      return { ...v, [key]: value, foundFields: found };
    });
    setSaved('');
  };

  return (
    <main className="guest-wizard">
      <header className="guest-wizard__header">
        <Link href="/" className="guest-wizard__brand">
          WETOP<span>.AI</span>
        </Link>
      </header>
      <ol className="guest-wizard__progress" aria-label="Этапы создания">
        {PROGRESS.map((name, i) => (
          <li
            key={name}
            aria-current={PROGRESS_INDEX[step] === i ? 'step' : undefined}
            data-done={PROGRESS_INDEX[step] > i ? 'true' : undefined}
          >
            <span>{i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <div className="guest-wizard__layout">
        <section className="guest-wizard__card" aria-busy={busy}>
          {error && (
            <div role="alert" className="guest-wizard__error">
              {error}
            </div>
          )}
          {ready && resumed && step !== 'source' && (
            <div role="status" className="guest-wizard__resume">
              <span>{S.resume(STEP_NAME[step])}</span>
              <button type="button" className="btn btn--secondary" onClick={() => setResumed(false)}>
                {S.resumeClose}
              </button>
            </div>
          )}
          {!ready ? (
            <>
              <h1>{S.source.title('sales')}</h1>
              {busy ? (
                <p>Открываем черновик…</p>
              ) : (
                <div className="guest-wizard__actions">
                  <button className="btn" onClick={() => void open()}>
                    Повторить подключение
                  </button>
                  {expired && (
                    <button className="btn btn--secondary" onClick={restart}>
                      Начать новый черновик
                    </button>
                  )}
                </div>
              )}
            </>
          ) : step === 'source' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                proceed(true);
              }}
            >
              <span className="guest-wizard__eyebrow">{S.source.eyebrow}</span>
              <h1>{S.source.title(botType)}</h1>
              <p>{S.source.lead}</p>
              <fieldset className="guest-wizard__scenario">
                <legend>{S.source.scenario}</legend>
                <div className="guest-wizard__chips" role="radiogroup" aria-label={S.source.scenario}>
                  {SCENARIOS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={botType === item.value}
                      disabled={item.soon === true}
                      onClick={() => edit('botType', item.value)}
                    >
                      {item.label}
                      {item.soon ? ` (${SOON_WORD})` : ''}
                    </button>
                  ))}
                </div>
                <p className="guest-wizard__note">{scenario?.hint}</p>
                <p className="guest-wizard__note">{SCENARIOS.find((item) => item.soon)?.hint}</p>
              </fieldset>
              <label className="guest-wizard__url">
                <span>{S.source.url}</span>
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={values.siteUrl}
                  maxLength={500}
                  placeholder={S.source.urlPlaceholder}
                  aria-invalid={urlError ? 'true' : undefined}
                  aria-describedby={urlError ? 'site-url-error' : undefined}
                  onChange={(e) => {
                    setUrlError('');
                    edit('siteUrl', e.target.value);
                  }}
                />
              </label>
              {urlError && (
                <p id="site-url-error" role="alert" className="guest-wizard__field-error">
                  {urlError}
                </p>
              )}
              <div className="guest-wizard__actions guest-wizard__actions--stack">
                <button
                  className="btn"
                  type="submit"
                  disabled={busy || values.siteUrl.trim() === ''}
                >
                  {S.source.cta(botType)}
                </button>
                <button
                  type="button"
                  className="guest-wizard__link"
                  disabled={busy}
                  onClick={() => proceed(false)}
                >
                  {S.source.manual}
                </button>
              </div>
              {SITE_SCAN_READY ? (
                <p className="guest-wizard__note">
                  {S.source.consent}{' '}
                  <a href="https://wetop.ai/privacy/" target="_blank" rel="noopener noreferrer">
                    {S.source.policy}
                  </a>
                  .
                </p>
              ) : (
                values.siteUrl.trim() !== '' && (
                  <p className="guest-wizard__note">{S.source.scanSoon}</p>
                )
              )}
            </form>
          ) : step === 'review' ? (
            <>
              <span className="guest-wizard__eyebrow">{S.review.eyebrow}</span>
              <h1>{S.review.title}</h1>
              <p>{S.review.lead}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canContinue) void save('generating');
                }}
              >
                <WizardFields values={values} onChange={edit} />
                {!canContinue && <p className="guest-wizard__note">{S.review.need}</p>}
                <div className="guest-wizard__actions guest-wizard__actions--sticky">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={busy}
                    onClick={() => void save('source')}
                  >
                    {S.review.back}
                  </button>
                  <button className="btn" type="submit" disabled={busy || !canContinue}>
                    {S.review.next}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <BuildStep
              onAnswers={(answers) => void sendSurvey(answers)}
              onClaim={() => void claim()}
              claimDisabled={busy || dirty}
            />
          )}
          <p role="status" className="guest-wizard__save-state">
            {busy ? S.saving : dirty ? S.unsaved : saved}
          </p>
        </section>
        <aside className="guest-wizard__preview" aria-label="Превью агента">
          <span className="guest-wizard__eyebrow">{S.preview.title}</span>
          <div className="guest-wizard__avatar" aria-hidden="true">
            AI
          </div>
          <h2>{values.assistantName || S.preview.helper}</h2>
          <p>{values.businessName || S.preview.company}</p>
          <dl>
            <div>
              <dt>{S.preview.scenario}</dt>
              <dd>{scenario?.label}</dd>
            </div>
            {values.niche && (
              <div>
                <dt>{S.preview.niche}</dt>
                <dd>{values.niche}</dd>
              </div>
            )}
            <div>
              <dt>{S.preview.goal}</dt>
              <dd>{values.goal || S.preview.goalEmpty}</dd>
            </div>
            <div>
              <dt>Валюта</dt>
              <dd>{values.currency}</dd>
            </div>
            <div>
              <dt>Часовой пояс</dt>
              <dd>{values.timezone}</dd>
            </div>
          </dl>
          {values.advantages && <p className="guest-wizard__advantages">{values.advantages}</p>}
          <p className="guest-wizard__note">{S.preview.note}</p>
        </aside>
      </div>
      {ready && step !== 'source' && (
        <button
          type="button"
          className="btn btn--secondary guest-wizard__home"
          disabled={busy}
          onClick={() => void save('source')}
        >
          {S.home}
        </button>
      )}
    </main>
  );
}
