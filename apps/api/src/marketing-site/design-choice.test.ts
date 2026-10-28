import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DESIGN_PRESETS, decodeDesignInstruction, encodeDesignInstruction } from '@pms/domain';
import { designAudit, parseDesignChoice } from './design-choice';

/**
 * SITE-1: первая сборка с готовым оформлением по id (`designPresetId`). Направление сервер берёт из набора домена,
 * браузер тему не передаёт; неизвестный id и смешение с выбором из ответа ИИ это 400.
 */
const RUN = '3f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';

describe('parseDesignChoice', () => {
  it('без полей оформления: null (сборка без выбранного направления)', () => {
    expect(parseDesignChoice({ requestKey: RUN })).toBeNull();
  });

  it('готовое оформление: направление из набора домена, ровно форма DesignDirection', () => {
    const choice = parseDesignChoice({ designPresetId: 'deep-premium' });
    if (!choice || !('preset' in choice)) throw new Error('ожидалось готовое оформление');
    const preset = choice.preset;
    expect(preset.id).toBe('deep-premium');
    expect(preset.theme).toEqual(DESIGN_PRESETS.find((p) => p.id === 'deep-premium')!.theme);
    expect(Object.keys(preset)).not.toContain('family');
    // конверт первой сборки тот же, что у выбора из ответа ИИ: воркер применяет тему платформой
    const envelope = encodeDesignInstruction(preset, 'Тише');
    expect(decodeDesignInstruction(envelope)?.design.id).toBe('deep-premium');
  });

  it.each([['nope'], [''], [5], [null], ['DEEP-PREMIUM'], ['x'.repeat(60)]])('неизвестный пресет %j: 400', (id) => {
    expect(() => parseDesignChoice({ designPresetId: id })).toThrow(BadRequestException);
  });

  it('пресет вместе с выбором из ответа ИИ: 400', () => {
    expect(() => parseDesignChoice({ designPresetId: 'light-minimal', designRunId: RUN, designId: 'night' })).toThrow(/либо designPresetId/);
    expect(() => parseDesignChoice({ designPresetId: 'light-minimal', designId: 'night' })).toThrow(BadRequestException);
  });

  it('выбор из ответа ИИ как раньше: id задачи в нижнем регистре; неполный или кривой: 400', () => {
    expect(parseDesignChoice({ designRunId: RUN.toUpperCase(), designId: 'night' })).toEqual({ runId: RUN, directionId: 'night' });
    expect(() => parseDesignChoice({ designRunId: RUN })).toThrow(BadRequestException);
    expect(() => parseDesignChoice({ designRunId: 'run-1', designId: 'night' })).toThrow(BadRequestException);
    expect(() => parseDesignChoice({ designRunId: RUN, designId: 'Night!' })).toThrow(BadRequestException);
  });
});

describe('designAudit: в журнал только id', () => {
  it('пресет, ответ ИИ и ничего', () => {
    expect(designAudit(parseDesignChoice({ designPresetId: 'warm-bright' }))).toEqual({ designPresetId: 'warm-bright' });
    expect(designAudit({ runId: RUN, directionId: 'night' })).toEqual({ designRunId: RUN, designId: 'night' });
    expect(designAudit(null)).toEqual({});
  });
});

describe('шаблон готового сайта как оформление первой сборки ИИ (SITE-1)', () => {
  it('id шаблона сегмента даёт его оформление; журнал пишет только id', () => {
    const choice = parseDesignChoice({ designPresetId: 'beauty-boutique' });
    if (!choice || !('preset' in choice)) throw new Error('ожидалось готовое оформление');
    expect(choice.preset.id).toBe('beauty-boutique');
    expect(choice.preset.theme.preset).toBe('NOIR');
    expect(designAudit(choice)).toEqual({ designPresetId: 'beauty-boutique' });
  });
});
