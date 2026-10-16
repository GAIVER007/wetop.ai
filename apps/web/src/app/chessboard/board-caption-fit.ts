'use client';
import { useEffect, type RefObject } from 'react';

/** Виден ли элемент и не помещается ли его содержимое (многоточие или вылезающая строка). */
const cut = (el: HTMLElement | null) =>
  !!el && el.getClientRects().length > 0 && el.scrollWidth > el.clientWidth;

/**
 * Подпись плашки по ширине выбирает CSS (container queries), но длину имени он не знает: «Гость Б.»
 * помещается в 72 px, «Посетитель Д.» в 78 уже нет. Здесь меряем сам текст: не влезло полное имя,
 * ставим «Имя Ф.»; не влезло и оно, инициалы. Полное имя всегда в подсказке плашки.
 */
export function fitCaptions(root: ParentNode) {
  for (const cap of root.querySelectorAll<HTMLElement>('.board-stay-caption')) {
    delete cap.dataset.fit;
    if (cut(cap.querySelector('.board-stay-name'))) cap.dataset.fit = 'short';
    if (cut(cap.querySelector('.board-stay-name-short'))) cap.dataset.fit = 'initials';
    // вторая строка: убираем по ступеням «заезд сегодня» (его же говорит столбец статуса), сумму долга
    // в точку, даты; ступень 3 без дат, источник остаётся
    delete cap.dataset.meta;
    const meta = cap.querySelector<HTMLElement>('.board-stay-line--meta');
    for (let step = 1; step <= 3 && cut(meta); step++) cap.dataset.meta = String(step);
  }
}

/** Перемер после отрисовки и при каждой смене ширины сетки (окно, масштаб, период). */
export function useCaptionFit(ref: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = requestAnimationFrame(() => fitCaptions(root));
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitCaptions(root));
    });
    const table = root.querySelector('table');
    observer.observe(table ?? root);
    // веб-шрифт шире запасного: после его загрузки текст растёт, а ширина сетки нет
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) fitCaptions(root);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, ...deps]);
}
