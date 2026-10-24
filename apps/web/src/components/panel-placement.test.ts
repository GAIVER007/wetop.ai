import { describe, expect, it } from 'vitest';
import { panelBox, panelPlacement } from './panel-placement';

describe('panelPlacement: окно выбора периода не выходит за край экрана (владелец 23.10.2026)', () => {
  it('кнопка слева: окно от левого края кнопки', () => {
    expect(panelPlacement({ left: 100, right: 400, bottom: 60 }, 585, 1440)).toEqual({ left: 100, top: 68 });
  });
  it('кнопка у правого края: окно прижато правым краем к кнопке', () => {
    expect(panelPlacement({ left: 1000, right: 1300, bottom: 60 }, 585, 1440)).toEqual({ left: 715, top: 68 });
  });
  it('справа и слева от кнопки места мало: окно у края экрана с отступом 16', () => {
    expect(panelPlacement({ left: 300, right: 500, bottom: 60 }, 585, 900)).toEqual({ left: 299, top: 68 });
    expect(panelPlacement({ left: 5, right: 50, bottom: 60 }, 585, 900)).toEqual({ left: 16, top: 68 });
  });
  it('окно шире экрана без отступов: по центру', () => {
    expect(panelPlacement({ left: 300, right: 500, bottom: 60 }, 585, 600)).toEqual({ left: 7, top: 68 });
  });
});

describe('panelBox: окно по высоте всегда внутри экрана (тест «Отмена» 24.10.2026: окно уходило вниз, прокрутка двигала его)', () => {
  it('места снизу хватает: под кнопкой, высота до нижнего края с отступом', () => {
    expect(panelBox({ top: 40, bottom: 60 }, 500, 900)).toEqual({ top: 68, maxHeight: 816 });
  });
  it('снизу мало, сверху больше: над кнопкой, низ окна у кнопки', () => {
    expect(panelBox({ top: 700, bottom: 720 }, 500, 900)).toEqual({ top: 192, maxHeight: 500 });
  });
  it('окно выше доступного места сверху: от верхнего отступа, высота ограничена', () => {
    expect(panelBox({ top: 600, bottom: 620 }, 700, 800)).toEqual({ top: 16, maxHeight: 576 });
  });
  it('низкое окно браузера: всё равно не меньше 16 сверху и не ниже экрана', () => {
    const box = panelBox({ top: 300, bottom: 320 }, 500, 400);
    expect(box.top).toBeGreaterThanOrEqual(16);
    expect(box.top + box.maxHeight).toBeLessThanOrEqual(400 - 16);
  });
});
