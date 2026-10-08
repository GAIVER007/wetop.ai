'use client';
import { useEffect, useRef, useState } from 'react';
import { PATCH_INSTRUCTION_MAX, SECTION_INSTRUCTION_MAX } from '@pms/domain';
import { Button, Field, Textarea } from '../../../../components/ui';

/**
 * Вкладка «ИИ» (MKT9.1): лента запросов этой сессии и строка ввода снизу, как чат конструктора. Запрос с меткой блока
 * уходит правкой одной секции (`SECTION`), без метки правкой всего сайта (`PATCH`). Лента живёт только в браузере
 * (`sessionStorage`): API текст команды наружу не отдаёт (ТЗ MKT9 §110), и другие люди её не видят.
 */
export type FeedState = 'running' | 'done' | 'failed' | 'unknown';
export interface FeedEntry {
  id: string;
  text: string;
  /** Подпись блока, если запрос был про одну секцию */
  target: string | null;
  state: FeedState;
  /** Что сейчас происходит словами: «В очереди», «ИИ работает» */
  status?: string;
  revision?: number;
  fromVersionId?: string;
  toVersionId?: string;
  error?: string;
}

const KEEP = 30;
const storageKey = (siteId: string) => `wetop.siteEditor.feed.${siteId}`;

/** Лента из `sessionStorage`: незаконченный до обновления вкладки запрос становится «итог смотрите в истории» */
export function useFeed(siteId: string) {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(siteId));
      const list = raw ? (JSON.parse(raw) as FeedEntry[]) : [];
      if (Array.isArray(list)) setEntries(list.map((e) => (e.state === 'running' ? { ...e, state: 'unknown' } : e)));
    } catch {
      // приватное окно или чужие данные: лента просто пустая
    }
  }, [siteId]);
  // запись только из действий человека: эффект при монтировании записал бы пустую ленту поверх сохранённой
  const change = (next: (list: FeedEntry[]) => FeedEntry[]) =>
    setEntries((list) => {
      const result = next(list).slice(-KEEP);
      try {
        sessionStorage.setItem(storageKey(siteId), JSON.stringify(result));
      } catch {
        // нет места или хранилище закрыто: лента остаётся на экране до ухода
      }
      return result;
    });
  const add = (entry: FeedEntry) => change((list) => [...list, entry]);
  const update = (id: string, patch: Partial<FeedEntry>) => change((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return { entries, add, update };
}

export function AiChat({
  entries,
  target,
  onClearTarget,
  dirty,
  readOnly,
  busy,
  onSend,
  onShowChanges,
  onUndo,
  text,
  setText,
}: {
  entries: FeedEntry[];
  target: string | null;
  onClearTarget: () => void;
  dirty: boolean;
  readOnly: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onShowChanges: (entry: FeedEntry) => void;
  onUndo: (entry: FeedEntry) => void;
  text: string;
  setText: (text: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [entries]);
  const max = target ? SECTION_INSTRUCTION_MAX : PATCH_INSTRUCTION_MAX;
  const empty = !target && !text.trim();
  const blocked = readOnly ? 'Только чтение' : busy ? 'ИИ ещё работает над прошлым запросом' : null;
  const send = () => {
    if (blocked || empty) return;
    onSend(text);
  };
  const lastDone = [...entries].reverse().find((e) => e.state === 'done');

  return (
    <div className="ed-chat" data-testid="ed-ai">
      {entries.length === 0 ? (
        <div className="ed-chat__empty">
          <p>
            <b>Напишите, что поменять на сайте.</b>
          </p>
          <p className="muted">
            Например, «сделай первый экран короче» или «добавь вопрос про парковку». Чтобы изменить один блок, щёлкните его на сайте справа.
          </p>
          <p className="muted">ИИ не меняет название, контакты, языки, бронирование и SEO и не придумывает цены.</p>
        </div>
      ) : (
        <ol className="ed-chat__feed" ref={list} aria-label="Запросы к ИИ">
          {entries.map((e) => (
            <li key={e.id} className="ed-chat__item">
              <p className="ed-chat__ask">
                {e.target && <span className="ed-chat__target">Блок «{e.target}»</span>}
                {e.text.trim() || (e.target ? 'Обновить блок' : '')}
              </p>
              {e.state === 'running' && (
                <p className="ed-chat__reply" role="status" data-testid="ed-ai-state">
                  {e.status ?? 'В очереди'}. Если сохранить изменения сейчас, результат ИИ не применится.
                </p>
              )}
              {e.state === 'failed' && (
                <div className="ed-chat__reply ed-chat__reply--error" role="alert" data-testid="ed-ai-error">
                  <p>{e.error}</p>
                  <Button type="button" tone="ghost" size="sm" onClick={() => setText(e.text)}>
                    Повторить запрос
                  </Button>
                </div>
              )}
              {e.state === 'unknown' && <p className="ed-chat__reply muted">Страница обновилась, пока ИИ работал. Итог смотрите в «Истории».</p>}
              {e.state === 'done' && (
                <div className="ed-chat__reply" data-testid="ed-ai-done">
                  <p>Готово: ИИ создал версию {e.revision}. Сайт справа уже с правками.</p>
                  <div className="ed-row">
                    <Button type="button" tone="secondary" size="sm" onClick={() => onShowChanges(e)}>
                      Что изменилось
                    </Button>
                    {e === lastDone && (
                      <Button type="button" tone="ghost" size="sm" disabled={readOnly || busy} onClick={() => onUndo(e)}>
                        Вернуть как было
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <form
        className="ed-chat__composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
      >
        {target && (
          <p className="ed-chat__chip" data-testid="ed-ai-target">
            <span>Блок «{target}»</span>
            <Button type="button" tone="ghost" size="sm" aria-label="Убрать блок: изменить весь сайт" onClick={onClearTarget}>
              Весь сайт
            </Button>
          </p>
        )}
        <Field
          label={target ? 'Что изменить в этом блоке?' : 'Что изменить на сайте?'}
          controlId="ed-ai-text"
          hint={blocked ?? (target ? 'Можно оставить пустым: ИИ перепишет блок, сохранив его назначение.' : 'Ctrl+Enter отправляет.')}
        >
          <Textarea
            rows={3}
            maxLength={max}
            value={text}
            disabled={readOnly}
            onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
        </Field>
        <Button type="submit" disabled={!!blocked || empty} data-testid="ed-ai-send">
          {dirty ? 'Сохранить и отправить' : 'Отправить'}
        </Button>
      </form>
    </div>
  );
}
