'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { BusinessAvailability, BusinessCompetitor } from '../../../lib/api';
import { displayDate } from '../../../lib/display-date';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { useToast } from '../../../components/toast';
import { useConfirm } from '../../../components/use-confirm';
import { Alert, Button, Field, Input, Select, Textarea } from '../../../components/ui';
import {
  archiveBusinessCompetitorAction,
  saveBusinessCompetitorAction,
  writeBusinessSnapshotAction,
  type BusinessMarketResult,
} from './actions';

const NONE: BusinessMarketResult = { error: null, ok: 0 };

/** Действие формы: уведомление по ответу, панель закрывается эффектом (как у гостиничного раздела) */
function useAction(
  serverAction: (prev: BusinessMarketResult, fd: FormData) => Promise<BusinessMarketResult>,
  close: () => void,
) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(async (prev: BusinessMarketResult, fd: FormData) => {
    const next = await serverAction(prev, fd);
    if (next.ok) toast({ text: next.message ?? 'Сохранено', tone: 'success' });
    return next;
  }, NONE);
  const seen = useRef(0);
  useEffect(() => {
    if (!state.ok || state.ok === seen.current) return;
    seen.current = state.ok;
    close();
  }, [state, close]);
  return [state, action, pending] as const;
}

/** «Добавить конкурента» и «Изменить»: одна форма, при правке внизу «Убрать из списка» */
export function BusinessCompetitorButton({
  competitor,
  primary,
  words,
}: {
  competitor?: BusinessCompetitor | undefined;
  primary?: boolean | undefined;
  words: { place: string; link: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone={competitor ? 'ghost' : primary ? undefined : 'secondary'}
        size={competitor ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={competitor ? `bm-edit-${competitor.id}` : 'bm-add'}
        aria-label={competitor ? `Изменить: ${competitor.name}` : undefined}
      >
        {!competitor && <Icon name="plus" />}
        {competitor ? 'Изменить' : 'Добавить конкурента'}
      </Button>
      {open && (
        <Overlay open drawer title={competitor ? competitor.name : 'Новый конкурент'} onClose={() => setOpen(false)}>
          <CompetitorForm competitor={competitor} words={words} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function CompetitorForm({
  competitor,
  words,
  onClose,
}: {
  competitor?: BusinessCompetitor | undefined;
  words: { place: string; link: string };
  onClose: () => void;
}) {
  const [state, action, pending] = useAction(saveBusinessCompetitorAction, onClose);
  const [archived, archive, archiving] = useAction(archiveBusinessCompetitorAction, onClose);
  const { ask, dialog } = useConfirm();
  const archiveForm = useRef<HTMLFormElement>(null);
  const error = state.error ?? archived.error;
  const v = (name: keyof BusinessCompetitor, fallback: string | number | null | undefined) =>
    state.values?.[name] ?? (fallback === null || fallback === undefined ? '' : String(fallback));
  return (
    <>
      <form action={action} className="settings-service-form" data-testid="bm-competitor-form">
        {error && <Alert boxed>{error}</Alert>}
        {competitor && <input type="hidden" name="id" value={competitor.id} />}
        <Field label={`Название ${words.place}`}>
          <Input name="name" required maxLength={200} defaultValue={v('name', competitor?.name)} />
        </Field>
        <Field label={`Ссылка на ${words.link}`} controlId="bm-url" hint="Dikidi, YCLIENTS, Restoplace или сайт: по ней видно свободные окна">
          <Input id="bm-url" name="url" type="url" inputMode="url" placeholder="https://" defaultValue={v('url', competitor?.url)} />
        </Field>
        <Field label="Адрес">
          <Input name="address" maxLength={300} defaultValue={v('address', competitor?.address)} />
        </Field>
        <Field label="Расстояние, м">
          <Input name="distanceM" inputMode="numeric" defaultValue={v('distanceM', competitor?.distanceM)} />
        </Field>
        <Field label="Заметка">
          <Textarea name="note" rows={2} maxLength={500} defaultValue={v('note', competitor?.note)} />
        </Field>
        <div className="settings-service-actions">
          <Button type="submit" disabled={pending}>
            Сохранить
          </Button>
        </div>
      </form>
      {competitor && (
        <form action={archive} ref={archiveForm}>
          <input type="hidden" name="id" value={competitor.id} />
          <Button
            type="button"
            tone="ghost"
            disabled={archiving}
            onClick={async () => {
              if (await ask({ title: `Убрать «${competitor.name}» из списка?`, body: 'Снимки загрузки останутся в истории.', confirmLabel: 'Убрать из списка' }))
                archiveForm.current?.requestSubmit();
            }}
          >
            Убрать из списка
          </Button>
        </form>
      )}
      {dialog}
    </>
  );
}

const LEVELS: Array<[BusinessAvailability, string]> = [
  ['SOLD_OUT', 'Нет мест'],
  ['FEW_LEFT', 'Мало мест'],
  ['AVAILABLE', 'Есть места'],
];

/** Клетка доски: по щелчку окно «загрузка соседа на день» (ручной ввод, тот же день правит прежний снимок) */
export function SnapshotCell({
  competitor,
  day,
  level,
  freeSlots,
  collected = false,
  label,
  editable,
  className,
}: {
  competitor: { id: string; name: string };
  day: string;
  level: BusinessAvailability | null;
  freeSlots: number | null;
  /** снимок записал сборщик с площадки (источник AI_AGENT), а не человек */
  collected?: boolean;
  label: string;
  editable: boolean;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useAction(writeBusinessSnapshotAction, () => setOpen(false));
  const text = (
    <>
      <span className="market-cell__value">{label}</span>
      {freeSlots !== null && level !== 'SOLD_OUT' && <span className="market-cell__delta">окон {freeSlots}</span>}
      {collected && <span className="market-cell__delta" data-testid="bm-cell-collected">ИИ</span>}
    </>
  );
  return (
    <td className={className} title={label}>
      {editable ? (
        <button
          type="button"
          className="bm-cell-button"
          onClick={() => setOpen(true)}
          aria-label={`${competitor.name}, ${displayDate(day, 'numeric')}: ${label}. Изменить`}
        >
          {text}
        </button>
      ) : (
        text
      )}
      {open && (
        <Overlay open drawer title={`${competitor.name}, ${displayDate(day)}`} onClose={() => setOpen(false)}>
          <form action={action} className="settings-service-form" data-testid="bm-snapshot-form">
            {state.error && <Alert boxed>{state.error}</Alert>}
            <input type="hidden" name="id" value={competitor.id} />
            <input type="hidden" name="day" value={day} />
            <Field label="Загрузка на день">
              <Select name="level" defaultValue={state.values?.level ?? level ?? ''}>
                <option value="">По числу окон</option>
                {LEVELS.map(([value, word]) => (
                  <option key={value} value={value}>
                    {word}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Свободных окон или столов" controlId="bm-slots" hint="Если видно на странице записи или брони">
              <Input id="bm-slots" name="freeSlots" inputMode="numeric" defaultValue={state.values?.freeSlots ?? (freeSlots ?? '')} />
            </Field>
            <div className="settings-service-actions">
              <Button type="submit" disabled={pending}>
                Сохранить
              </Button>
            </div>
          </form>
        </Overlay>
      )}
    </td>
  );
}
