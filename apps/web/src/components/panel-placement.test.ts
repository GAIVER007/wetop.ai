import { describe, expect, it } from 'vitest';
import { panelPlacement } from './panel-placement';

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
