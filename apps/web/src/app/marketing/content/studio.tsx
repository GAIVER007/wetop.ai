'use client';
import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import type { ContentChannelCode, ContentCtaCode, ContentDraftView, ContentVariantView } from '../../../lib/api';
import { Alert, Badge, Button, Field, Input, Notice, Select, Textarea } from '../../../components/ui';
import {
  archiveDraftAction,
  proposeContentAction,
  publishedDraftAction,
  saveDraftAction,
  type ContentActionResult,
} from './actions';

/**
 * «Контент» (CONTENT-DRAFTS-20261022): тема → 1–2 варианта ИИ → правка → черновик на день недели. Ничего не
 * публикует в соцсети: «Скопировать» и «Отметить опубликованным». Цифры не из карточки филиала подсвечены.
 */
export const CHANNEL_LABEL: Record<ContentChannelCode, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TELEGRAM: 'Telegram',
  WHATSAPP_STATUS: 'Статус WhatsApp',
};
export const CTA_LABEL: Record<ContentCtaCode, string> = {
  BOOK_ONLINE: 'Записаться онлайн',
  WHATSAPP: 'Написать в WhatsApp',
  CALL: 'Позвонить',
  VISIT: 'Прийти по адресу',
  NONE: 'Без кнопки',
};
const NONE: ContentActionResult = { error: null, ok: 0 };
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      tone="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? 'Скопировано' : 'Скопировать'}
    </Button>
  );
}

interface EditorValue {
  id?: string;
  revision?: number;
  channel: ContentChannelCode;
  topic: string;
  title: string;
  body: string;
  hashtags: string;
  cta: ContentCtaCode | '';
  origin: 'AI' | 'MANUAL';
  plannedOn: string;
  warnings: string[];
}

function DraftEditor({
  value,
  ctas,
  days,
  onDone,
  onCancel,
}: {
  value: EditorValue;
  ctas: ContentCtaCode[];
  days: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const creationId = useMemo(() => crypto.randomUUID(), []);
  const [state, save, saving] = useActionState(saveDraftAction, NONE);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={save} className="content-editor" data-testid="content-editor" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="marketing-screen__title">
        {value.id ? 'Черновик поста' : 'Новый пост'}
      </h3>
      {value.id ? (
        <>
          <input type="hidden" name="id" value={value.id} />
          <input type="hidden" name="expectedRevision" value={value.revision} />
        </>
      ) : (
        <input type="hidden" name="creationId" value={creationId} />
      )}
      <input type="hidden" name="origin" value={value.origin} />
      <input type="hidden" name="topic" value={value.topic} />
      {value.warnings.length > 0 && (
        <Alert tone="warning" data-testid="content-warnings">
          Проверьте цифры, которых нет в карточке филиала: {value.warnings.join(', ')}. Исправьте или удалите их перед
          публикацией.
        </Alert>
      )}
      <div className="content-editor__row">
        <Field label="Канал" controlId={`${id}-channel`} required>
          <Select name="channel" defaultValue={value.channel}>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="День публикации" controlId={`${id}-day`} required={false}>
          <Select name="plannedOn" defaultValue={value.plannedOn}>
            <option value="">Без дня</option>
            {days.map((d, i) => (
              <option key={d} value={d}>
                {WEEK[i]}, {dayLabel(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Кнопка действия" controlId={`${id}-cta`} required={false}>
          <Select name="cta" defaultValue={value.cta}>
            {ctas.map((c) => (
              <option key={c} value={c}>
                {CTA_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Заголовок" controlId={`${id}-heading`} required={false}>
        <Input name="title" maxLength={200} defaultValue={value.title} />
      </Field>
      <Field
        label="Текст поста"
        controlId={`${id}-body`}
        required
        hint="До 2 200 знаков. Ссылку брони, телефон и адрес WETOP добавит сам по кнопке действия."
      >
        <Textarea name="body" rows={10} maxLength={2200} defaultValue={value.body} />
      </Field>
      <Field label="Хештеги" controlId={`${id}-tags`} required={false} hint="Через пробел или запятую, до 10">
        <Input name="hashtags" defaultValue={value.hashtags} />
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="content-editor__actions">
        <Button type="submit" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить черновик'}
        </Button>
        <Button type="button" tone="ghost" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function Variants({
  variants,
  onPick,
}: {
  variants: ContentVariantView[];
  onPick: (v: ContentVariantView) => void;
}) {
  return (
    <ul className="content-variants" data-testid="content-variants">
      {variants.map((v, i) => (
        <li key={i} className="content-variant">
          <div className="content-variant__head">
            <strong>Вариант {String.fromCharCode(65 + i)}</strong>
            {v.warnings.length > 0 && <Badge tone="warn">Проверьте цифры: {v.warnings.join(', ')}</Badge>}
          </div>
          <p className="content-variant__text">{v.preview}</p>
          <div className="content-variant__actions">
            <Button type="button" size="sm" onClick={() => onPick(v)}>
              Взять этот
            </Button>
            <CopyButton text={v.preview} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** ИИ недоступен (нет ключа, бюджет): API отвечает словами, кнопка «Написать самому» работает всегда */
export function ContentStudio({ ctas, days }: { ctas: ContentCtaCode[]; days: string[] }) {
  const id = useId();
  const [state, propose, thinking] = useActionState(proposeContentAction, NONE);
  const [topic, setTopic] = useState('');
  const [channel, setChannel] = useState<ContentChannelCode>('INSTAGRAM');
  const [editor, setEditor] = useState<EditorValue | null>(null);
  const [saved, setSaved] = useState(0);
  const fallback: ContentCtaCode = ctas[0] ?? 'NONE';
  const blank = (origin: 'AI' | 'MANUAL'): EditorValue => ({
    channel,
    topic,
    title: '',
    body: '',
    hashtags: '',
    cta: fallback,
    origin,
    plannedOn: '',
    warnings: [],
  });
  return (
    <div className="marketing-screen__stack" data-testid="content-studio">
      {saved > 0 && !editor && (
        <Notice data-testid="content-saved">Черновик сохранён. Он в плане публикаций на вкладке «План публикаций».</Notice>
      )}
      <form action={propose} className="content-brief" aria-labelledby={`${id}-brief`}>
        <h2 id={`${id}-brief`} className="marketing-screen__title">
          О чём пост
        </h2>
        <Field
          label="Тема"
          controlId={`${id}-topic`}
          required
          hint="Например: осенний уход, новая услуга, свободные окна на выходных. Цены и скидки ИИ берёт только из карточки."
        >
          <Textarea name="topic" rows={3} maxLength={500} value={topic} onChange={(e) => setTopic(e.target.value)} />
        </Field>
        <div className="content-editor__row">
          <Field label="Канал" controlId={`${id}-ch`} required>
            <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as ContentChannelCode)}>
              {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тон" controlId={`${id}-tone`} required>
            <Select name="tone" defaultValue="FRIENDLY">
              <option value="FRIENDLY">Дружелюбный</option>
              <option value="BUSINESS">Деловой</option>
            </Select>
          </Field>
        </div>
        {state.error && <Alert>{state.error}</Alert>}
        <div className="content-editor__actions">
          <Button type="submit" disabled={thinking || !topic.trim()}>
            {thinking ? 'ИИ пишет…' : 'Написать с ИИ'}
          </Button>
          <Button type="button" tone="secondary" onClick={() => setEditor(blank('MANUAL'))} disabled={thinking}>
            Написать самому
          </Button>
        </div>
      </form>
      {state.variants && state.variants.length > 0 && !editor && (
        <Variants
          variants={state.variants}
          onPick={(v) =>
            setEditor({
              ...blank('AI'),
              title: v.title ?? '',
              body: v.body,
              hashtags: v.hashtags.join(' '),
              cta: v.cta,
              warnings: v.warnings,
            })
          }
        />
      )}
      {editor && (
        <DraftEditor
          key={JSON.stringify(editor)}
          value={editor}
          ctas={ctas}
          days={days}
          onDone={() => {
            setEditor(null);
            setSaved(Date.now());
          }}
          onCancel={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function DraftCard({ d, ctas, days }: { d: ContentDraftView; ctas: ContentCtaCode[]; days: string[] }) {
  const [editing, setEditing] = useState(false);
  const [pubState, markPublished, publishing] = useActionState(publishedDraftAction, NONE);
  const [archState, archive, archiving] = useActionState(archiveDraftAction, NONE);
  if (editing)
    return (
      <DraftEditor
        value={{
          id: d.id,
          revision: d.revision,
          channel: d.channel,
          topic: d.topic,
          title: d.title ?? '',
          body: d.body,
          hashtags: d.hashtags.join(' '),
          cta: d.cta ?? '',
          origin: d.origin,
          plannedOn: d.plannedOn ?? '',
          warnings: [],
        }}
        ctas={ctas.includes(d.cta ?? 'NONE') ? ctas : [...ctas, d.cta ?? 'NONE']}
        days={days}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="content-card" data-testid="content-card">
      <div className="content-variant__head">
        <Badge tone="info">{CHANNEL_LABEL[d.channel]}</Badge>
        {d.status === 'PUBLISHED' ? <Badge tone="ok">Опубликован</Badge> : <Badge>Черновик</Badge>}
        {d.origin === 'AI' && <Badge>ИИ</Badge>}
      </div>
      {d.title && <strong>{d.title}</strong>}
      <p className="content-card__text">{d.body}</p>
      {(pubState.error || archState.error) && <Alert>{pubState.error || archState.error}</Alert>}
      <div className="content-variant__actions">
        <CopyButton text={d.preview} />
        {d.status === 'DRAFT' && (
          <>
            <Button type="button" tone="secondary" size="sm" onClick={() => setEditing(true)}>
              Изменить
            </Button>
            <form action={markPublished}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="expectedRevision" value={d.revision} />
              <Button type="submit" tone="secondary" size="sm" disabled={publishing}>
                Отметить опубликованным
              </Button>
            </form>
          </>
        )}
        <form action={archive}>
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="expectedRevision" value={d.revision} />
          <Button type="submit" tone="ghost" size="sm" disabled={archiving}>
            В архив
          </Button>
        </form>
      </div>
    </article>
  );
}

export function ContentPlan({
  items,
  from,
  today,
  ctas,
}: {
  items: ContentDraftView[];
  from: string;
  today: string;
  ctas: ContentCtaCode[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const unplanned = items.filter((d) => !d.plannedOn);
  return (
    <div className="marketing-screen__stack" data-testid="content-plan">
      <ol className="content-week" aria-label="План публикаций по дням">
        {days.map((day, i) => {
          const list = items.filter((d) => d.plannedOn === day);
          return (
            <li key={day} className="content-week__day" aria-current={day === today ? 'date' : undefined}>
              <span className="marketing-week__name">
                {WEEK[i]}, {dayLabel(day)}
              </span>
              {list.length === 0 ? (
                <span className="marketing-week__empty">Пусто</span>
              ) : (
                list.map((d) => <DraftCard key={`${d.id}-${d.revision}`} d={d} ctas={ctas} days={days} />)
              )}
            </li>
          );
        })}
      </ol>
      {unplanned.length > 0 && (
        <section aria-label="Черновики без дня" className="marketing-screen__stack">
          <h3 className="marketing-screen__title">Без дня</h3>
          {unplanned.map((d) => (
            <DraftCard key={`${d.id}-${d.revision}`} d={d} ctas={ctas} days={days} />
          ))}
        </section>
      )}
    </div>
  );
}
