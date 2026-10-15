import { describe, expect, it } from 'vitest';
import { competitorStatus, permilleText } from './competitor-status';

describe('статус конкурента по свежести внесённых данных', () => {
  it('нет ни загрузки, ни цен: «Нет данных»', () => {
    expect(competitorStatus('2026-10-09', null, null)).toEqual({ tone: 'neutral', label: 'Нет данных' });
  });
  it('внесено сегодня или вчера: «Актуально»; берётся более свежее из двух', () => {
    expect(competitorStatus('2026-10-09', '2026-10-09', null).label).toBe('Актуально');
    expect(competitorStatus('2026-10-09', '2026-10-01', '2026-10-08')).toEqual({ tone: 'success', label: 'Актуально' });
  });
  it('старше суток: «Устарели» с датой', () => {
    expect(competitorStatus('2026-10-09', '2026-10-07', null)).toEqual({ tone: 'warning', label: 'Устарели, с 07.10' });
  });
});

describe('изменение цены, десятые доли процента', () => {
  it('знак, запятая, ноль без знака; нет сравнения это тире', () => {
    expect(permilleText(50)).toBe('+5 %');
    expect(permilleText(-125)).toBe('−12,5 %');
    expect(permilleText(0)).toBe('0 %');
    expect(permilleText(null)).toBe('–');
  });
});
