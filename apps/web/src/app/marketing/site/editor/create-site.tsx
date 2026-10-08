'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PATCH_INSTRUCTION_MAX } from '@pms/domain';
import { Alert, Button, Field, Input, cx } from '../../../../components/ui';
import { createSiteAction } from './actions';
import { runErrorText, useGenerationRun } from './run';

/**
 * Окно «Какой сайт сделать?» (MKT9, слово владельца 07.10: одно понятное окно, как у конструкторов): человек пишет
 * словами, какой сайт нужен, и жмёт «Создать сайт». Нет сайта: он заводится с адресом из названия филиала (адрес
 * видно и можно поменять, занятый молча не меняется); затем первая версия ИИ существующим потоком MKT6, текст
 * человека уходит пожеланием. Факты (название, адрес, номера, контакты) ИИ берёт только из данных филиала.
 */
type Phase = 'idle' | 'creating' | 'running' | 'done' | 'failed';

export function CreateSite({
  hasSite,
  name,
  suggestedSlug,
  briefHash,
  readOnly,
}: {
  hasSite: boolean;
  name: string;
  suggestedSlug: string;
  briefHash: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [slug, setSlug] = useState(suggestedSlug);
  const [siteMade, setSiteMade] = useState(hasSite);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const job = useGenerationRun((run) => {
    if (run.status === 'SUCCEEDED') {
      setPhase('done');
      router.refresh();
    } else {
      setPhase('failed');
      setError(runErrorText(run));
    }
  });
  const busy = phase === 'creating' || phase === 'running' || phase === 'done';
  const blocked = readOnly ? 'Только чтение' : !briefHash ? 'Данные филиала сейчас недоступны: обновите страницу позже' : null;

  const start = async () => {
    if (blocked || busy) return;
    setError(null);
    setSlugError(null);
    setPhase('creating');
    const reply = await createSiteAction({ createSite: !siteMade, name, slug, briefHash: briefHash!, instruction: text });
    if (reply.siteCreated) setSiteMade(true);
    if (!reply.ok) {
      setPhase('failed');
      if (reply.field === 'slug') setSlugError(reply.message);
      else setError(reply.message);
      return;
    }
    setPhase('running');
    job.start(reply.run);
  };

  const steps: Array<[string, boolean, boolean]> = [
    ['Сайт заведён', siteMade, phase === 'creating' && !siteMade],
    ['Собираем данные гостиницы', phase === 'running' || phase === 'done', phase === 'creating' && siteMade],
    ['ИИ пишет сайт', phase === 'done', phase === 'running'],
    ['Открываем редактор', false, phase === 'done'],
  ];

  return (
    <section className="create-site" aria-labelledby="create-site-title" data-testid="create-site">
      <h2 id="create-site-title" className="create-site__title">
        Какой сайт сделать?
      </h2>
      <p className="create-site__lead">
        Опишите словами. ИИ соберёт сайт из данных гостиницы: номера, адрес, контакты. Цены и контакты он не придумывает, а
        готовый сайт можно поправить в редакторе.
      </p>
      <form
        className={cx('create-site__box', busy && 'is-busy')}
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <label htmlFor="create-site-text" className="sr-only">
          Опишите сайт
        </label>
        <textarea
          id="create-site-text"
          ref={box}
          rows={4}
          maxLength={PATCH_INSTRUCTION_MAX}
          className="inp create-site__text"
          placeholder="Например: спокойный сайт для хостела у вокзала, акцент на чистоту и тишину, дружелюбный тон"
          value={text}
          disabled={busy || readOnly}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void start();
            }
          }}
        />
        <div className="create-site__bar">
          <span className="muted">Можно оставить пустым: сайт соберётся из данных гостиницы.</span>
          <Button type="submit" disabled={!!blocked || busy} data-testid="create-site-start">
            {busy ? 'Создаём…' : 'Создать сайт'}
          </Button>
        </div>
      </form>
      {!siteMade && (
        <Field
          label="Адрес сайта"
          controlId="create-site-slug"
          className="create-site__slug"
          hint="Латинские буквы, цифры и дефис; станет адресом сайта при публикации"
          error={slugError}
        >
          <Input value={slug} disabled={busy || readOnly} onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())} />
        </Field>
      )}
      {blocked && <p className="muted">{blocked}</p>}
      {error && (
        <Alert boxed data-testid="create-site-error">
          {error}
        </Alert>
      )}
      {phase !== 'idle' && phase !== 'failed' && (
        <ol className="create-site__steps" aria-live="polite" data-testid="create-site-steps">
          {steps.map(([label, done, active]) => (
            <li key={label} className={cx('create-site__step', done && 'is-done', active && 'is-active')}>
              {label}
              {done ? ': готово' : active ? ': идёт' : ''}
            </li>
          ))}
        </ol>
      )}
      {job.lost && <Alert boxed>{job.lost}</Alert>}
    </section>
  );
}
