'use client';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import { PATCH_INSTRUCTION_MAX, siteTemplatesFor, type SiteFactsVertical } from '@pms/domain';
import { Chip, ChipGroup } from '../../../../components/chip';
import { Alert, Button, Select, cx } from '../../../../components/ui';
import type { Loaded, SiteFacts, SiteLocation } from '../../../../lib/site-facts';
import { DICTATION_LANGS, appendDictated, useDictation, type DictationLang } from '../../../../lib/use-dictation';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { createFromPromptAction, createFromTemplateAction } from './actions';
import { BuildProgress } from './ai-chat';
import { PromptPreview, TemplateGallery } from './template-gallery';
import { promptPreviewSpec } from '../../../../lib/site-preview-spec';
import { LocationPicker } from './location-picker';
import { useGenerationRun } from './run';
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
 * Первый экран «Сайт и SEO»: «Создать свой сайт» по промту (владелец 29.10.2026, «как в Lovable: человек пишет промт,
 * по нему создаётся сайт, сразу с SEO и GEO»). Главный путь: описать сайт словами (подсказки, диктовка), справа живое
 * превью ровно того сайта, что сохранит сервер (свой дизайн из промта и данных филиала, `promptSiteSpec`), «Создать
 * сайт» сразу заводит сайт и открывает редактор. Если ИИ сайта на сервере включён, он следом переписывает тексты под
 * пожелания (правка к первой версии). Готовые стили остаются запасным путём в свёрнутом блоке ниже.
 *
 * Проект это филиал: ни названия, ни адреса сайта не спрашиваем. Решает сервер: экран не запрещает направление сам, а
 * отказ API по направлению переводит в понятные слова (`vertical-status.ts`).
 */
type Phase = 'idle' | 'starting' | 'building' | 'done';

export function CreateSite({
  vertical,
  locationName,
  locationId,
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
  // превью идёт за текстом без задержки ввода: React дорисует, когда освободится
  const prompt = useDeferredValue(text.trim());
  const previewDoc = useMemo(() => (prompt ? promptPreviewSpec(previewFacts, prompt) : null), [previewFacts, prompt]);

  const job = useGenerationRun(() => {
    // ИИ дописал тексты или отказал: сайт уже есть, открываем редактор в любом случае
    setPhase('done');
    router.refresh();
  });
  const busy = pending || phase === 'starting' || phase === 'building' || phase === 'done';

  const createByPrompt = async () => {
    if (readOnly || busy || !text.trim()) return;
    dictation.stop();
    setError(null);
    setPhase('starting');
    setPending(true);
    try {
      const reply = await createFromPromptAction(text.trim());
      if (!reply.ok) {
        setPhase('idle');
        setError(createErrorText(vertical, reply, t));
        return;
      }
      if (reply.data.run) {
        setStartedAt(Date.now());
        setPhase('building');
        job.start(reply.data.run);
        return;
      }
      setPhase('done');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  // Запасной путь: готовый стиль без промта
  const createByStyle = async () => {
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
          {t('Создать свой сайт')}
        </h2>
        <p className="muted">
          {t('Опишите словами, какой сайт нужен «{name}». Дизайн соберётся под ваши слова, услуги, цены, часы и контакты возьмутся из WETOP, SEO и карта подключатся сами. Потом всё можно поправить и опубликовать.', { name: locationName })}
        </p>
      </header>

      <div className="site-prompt">
        <form
          className={cx('site-chat site-prompt__chat', busy && 'is-busy')}
          aria-labelledby="site-chat-title"
          onSubmit={(e) => {
            e.preventDefault();
            void createByPrompt();
          }}
        >
          <h3 id="site-chat-title" className="site-start__step">
            {t('Какой сайт сделать?')}
          </h3>
          <label htmlFor="create-site-text" className="sr-only">
            {t('Опишите, каким должен быть сайт')}
          </label>
          <textarea
            id="create-site-text"
            rows={6}
            maxLength={PATCH_INSTRUCTION_MAX}
            className="site-chat__text"
            placeholder={t('Например: тёмный премиальный сайт с золотом, акцент на мастеров и быструю онлайн-запись')}
            value={text}
            disabled={busy || readOnly}
            aria-describedby="site-chat-hint"
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void createByPrompt();
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
            <Button
              type="submit"
              className="site-prompt__go"
              disabled={busy || readOnly || !text.trim()}
              aria-busy={phase === 'starting' || undefined}
              data-testid="create-site-prompt"
            >
              {phase === 'starting' || phase === 'done' ? t('Создаём…') : phase === 'building' ? t('ИИ дописывает тексты…') : t('Создать сайт')}
            </Button>
          </div>
          <span id="site-chat-hint" className="muted">
            {t('Каждый промт даёт свой дизайн: цвета, шрифты, порядок и вид блоков. Ctrl+Enter тоже создаёт сайт.')}
          </span>
        </form>

        <div className="site-prompt__preview" aria-live="polite" data-testid="site-prompt-preview">
          {previewDoc ? (
            <PromptPreview facts={previewFacts} spec={previewDoc} label={t('Превью сайта по вашему описанию')} />
          ) : (
            <p className="site-prompt__empty muted">{t('Начните писать слева: здесь сразу появится ваш сайт.')}</p>
          )}
        </div>
      </div>

      <div className="site-start__grid site-start__grid--after">
        <LocationPicker locations={locations} currentId={locationId} />
        <SiteFactsCard vertical={vertical} facts={facts} />
      </div>

      <details className="site-start__designs site-styles" data-testid="site-styles">
        <summary className="site-start__step">{t('Или начните с готового стиля')}</summary>
        <p id="site-designs-hint" className="muted">
          {t(DESIGNS_HINT[vertical])}
        </p>
        <TemplateGallery facts={previewFacts} templates={templates} chosen={template.id} onChoose={setChosen} disabled={busy} />
        <div className="site-start__actions">
          <Button type="button" tone="secondary" disabled={busy || readOnly} onClick={() => void createByStyle()} data-testid="create-site-start">
            {t('Создать по стилю')}
          </Button>
        </div>
        <p className="muted" data-testid="site-design-chosen" aria-live="polite">
          {t('Выбран шаблон «{name}».', { name: t(template.name) })}
        </p>
      </details>

      {readOnly && <p className="muted">{t('Только чтение: создать сайт нельзя.')}</p>}
      {error && (
        <Alert boxed data-testid="create-site-error">
          {error}
        </Alert>
      )}
      {phase === 'building' && (
        <div role="status" aria-live="polite" data-testid="create-site-steps">
          <BuildProgress startedAt={startedAt} />
          <Button type="button" tone="secondary" onClick={() => router.refresh()} data-testid="create-site-open">
            {t('Открыть редактор сейчас')}
          </Button>
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
