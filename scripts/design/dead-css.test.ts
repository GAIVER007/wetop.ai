import { describe, expect, it } from 'vitest';
import { classNames, deadClasses } from './dead-css';

/** Опись мёртвого CSS (MV8.5 DS0a): только разбор и сверка, ничего не удаляется. */
describe('dead-css: разбор селекторов', () => {
  it('берёт классы из селекторов, а не из значений, комментариев и @media', () => {
    const css = `
      /* .commented { } */
      .btn, .btn--primary:hover > .icon { color: var(--text); }
      @media (max-width: 600px) { .tile__value { font-size: var(--text-sm); } }
      .a[data-x="1.5"]::after { content: '.not-a-class'; width: 1.5rem; }
      :root { --x: .5; }
    `;
    expect(classNames(css)).toEqual(['a', 'btn', 'btn--primary', 'icon', 'tile__value']);
  });
});

describe('dead-css: сверка с исходниками', () => {
  const sources = [
    `<div className="btn btn--primary" />`,
    "<i className={`tone-${t}`} />",
    "const cls = 'tile__value';",
  ];
  it('живой класс не мёртвый, похожий на динамический помечается, а не считается мёртвым', () => {
    const report = deadClasses(['btn', 'btn--primary', 'tile__value', 'tone-ok', 'ghost'], sources);
    expect(report).toEqual([
      { name: 'ghost', dynamic: false },
      { name: 'tone-ok', dynamic: true },
    ]);
  });
});
