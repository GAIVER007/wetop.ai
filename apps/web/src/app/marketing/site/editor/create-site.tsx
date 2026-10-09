'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PATCH_INSTRUCTION_MAX } from '@pms/domain';
import type { DesignDirectionView } from '../../../../lib/api';
import { Alert, Button, cx } from '../../../../components/ui';
import { createSiteAction, designFirstAction } from './actions';
import { BuildProgress, DesignCards, errorText } from './ai-chat';
import { runErrorText, useAssistantRun, useGenerationRun } from './run';

/**
 * Первый экран конструктора (MKT9.2): проект это филиал, поэтому ни названия, ни адреса сайта не спрашиваем. Человек
 * пишет, каким должен быть сайт, и жмёт «Создать сайт» или сначала смотрит три варианта оформления. Сайт заводится
 * пустым запросом (имя и адрес из филиала), факты ИИ берёт только из данных филиала; список «WETOP уже знает» это
 * то, что уже найдено, без выдумок.
 */
type Phase = 'idle' | 'starting' | 'building' | 'designing' | 'choosing' | 'done';

export function CreateSite({
  locationName,
  briefHash,
  facts,
  readOnly,
}: {
  locationName: string;
  briefHash: string | null;
  facts: string[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [directions, setDirections] = useState<{ runId: string; items: DesignDirectionView[] } | null>(null);
  const job = useGenerationRun((run) => {
    if (run.status === 'SUCCEEDED') {
      setPhase('done');
      router.refresh();
    } else {
      setPhase(directions ? 'choosing' : 'idle');
      setError(runErrorText(run));
    }
  });
  const design = useAssistantRun((run) => {
    if (run.status === 'SUCCEEDED' && run.payload?.kind === 'DESIGN') {
      setDirections({ runId: run.id, items: run.payload.directions });
      setPhase('choosing');
    } else {
      setPhase('idle');
      setError(errorText(run.errorCode));
    }
  });
  const busy = phase === 'starting' || phase === 'building' || phase === 'designing' || phase === 'done';
  const blocked = readOnly ? 'Только чтение' : !briefHash ? 'Данные филиала сейчас недоступны: обновите страницу позже' : null;

  const build = async (chosen?: DesignDirectionView) => {
    if (blocked || busy) return;
    setError(null);
    setPhase('starting');
    const reply = await createSiteAction({
      briefHash: briefHash!,
      instruction: text,
      ...(chosen && directions ? { design: { runId: directions.runId, id: chosen.id } } : {}),
    });
    if (!reply.ok) {
      setPhase(directions ? 'choosing' : 'idle');
      setError(reply.message);
      return;
    }
    setStartedAt(Date.now());
    setPhase('building');
    job.start(reply.run);
  };
  const showDesigns = async () => {
    if (blocked || busy) return;
    setError(null);
    setPhase('designing');
    const reply = await designFirstAction(text);
    if (!reply.ok) {
      setPhase('idle');
      setError(reply.message);
      return;
    }
    design.start(reply.data.run);
  };

  return (
    <section className="create-site" aria-labelledby="create-site-title" data-testid="create-site">
      <h2 id="create-site-title" className="create-site__title">
        Сайт для {locationName}
      </h2>
      <form
        className={cx('create-site__box', busy && 'is-busy')}
        onSubmit={(e) => {
          e.preventDefault();
          void build();
        }}
      >
        <label htmlFor="create-site-text" className="create-site__label">
          Опишите, каким должен быть сайт
        </label>
        <textarea
          id="create-site-text"
          rows={4}
          maxLength={PATCH_INSTRUCTION_MAX}
          className="inp create-site__text"
          placeholder="Например: спокойный сайт, акцент на тишину и чистоту, дружелюбный тон"
          value={text}
          disabled={busy || readOnly}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void build();
            }
          }}
        />
        <div className="create-site__bar">
          <span className="muted">Можно оставить пустым: сайт соберётся из данных филиала.</span>
          <div className="ed-row">
            <Button type="button" tone="secondary" disabled={!!blocked || busy} onClick={() => void showDesigns()} data-testid="create-site-designs">
              Показать варианты оформления
            </Button>
            <Button type="submit" disabled={!!blocked || busy} data-testid="create-site-start">
              {phase === 'starting' || phase === 'building' ? 'Создаём…' : 'Создать сайт'}
            </Button>
          </div>
        </div>
      </form>
      {facts.length > 0 && (
        <div className="create-site__facts" data-testid="create-site-facts">
          <p className="muted">WETOP уже знает:</p>
          <ul>
            {facts.map((f) => (
              <li key={f}>
                <span aria-hidden="true">✓ </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {blocked && <p className="muted">{blocked}</p>}
      {error && (
        <Alert boxed data-testid="create-site-error">
          {error}
        </Alert>
      )}
      {phase === 'designing' && (
        <p role="status" className="muted" data-testid="create-site-designing">
          ИИ подбирает три варианта оформления
        </p>
      )}
      {phase === 'choosing' && directions && (
        <DesignCards directions={directions.items} actionLabel="Создать с этим оформлением" disabled={!!blocked} onChoose={(d) => void build(d)} />
      )}
      {(phase === 'building' || phase === 'done') && (
        <div role="status" aria-live="polite" data-testid="create-site-steps">
          <BuildProgress startedAt={startedAt} />
          {phase === 'done' && <p className="muted">Открываем редактор</p>}
        </div>
      )}
      {(job.lost || design.lost) && <Alert boxed>{job.lost ?? design.lost}</Alert>}
    </section>
  );
}
