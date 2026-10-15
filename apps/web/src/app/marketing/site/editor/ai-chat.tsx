'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { GENERATION_ERROR_TEXT, PATCH_INSTRUCTION_MAX, SECTION_INSTRUCTION_MAX, SITE_AI_USER_TEXT_MAX, isGenerationErrorCode } from '@pms/domain';
import type { AssistantPayloadView, DesignDirectionView, SiteConversationItem } from '../../../../lib/api';
import { Button, Field, Textarea, cx } from '../../../../components/ui';
import { BUILD_STEPS } from './run';

/**
 * Вкладка «ИИ» (MKT9.1, MKT9.2): разговор с ИИ сайта как у конструктора. Режимы «Чат» (ответ словами, сайт не меняется),
 * «План» (вопросы и план, сборка только по кнопке) и «Сборка» (правка сайта: с меткой блока одна секция, без неё весь
 * сайт). Лента хранится на сервере и видна после обновления страницы; в браузере только недописанный текст.
 */
export type AiMode = 'CHAT' | 'PLAN' | 'BUILD';
const MODES: Array<[AiMode, string]> = [
  ['CHAT', 'Чат'],
  ['PLAN', 'План'],
  ['BUILD', 'Сборка'],
];
const LABEL: Record<AiMode, string> = {
  CHAT: 'Спросите ИИ о сайте',
  PLAN: 'Что вы хотите получить?',
  BUILD: 'Что изменить на сайте?',
};

export function errorText(code: string | null): string {
  return isGenerationErrorCode(code) ? GENERATION_ERROR_TEXT[code] : 'ИИ не смог выполнить задачу';
}

const active = (item: SiteConversationItem) => item.status === 'QUEUED' || item.status === 'RUNNING';

/** Ход сборки словами: шаг по времени работы, последний держится до конца; это подсказка, а не замер */
export function BuildProgress({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(timer);
  }, []);
  const step = Math.min(BUILD_STEPS.length - 1, Math.floor((now - startedAt) / 4000));
  return (
    <ol className="ed-steps" aria-label="Ход сборки" data-testid="ed-build-steps">
      {BUILD_STEPS.map((label, i) => (
        <li key={label} className={cx('ed-steps__item', i < step && 'is-done', i === step && 'is-active')} aria-current={i === step ? 'step' : undefined}>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** Три направления оформления карточками с выбором одного (радиокнопки) */
export function DesignCards({
  directions,
  actionLabel,
  disabled,
  onChoose,
}: {
  directions: DesignDirectionView[];
  actionLabel: string;
  disabled: boolean;
  onChoose: (direction: DesignDirectionView) => void;
}) {
  const name = useId();
  const [chosen, setChosen] = useState(directions[0]?.id ?? '');
  const picked = directions.find((d) => d.id === chosen);
  return (
    <fieldset className="ed-design" data-testid="ed-design">
      <legend className="ed-design__legend">Выберите оформление</legend>
      <div className="ed-design__cards">
        {directions.map((d) => (
          <label key={d.id} className={cx('ed-design__card', chosen === d.id && 'is-on')} data-testid="ed-design-card">
            <input type="radio" name={name} value={d.id} checked={chosen === d.id} onChange={() => setChosen(d.id)} className="ed-design__radio" />
            <span className={cx('ed-design__swatch', `is-${d.theme.preset.toLowerCase()}`)} aria-hidden="true" />
            <b>{d.name}</b>
            <span className="muted">{d.shortDescription}</span>
          </label>
        ))}
      </div>
      <Button type="button" disabled={disabled || !picked} onClick={() => picked && onChoose(picked)} data-testid="ed-design-apply">
        {actionLabel}
      </Button>
    </fieldset>
  );
}

function Questions({
  payload,
  disabled,
  onAnswer,
}: {
  payload: Extract<AssistantPayloadView, { kind: 'QUESTIONS' }>;
  disabled: boolean;
  onAnswer: (answers: Array<{ questionId: string; answer: string }>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const value = (id: string) => (answers[id] === '__custom' ? (custom[id] ?? '').trim() : (answers[id] ?? ''));
  const ready = payload.questions.every((q) => value(q.id));
  return (
    <form
      className="ed-questions"
      data-testid="ed-questions"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAnswer(payload.questions.map((q) => ({ questionId: q.id, answer: value(q.id) })));
      }}
    >
      {payload.questions.map((q) => (
        <fieldset key={q.id} className="ed-questions__q">
          <legend>{q.question}</legend>
          {q.options.map((option) => (
            <label key={option} className="ed-questions__option">
              <input type="radio" name={`q-${q.id}`} value={option} checked={answers[q.id] === option} onChange={() => setAnswers((a) => ({ ...a, [q.id]: option }))} />
              {option}
            </label>
          ))}
          {q.allowCustom && (
            <label className="ed-questions__option">
              <input type="radio" name={`q-${q.id}`} value="__custom" checked={answers[q.id] === '__custom'} onChange={() => setAnswers((a) => ({ ...a, [q.id]: '__custom' }))} />
              Свой ответ
            </label>
          )}
          {answers[q.id] === '__custom' && (
            <Field label="Ваш ответ" controlId={`q-${q.id}-custom`}>
              <input id={`q-${q.id}-custom`} className="inp" maxLength={400} value={custom[q.id] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [q.id]: e.currentTarget.value }))} />
            </Field>
          )}
        </fieldset>
      ))}
      <Button type="submit" size="sm" disabled={disabled || !ready} data-testid="ed-questions-send">
        Ответить
      </Button>
    </form>
  );
}

function Plan({
  payload,
  disabled,
  onApprove,
}: {
  payload: Extract<AssistantPayloadView, { kind: 'PLAN' }>;
  disabled: boolean;
  onApprove: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState(payload.buildInstruction);
  const [closed, setClosed] = useState(false);
  return (
    <div className="ed-plan" data-testid="ed-plan">
      <p>
        <b>{payload.summary}</b>
      </p>
      <ol className="ed-plan__steps">
        {payload.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {payload.tradeoffs.length > 0 && (
        <p className="muted">
          Чем придётся пожертвовать: {payload.tradeoffs.join('; ')}
        </p>
      )}
      {closed ? (
        <p className="muted" data-testid="ed-plan-closed">
          План отменён: сайт не менялся.
        </p>
      ) : (
        <>
          <Field label="Что ИИ сделает при сборке" controlId={`plan-${payload.summary.length}`} hint="Можно поправить перед сборкой.">
            <Textarea rows={3} maxLength={PATCH_INSTRUCTION_MAX} value={instruction} disabled={disabled} onChange={(e) => setInstruction(e.currentTarget.value)} />
          </Field>
          <div className="ed-row">
            <Button type="button" size="sm" disabled={disabled || !instruction.trim()} onClick={() => onApprove(instruction)} data-testid="ed-plan-approve">
              Собрать по плану
            </Button>
            <Button type="button" tone="ghost" size="sm" onClick={() => setClosed(true)} data-testid="ed-plan-cancel">
              Отменить
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function AiChat({
  items,
  revisionOf,
  mode,
  setMode,
  target,
  onClearTarget,
  dirty,
  readOnly,
  busy,
  onSend,
  onAnswer,
  onApprove,
  onApplyDesign,
  onShowChanges,
  onUndo,
  text,
  setText,
  error,
}: {
  items: SiteConversationItem[];
  revisionOf: (versionId: string | null) => number | null;
  mode: AiMode;
  setMode: (mode: AiMode) => void;
  target: string | null;
  onClearTarget: () => void;
  dirty: boolean;
  readOnly: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onAnswer: (planId: string, answers: Array<{ questionId: string; answer: string }>) => void;
  onApprove: (planId: string, instruction: string) => void;
  onApplyDesign: (direction: DesignDirectionView) => void;
  onShowChanges: (item: SiteConversationItem) => void;
  onUndo: (item: SiteConversationItem) => void;
  text: string;
  setText: (text: string) => void;
  error: string | null;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [startedAt] = useState(() => new Map<string, number>());
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
  }, [items.length]);
  const building = mode === 'BUILD';
  const max = building ? (target ? SECTION_INSTRUCTION_MAX : PATCH_INSTRUCTION_MAX) : SITE_AI_USER_TEXT_MAX;
  const empty = !(building && target) && !text.trim();
  const blocked = readOnly ? 'Только чтение' : busy ? 'ИИ ещё работает над прошлым запросом' : null;
  const send = () => {
    if (blocked || empty) return;
    onSend(text);
  };
  const lastDone = [...items].reverse().find((i) => i.kind === 'BUILD' && i.status === 'SUCCEEDED' && i.outputVersionId);
  const lastId = items.at(-1)?.id;

  return (
    <div className="ed-chat" data-testid="ed-ai">
      <div className="ed-modes" role="radiogroup" aria-label="Режим ИИ" data-testid="ed-modes">
        {MODES.map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={mode === key} className={cx('ed-modes__btn', mode === key && 'is-on')} onClick={() => setMode(key)}>
            {label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="ed-chat__empty">
          <p>
            <b>Напишите, что поменять на сайте.</b>
          </p>
          <p className="muted">
            «Сборка» меняет сайт, «План» сначала договаривается, что делать, «Чат» просто отвечает. Чтобы изменить один блок, щёлкните его на сайте справа.
          </p>
          <p className="muted">ИИ не меняет название, контакты, языки, бронирование и SEO, не придумывает цены и не публикует сайт.</p>
        </div>
      ) : (
        <ol className="ed-chat__feed" ref={list} aria-label="Разговор с ИИ" data-testid="ed-feed">
          {items.map((item) => {
            const payload = item.payload;
            const revision = revisionOf(item.outputVersionId);
            if (active(item) && !startedAt.has(item.id)) startedAt.set(item.id, Date.now());
            return (
              <li key={item.id} className="ed-chat__item" data-testid="ed-feed-item" data-kind={item.kind}>
                <p className="ed-chat__ask">
                  <span className="ed-chat__mode">{item.kind === 'BUILD' ? (item.fromPlanId ? 'Сборка по плану' : 'Сборка') : item.mode === 'CHAT' ? 'Чат' : item.mode === 'PLAN' ? 'План' : 'Оформление'}</span>
                  {item.userText ?? (item.target ? 'Обновить блок' : '')}
                </p>
                {active(item) &&
                  (item.kind === 'BUILD' ? (
                    <div className="ed-chat__reply" role="status" data-testid="ed-ai-state">
                      <BuildProgress startedAt={startedAt.get(item.id) ?? Date.now()} />
                      <p className="muted">Если сохранить изменения сейчас, результат ИИ не применится.</p>
                    </div>
                  ) : (
                    <p className="ed-chat__reply" role="status" data-testid="ed-ai-state">
                      ИИ думает над ответом
                    </p>
                  ))}
                {item.status === 'FAILED' && (
                  <div className="ed-chat__reply ed-chat__reply--error" role="alert" data-testid="ed-ai-error">
                    <p>{errorText(item.errorCode)}</p>
                    {item.userText && (
                      <Button type="button" tone="ghost" size="sm" onClick={() => setText(item.userText ?? '')}>
                        Повторить запрос
                      </Button>
                    )}
                  </div>
                )}
                {item.status === 'SUCCEEDED' && item.kind === 'BUILD' && (
                  <div className="ed-chat__reply" data-testid="ed-ai-done">
                    <p>Готово: ИИ создал версию {revision ?? ''}. Сайт справа уже с правками.</p>
                    <div className="ed-row">
                      <Button type="button" tone="secondary" size="sm" onClick={() => onShowChanges(item)}>
                        Что изменилось
                      </Button>
                      {item.id === lastDone?.id && item.baseVersionId && (
                        <Button type="button" tone="ghost" size="sm" disabled={readOnly || busy} onClick={() => onUndo(item)}>
                          Вернуть как было
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {item.status === 'SUCCEEDED' && payload?.kind === 'CHAT' && (
                  <div className="ed-chat__reply" data-testid="ed-ai-answer">
                    <p>{item.assistantText}</p>
                    <div className="ed-row">
                      {payload.suggestBuild && (
                        <Button
                          type="button"
                          tone="secondary"
                          size="sm"
                          disabled={readOnly}
                          onClick={() => {
                            setMode('BUILD');
                            setText(item.userText ?? '');
                          }}
                          data-testid="ed-go-build"
                        >
                          Перейти в сборку
                        </Button>
                      )}
                      {payload.suggestPublish && (
                        <Link className="btn btn--secondary btn--sm" href="/marketing/site" data-testid="ed-go-publish">
                          Перейти к публикации
                        </Link>
                      )}
                    </div>
                  </div>
                )}
                {item.status === 'SUCCEEDED' && payload?.kind === 'QUESTIONS' && (
                  <div className="ed-chat__reply">
                    {item.assistantText && <p>{item.assistantText}</p>}
                    <Questions payload={payload} disabled={readOnly || busy || item.id !== lastId} onAnswer={(answers) => onAnswer(item.id, answers)} />
                  </div>
                )}
                {item.status === 'SUCCEEDED' && payload?.kind === 'PLAN' && (
                  <div className="ed-chat__reply">
                    {items.some((b) => b.fromPlanId === item.id) ? (
                      <p data-testid="ed-plan-done">
                        <b>{payload.summary}</b>: собрано по этому плану.
                      </p>
                    ) : (
                      <Plan payload={payload} disabled={readOnly || busy} onApprove={(instruction) => onApprove(item.id, instruction)} />
                    )}
                  </div>
                )}
                {item.status === 'SUCCEEDED' && payload?.kind === 'DESIGN' && (
                  <div className="ed-chat__reply">
                    <DesignCards directions={payload.directions} actionLabel="Применить оформление" disabled={readOnly} onChoose={onApplyDesign} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {error && (
        <p className="ed-error" role="alert" data-testid="ed-ai-send-error">
          {error}
        </p>
      )}
      <form
        className="ed-chat__composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
      >
        {building && target && (
          <p className="ed-chat__chip" data-testid="ed-ai-target">
            <span>Блок «{target}»</span>
            <Button type="button" tone="ghost" size="sm" aria-label="Убрать блок: изменить весь сайт" onClick={onClearTarget}>
              Весь сайт
            </Button>
          </p>
        )}
        <Field
          label={building && target ? 'Что изменить в этом блоке?' : LABEL[mode]}
          controlId="ed-ai-text"
          hint={blocked ?? (building && target ? 'Можно оставить пустым: ИИ перепишет блок, сохранив его назначение.' : 'Ctrl+Enter отправляет.')}
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
          {building ? (dirty ? 'Сохранить и отправить' : 'Отправить') : mode === 'PLAN' ? 'Составить план' : 'Спросить'}
        </Button>
      </form>
    </div>
  );
}
