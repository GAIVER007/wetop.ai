import { Fragment, type ReactNode } from 'react';

const NBSP = String.fromCharCode(0xa0);
const HYPHENATED = /([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+)/u;

/**
 * Типографика текста из словаря: слово через дефис («мини-отель», «койко-место») не рвётся на две строки,
 * тире не начинает строку. Сам текст не меняется — дефис остаётся обычным, поиск по странице работает.
 */
export function typo(text: string): ReactNode {
  const parts = text.replace(/ ([—–])/g, `${NBSP}$1`).split(HYPHENATED);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
