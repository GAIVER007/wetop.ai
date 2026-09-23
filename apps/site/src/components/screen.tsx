import type { ReactNode } from 'react';

export type ScreenKind = 'board' | 'channels' | 'folio';

/*
 * Мини-экраны для карточек витрины: рисунок на SVG, без снимков и фотографий. Цвета — через классы
 * `screen__*` в globals.css, то есть из токенов: в тёмной теме экраны перекрашиваются сами.
 * Картинка декоративная — подпись всегда стоит рядом заголовком карточки.
 */
export function Screen({ kind }: { kind: ScreenKind }) {
  return (
    <svg viewBox="0 0 160 110" role="presentation" focusable="false">
      {SCREENS[kind]}
    </svg>
  );
}

const board = (
  <>
    <rect className="screen__frame" x="8" y="26" width="144" height="76" rx="6" />
    <path className="screen__line" d="M8 42h144M8 58h144M8 74h144M8 90h144M44 26v76" />
    <rect className="screen__bar" x="48" y="46" width="42" height="8" rx="4" />
    <rect className="screen__bar screen__bar--in" x="96" y="62" width="34" height="8" rx="4" />
    <rect className="screen__bar" x="52" y="78" width="58" height="8" rx="4" />
    <rect className="screen__bar screen__bar--soft" x="112" y="94" width="30" height="8" rx="4" />
    <text className="screen__text" x="12" y="50">
      Номер 12
    </text>
    <text className="screen__text" x="12" y="66">
      Койка 5
    </text>
    <text className="screen__text" x="12" y="82">
      Койка 6
    </text>
    <text className="screen__text" x="12" y="98">
      Койка 7
    </text>
  </>
);

const channels = (
  <>
    <rect className="screen__frame" x="52" y="42" width="56" height="26" rx="8" />
    <text className="screen__value" x="64" y="59">
      WETOP
    </text>
    <path className="screen__accent" d="M52 55H26M108 55h26M80 42V26M80 68v16" />
    <circle className="screen__dot" cx="22" cy="55" r="5" />
    <circle className="screen__dot" cx="138" cy="55" r="5" />
    <circle className="screen__dot" cx="80" cy="22" r="5" />
    <circle className="screen__dot" cx="80" cy="88" r="5" />
    <text className="screen__text" x="8" y="44">
      Каналы
    </text>
    <text className="screen__text" x="118" y="44">
      Остатки
    </text>
    <text className="screen__text" x="94" y="24">
      Брони
    </text>
    <text className="screen__text" x="94" y="92">
      Цены
    </text>
  </>
);

const folio = (
  <>
    <rect className="screen__frame" x="18" y="18" width="124" height="80" rx="8" />
    <path className="screen__line" d="M30 40h100M30 54h100M30 68h100" />
    <rect className="screen__bar screen__bar--soft" x="30" y="76" width="100" height="14" rx="5" />
    <text className="screen__text" x="30" y="36">
      Проживание
    </text>
    <text className="screen__text" x="30" y="50">
      Оплата
    </text>
    <text className="screen__text" x="30" y="64">
      Возврат
    </text>
    <text className="screen__value" x="34" y="87">
      Итого до тиына
    </text>
  </>
);

const SCREENS: Record<ScreenKind, ReactNode> = { board, channels, folio };
