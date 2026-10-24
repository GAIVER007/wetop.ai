'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PATCH_INSTRUCTION_MAX, siteTemplatesFor, type SiteFactsVertical } from '@pms/domain';
import { Chip, ChipGroup } from '../../../../components/chip';
import { Alert, Button, Select, cx } from '../../../../components/ui';
import type { Loaded, SiteFacts, SiteLocation } from '../../../../lib/site-facts';
import { DICTATION_LANGS, appendDictated, useDictation, type DictationLang } from '../../../../lib/use-dictation';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { createFromTemplateAction, createSiteAction, type SiteDesignChoice } from './actions';
import { BuildProgress } from './ai-chat';
import { TemplateGallery } from './template-gallery';
import { LocationPicker } from './location-picker';
import { runErrorText, useGenerationRun } from './run';
import { SiteFactsCard } from './site-facts-card';
import { createErrorText } from './vertical-status';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';

/** Подпись под шаблонами: слово направления своё в каждом языке, поэтому фраза целиком на направление */
const DESIGNS_HINT: Record<WebVertical, string> = {
  HOSPITALITY: msg('Три готовых сайта для гостиниц. Превью собрано из данных филиала: что видно, то и получится.'),
  BEAUTY: msg('Три готовых сайта для салонов. Превью собрано из данных филиала: что видно, то и получится.'),
  FOOD_SERVICE: msg('Три готовых сайта для ресторанов. Превью собрано из данных филиала: что видно, то и получится.'),
};

/**
 * Первый экран «Сайт и SEO» (MKT9.2, SITE-1 по `plans/site-seo-flow-2026-10-15.md` §1 шаги 1–3), как у Lovable:
 * филиал, «Что WETOP знает о филиале», три готовых шаблона сайта своего сегмента (гостиница, салон, ресторан) с живым
 * превью и чат с подсказками и диктовкой. Главный путь без ИИ и без промптов: выбрать шаблон и «Создать сайт», сервер
 * сразу собирает сайт из данных филиала, и открывается редактор. Текст в чате необязателен: «Собрать с ИИ по
 * описанию» ставит первую сборку ИИ с выбранным шаблоном как оформлением.
 *
 * Проект это филиал: ни названия, ни адреса сайта не спрашиваем. Решает сервер: экран не запрещает направление сам, а
 * отказ API по направлению переводит в понятные слова (`vertical-status.ts`).
 */
type Phase = 'idle' | 'starting' | 'building' | 'done';

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
  const t = useT();
  const router = useRouter();
  const copy = verticalCopy(vertical);
  // подсказки из словаря направления: на экране и в тексте пожелания на языке человека
  const chips = copy.siteChips.map((chip) => t(chip));
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const templates = useMemo(() => siteTemplatesFor(vertical as SiteFactsVertical), [vertical]);
  const [chosen, setChosen] = useState<string>(() => templates[0]?.id ?? '');
  const [lang, setLang] = useState<DictationLang>('ru-RU');
  const dictation = useDictation({
    lang,
    onText: (phrase) => setText((previous) => appendDictated(previous, phrase, PATCH_INSTRUCTION_MAX)),
    onError: setError,
  });

  const template = templates.find((x) => x.id === chosen) ?? templates[0]!;
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
            hours: { days: [], checkInTime: null, checkOutTime: null },
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
      setError(runErrorText(run, t));
    }
  });
  const busy = pending || phase === 'starting' || phase === 'building' || phase === 'done';

  // Главный путь: шаблон без ИИ. Сайт и первая версия появляются сразу, страница перечитывается и открывает редактор
  const create = async () => {
    if (readOnly || busy) return;
    dictation.stop();
    setError(null);
    setPhase('starting');
    setPending(true);
    try {
      const reply = await createFromTemplateAction(template.id);
      if (!reply.ok) {
        setPhase('idle');
        setError(createErrorText(vertical, reply, t));
        return;
      }
      setPhase('done');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  // Необязательный путь: первая сборка ИИ по описанию человека, с выбранным шаблоном как оформлением
  const selected = (): SiteDesignChoice => ({ presetId: template.id });

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
        setError(createErrorText(vertical, reply, t));
        return;
      }
      setStartedAt(Date.now());
      setPhase('building');
      job.start(reply.run);
    } finally {
      setPending(false);
    }
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
          {t('Сайт для {name}', { name: locationName })}
        </h2>
        <p className="muted">
          {t('Выберите филиал и один из трёх готовых шаблонов: сайт соберётся сразу из данных филиала, без ИИ. Дальше всё правится в редакторе.')}
        </p>
      </header>

      <div className="site-start__grid">
        <LocationPicker locations={locations} currentId={locationId} />

        <form
          className={cx('site-chat', busy && 'is-busy')}
          aria-labelledby="site-chat-title"
          onSubmit={(e) => {
            e.preventDefault();
            void (text.trim() ? build() : create());
          }}
        >
          <h3 id="site-chat-title" className="site-start__step">
            {t('Пожелания для ИИ (необязательно)')}
          </h3>
          <label htmlFor="create-site-text" className="sr-only">
            {t('Опишите, каким должен быть сайт')}
          </label>
          <textarea
            id="create-site-text"
            rows={5}
            maxLength={PATCH_INSTRUCTION_MAX}
            className="site-chat__text"
            placeholder={t('Например: спокойный сайт, акцент на тишину и чистоту, дружелюбный тон')}
            value={text}
            disabled={busy || readOnly}
            aria-describedby="site-chat-hint"
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (text.trim()) void build();
              }
            }}
          />
          <ChipGroup label={t('Подсказки')} className="site-chat__chips">
            {chips.map((chip) => (
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
                  {dictation.listening ? t('Остановить диктовку') : t('Надиктовать')}
                </Button>
                <label className="sr-only" htmlFor="site-dictation-lang">
                  {t('Язык диктовки')}
                </label>
                <Select id="site-dictation-lang" value={lang} disabled={dictation.listening || busy} onChange={(e) => setLang(e.currentTarget.value as DictationLang)} className="site-chat__lang">
                  {DICTATION_LANGS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
                <span className="muted" aria-live="polite">
                  {dictation.listening ? t('Слушаю…') : ''}
                </span>
              </div>
            )}
            <span id="site-chat-hint" className="muted">
              {t('Без текста сайт создаётся по шаблону сразу. С текстом ИИ доработает выбранный шаблон под ваши пожелания (Ctrl+Enter).')}
            </span>
          </div>
        </form>

        <SiteFactsCard vertical={vertical} facts={facts} />

        <fieldset className="site-start__designs" aria-describedby="site-designs-hint">
          <legend className="site-start__step">{t('Шаблон сайта')}</legend>
          <p id="site-designs-hint" className="muted">
            {t(DESIGNS_HINT[vertical])}
          </p>
          <TemplateGallery facts={previewFacts} templates={templates} chosen={template.id} onChoose={setChosen} disabled={busy} />
          <div className="site-start__actions">
            <Button type="button" tone="secondary" disabled={busy || readOnly || !text.trim()} onClick={() => void build()} data-testid="create-site-ai">
              {phase === 'building' ? t('ИИ собирает…') : t('Собрать с ИИ по описанию')}
            </Button>
            <Button type="button" disabled={busy || readOnly} aria-busy={phase === 'starting' || undefined} onClick={() => void create()} data-testid="create-site-start">
              {phase === 'starting' || phase === 'done' ? t('Создаём…') : t('Создать сайт')}
            </Button>
          </div>
          <p className="muted" data-testid="site-design-chosen" aria-live="polite">
            {t('Выбран шаблон «{name}».', { name: t(template.name) })}
          </p>
        </fieldset>
      </div>

      {readOnly && <p className="muted">{t('Только чтение: создать сайт нельзя.')}</p>}
      {error && (
        <Alert boxed data-testid="create-site-error">
          {error}
        </Alert>
      )}
      {phase === 'building' && (
        <div role="status" aria-live="polite" data-testid="create-site-steps">
          <BuildProgress startedAt={startedAt} />
        </div>
      )}
      {phase === 'done' && (
        <p role="status" className="muted" data-testid="create-site-done">
          {t('Сайт создан. Открываем редактор')}
        </p>
      )}
      {job.lost && <Alert boxed>{job.lost}</Alert>}
    </section>
  );
}
