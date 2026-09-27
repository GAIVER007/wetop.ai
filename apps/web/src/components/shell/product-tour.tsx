'use client';
import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DeskShell } from '../../lib/desk-person';
import {
  TOUR_RESTART_EVENT,
  shouldAutoStartTour,
  tourStepsFor,
  type ShownStep,
} from './tour-steps';
import './product-tour.css';

/** Элемент шага на экране: есть в разметке и у него есть размер (свёрнутое меню телефона не в счёт). */
function findTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

function readDone(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'done';
  } catch {
    return true; // хранилище закрыто (приватный режим) — сам не навязываемся, из меню открыть можно
  }
}

function markDone(key: string | null) {
  if (!key) return;
  try {
    localStorage.setItem(key, 'done');
  } catch {
    /* Отметка — удобство, без неё тур просто предложится ещё раз. */
  }
}

type Box = { top: number; left: number; width: number; height: number };

const CARD_W = 360;
const GAP = 16;
const PAD = 6;

/** Где встать карточке: справа от элемента, если есть место; иначе под ним; иначе над ним. Без элемента — центр. */
function cardPosition(box: Box | null): { top: number; left: number } | null {
  if (!box) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (top: number) => Math.max(GAP, Math.min(top, vh - 260));
  const clampLeft = (left: number) => Math.max(GAP, Math.min(left, vw - CARD_W - GAP));
  if (box.left + box.width + GAP + CARD_W + GAP <= vw) {
    return { top: clampTop(box.top), left: box.left + box.width + GAP };
  }
  if (box.top + box.height + GAP + 220 <= vh) {
    return { top: box.top + box.height + GAP, left: clampLeft(box.left) };
  }
  return { top: clampTop(box.top - GAP - 240), left: clampLeft(box.left) };
}

/**
 * Обучение в стойке (plans/site-auth-dialog-tour-2026-09-27.md, Д4, ADR-100; DESIGN.md §8 «Обучение»).
 * Сам стартует один раз на Главной у вошедшего; повтор — пункт меню профиля (событие `TOUR_RESTART_EVENT`).
 * Окно — нативный `<dialog>` на весь экран (§13): фокус внутри, Escape закрывает. Подсветка — вырез в затемнении
 * над элементом `data-tour`; элемента нет — карточка по центру.
 */
export function ProductTour({ desk, path }: { desk: Promise<DeskShell> | undefined; path: string }) {
  const shell = desk ? use(desk) : null;
  const key = shell?.tourKey ?? null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [steps, setSteps] = useState<ShownStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const start = useCallback(() => {
    setSteps(tourStepsFor((target) => findTarget(target) !== null));
    setIndex(0);
  }, []);

  const finish = useCallback(() => {
    markDone(key);
    setSteps(null);
    dialogRef.current?.close();
  }, [key]);

  // Сам — один раз на Главной; меню ещё дорисовывается (Suspense), поэтому с короткой паузой
  useEffect(() => {
    if (!shouldAutoStartTour({ path, key, done: key ? readDone(key) : true })) return;
    const id = window.setTimeout(start, 600);
    return () => window.clearTimeout(id);
  }, [path, key, start]);

  useEffect(() => {
    window.addEventListener(TOUR_RESTART_EVENT, start);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, start);
  }, [start]);

  const step = steps?.[index] ?? null;

  // Открыть окно и держать вырез над элементом при прокрутке и смене размера окна
  useLayoutEffect(() => {
    if (!step) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const measure = () => {
      const el = step.highlight && step.target ? findTarget(step.target) : null;
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD });
    };
    const el = step.highlight && step.target ? findTarget(step.target) : null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    measure();
    nextRef.current?.focus();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  if (!steps || !step) return null;

  const last = index === steps.length - 1;
  const position = cardPosition(box);
  const go = (delta: number) => setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));

  return (
    <dialog
      ref={dialogRef}
      className="tour"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      data-testid="product-tour"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' && !last) go(1);
        if (event.key === 'ArrowLeft') go(-1);
      }}
    >
      {box ? (
        <div
          className="tour__hole"
          aria-hidden="true"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      ) : (
        <div className="tour__dim" aria-hidden="true" />
      )}
      <div
        className={position ? 'tour__card' : 'tour__card tour__card--center'}
        style={position ? { top: position.top, left: position.left } : undefined}
      >
        <p className="tour__count">
          {index + 1} из {steps.length}
        </p>
        <h2 id="tour-title" className="tour__title">
          {step.title}
        </h2>
        <p id="tour-text" className="tour__text">
          {step.text}
        </p>
        <div className="tour__progress" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={i === index ? 'is-current' : i < index ? 'is-done' : undefined} />
          ))}
        </div>
        <div className="tour__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={finish}>
            {last ? 'Закрыть' : 'Пропустить'}
          </button>
          <span className="tour__nav">
            {index > 0 && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => go(-1)}>
                Назад
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              className="btn btn--sm"
              onClick={() => (last ? finish() : go(1))}
            >
              {last ? 'Начать работу' : 'Далее'}
            </button>
          </span>
        </div>
      </div>
    </dialog>
  );
}
