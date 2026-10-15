'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PATCH_INSTRUCTION_MAX, designPresetDirection, designTripleCount, pickDesignTriple } from '@pms/domain';
import { Chip, ChipGroup } from '../../../../components/chip';
import { Alert, Button, Select, cx } from '../../../../components/ui';
import type { Loaded, SiteFacts, SiteLocation } from '../../../../lib/site-facts';
import { DICTATION_LANGS, appendDictated, useDictation, type DictationLang } from '../../../../lib/use-dictation';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { createSiteAction, designFirstAction, type SiteDesignChoice } from './actions';
import { BuildProgress, errorText } from './ai-chat';
import { DesignPicker, type DesignOption } from './design-picker';
import { LocationPicker } from './location-picker';
import { runErrorText, useAssistantRun, useGenerationRun } from './run';
import { SiteFactsCard } from './site-facts-card';
import { createErrorText, verticalPending } from './vertical-status';

/**
 * Первый экран «Сайт и SEO» (MKT9.2, SITE-1 по `plans/site-seo-flow-2026-10-15.md` §1 шаги 1–3), как у Lovable:
 * слева филиал и чат (поле, диктовка, подсказки-чипы), справа «Что WETOP знает о филиале», ниже три заметно разных
 * дизайна с живым мини-превью без ИИ и «Другие варианты». «Создать сайт» заводит сайт и ставит первую сборку с
 * выбранным дизайном; «Подобрать ИИ под мой запрос» просит у ИИ три направления под текст человека.
 *
 * Проект это филиал: ни названия, ни адреса сайта не спрашиваем. Решает сервер: экран не запрещает направление сам, а
 * отказ API по направлению переводит в понятные слова (`vertical-status.ts`).
 */
type Phase = 'idle' | 'starting' | 'building' | 'designing' | 'done';

export function CreateSite({
  vertical,
  locationName,
  locationId,
  briefHash,
  facts,
  locations,
  readOnly,
}: {
  vertical: WebVertical;
  locationName: string;
  locationId: string | null;
  briefHash: string | null;
  facts: Loaded<SiteFacts>;
  locations: Loaded<SiteLocation[]>;
  readOnly: boolean;
}) {
  const router = useRouter();
  const copy = verticalCopy(vertical);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [page, setPage] = useState(0);
  const [ai, setAi] = useState<DesignOption[] | null>(null);
  const [chosen, setChosen] = useState<string>(() => `preset:${pickDesignTriple(vertical, 0)[0]!.id}`);
  const [lang, setLang] = useState<DictationLang>('ru-RU');
  const dictation = useDictation({
    lang,
    onText: (phrase) => setText((previous) => appendDictated(previous, phrase, PATCH_INSTRUCTION_MAX)),
    onError: setError,
  });

  const presets: DesignOption[] = useMemo(
    () => pickDesignTriple(vertical, page).map((p) => ({ key: `preset:${p.id}`, direction: designPresetDirection(p), source: 'preset' as const })),
    [vertical, page],
  );
  const options = ai ?? presets;
  const choice = options.find((o) => o.key === chosen) ?? options[0]!;
  // превью рисуется из фактов; без них из имени филиала, без каталога
  const previewFacts: SiteFacts = useMemo(
    () =>
      facts.ok
        ? facts.data
        : {
            vertical,
            location: { id: locationId ?? '', name: locationName, address: null, phone: null, whatsapp: null, city: null },
            catalog: { kind: vertical === 'BEAUTY' ? 'services' : vertical === 'FOOD_SERVICE' ? 'menu' : 'rooms', items: [] },
            staff: [],
            hours: null,
            photosCount: 0,
            reviews: null,
            gaps: [],
          },
    [facts, vertical, locationId, locationName],
  );

  const job = useGenerationRun((run) => {
    if (run.status === 'SUCCEEDED') {
      setPhase('done');
      router.refresh();
    } else {
      setPhase('idle');
      setError(runErrorText(run));
    }
  });
  const design = useAssistantRun((run) => {
    if (run.status === 'SUCCEEDED' && run.payload?.kind === 'DESIGN') {
      const items = run.payload.directions.map((d) => ({ key: `ai:${run.id}:${d.id}`, direction: d, source: 'ai' as const }));
      setAi(items);
      setChosen(items[0]?.key ?? chosen);
      setPhase('idle');
    } else {
      setPhase('idle');
      setError(errorText(run.errorCode));
    }
  });
  const busy = pending || phase === 'starting' || phase === 'building' || phase === 'designing' || phase === 'done';

  const selected = (): SiteDesignChoice => {
    if (choice.source === 'preset') return { presetId: choice.direction.id };
    const [, runId] = choice.key.split(':');
    return { runId: runId!, id: choice.direction.id };
  };

  const build = async () => {
    if (readOnly || busy) return;
    dictation.stop();
    setError(null);
    setPhase('starting');
    setPending(true);
    try {
      const reply = await createSiteAction({ briefHash, instruction: text, design: selected() });
      if (!reply.ok) {
        setPhase('idle');
        setError(createErrorText(vertical, reply));
        return;
      }
      setStartedAt(Date.now());
      setPhase('building');
      job.start(reply.run);
    } finally {
      setPending(false);
    }
  };
  const aiDesigns = async () => {
    if (readOnly || busy) return;
    dictation.stop();
    setError(null);
    setPhase('designing');
    const reply = await designFirstAction(text);
    if (!reply.ok) {
      setPhase('idle');
      setError(verticalPending(vertical, reply) ? createErrorText(vertical, reply) : reply.message);
      return;
    }
    design.start(reply.data.run);
  };
  const more = () => {
    setAi(null);
    const next = (page + 1) % designTripleCount();
    setPage(next);
    setChosen(`preset:${pickDesignTriple(vertical, next)[0]!.id}`);
  };
  const toggleChip = (chip: string) => {
    setText((previous) => {
      if (previous.includes(chip)) return previous.replace(chip, '').replace(/\s*\.\s*\./g, '.').replace(/^[\s.]+|[\s.]+$/g, '').trim();
      const base = previous.trim();
      return `${base}${base && !/[.!?]$/.test(base) ? '. ' : base ? ' ' : ''}${chip}`.slice(0, PATCH_INSTRUCTION_MAX);
    });
  };

  return (
    <section className="site-start" aria-labelledby="create-site-title" data-testid="create-site">
      <header className="site-start__head">
        <h2 id="create-site-title" className="site-start__title">
          Сайт для {locationName}
        </h2>
        <p className="muted">Выберите филиал, расскажите, каким должен быть сайт, и выберите дизайн. Данные филиала WETOP подставит сам.</p>
      </header>

      <div className="site-start__grid">
        <LocationPicker locations={locations} currentId={locationId} />

        <form
          className={cx('site-chat', busy && 'is-busy')}
          aria-labelledby="site-chat-title"
          onSubmit={(e) => {
            e.preventDefault();
            void build();
          }}
        >
          <h3 id="site-chat-title" className="site-start__step">
            Каким должен быть сайт
          </h3>
          <label htmlFor="create-site-text" className="sr-only">
            Опишите, каким должен быть сайт
          </label>
          <textarea
            id="create-site-text"
            rows={5}
            maxLength={PATCH_INSTRUCTION_MAX}
            className="site-chat__text"
            placeholder="Например: спокойный сайт, акцент на тишину и чистоту, дружелюбный тон"
            value={text}
            disabled={busy || readOnly}
            aria-describedby="site-chat-hint"
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void build();
              }
            }}
          />
          <ChipGroup label="Подсказки" className="site-chat__chips">
            {copy.siteChips.map((chip) => (
              <Chip key={chip} selected={text.includes(chip)} disabled={busy || readOnly} onClick={() => toggleChip(chip)} data-testid="site-chip">
                {chip}
              </Chip>
            ))}
          </ChipGroup>
          <div className="site-chat__bar">
            {dictation.supported && (
              <div className="site-chat__voice" data-testid="site-voice">
                <Button
                  type="button"
                  tone="secondary"
                  aria-pressed={dictation.listening}
                  disabled={busy || readOnly}
                  onClick={() => {
                    if (!dictation.listening) setError(null);
                    dictation.toggle();
                  }}
                  data-testid="site-mic"
                >
                  {dictation.listening ? 'Остановить диктовку' : 'Надиктовать'}
                </Button>
                <label className="sr-only" htmlFor="site-dictation-lang">
                  Язык диктовки
                </label>
                <Select id="site-dictation-lang" value={lang} disabled={dictation.listening || busy} onChange={(e) => setLang(e.currentTarget.value as DictationLang)} className="site-chat__lang">
                  {DICTATION_LANGS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
                <span className="muted" aria-live="polite">
                  {dictation.listening ? 'Слушаю…' : ''}
                </span>
              </div>
            )}
            <span id="site-chat-hint" className="muted">
              Можно оставить пустым: сайт соберётся из данных филиала. Ctrl+Enter создаёт сайт.
            </span>
          </div>
        </form>

        <SiteFactsCard vertical={vertical} facts={facts} />

        <fieldset className="site-start__designs" aria-describedby="site-designs-hint">
          <legend className="site-start__step">Дизайн</legend>
          <p id="site-designs-hint" className="muted">
            {ai ? 'Три варианта от ИИ под ваш запрос.' : 'Три разных направления. Превью собрано из данных филиала, без ИИ.'}
          </p>
          <DesignPicker name="site-design" facts={previewFacts} options={options} chosen={choice.key} onChoose={setChosen} disabled={busy} />
          <div className="site-start__actions">
            <Button type="button" tone="secondary" disabled={busy} onClick={more} data-testid="site-designs-more">
              {ai ? 'Готовые варианты' : 'Другие варианты'}
            </Button>
            <Button type="button" tone="secondary" disabled={busy || readOnly} onClick={() => void aiDesigns()} data-testid="create-site-designs">
              {phase === 'designing' ? 'ИИ подбирает…' : 'Подобрать ИИ под мой запрос'}
            </Button>
            <Button type="button" disabled={busy || readOnly} aria-busy={phase === 'starting' || undefined} onClick={() => void build()} data-testid="create-site-start">
              {phase === 'starting' || phase === 'building' ? 'Создаём…' : 'Создать сайт'}
            </Button>
          </div>
          <p className="muted" data-testid="site-design-chosen" aria-live="polite">
            Выбран дизайн «{choice.direction.name}».
          </p>
        </fieldset>
      </div>

      {readOnly && <p className="muted">Только чтение: создать сайт нельзя.</p>}
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
