import { describe, expect, it } from 'vitest';
import { wizardClientEvent, wizardConfig, wizardSurvey } from './wizard-input';

describe('гостевой мастер: разбор ввода', () => {
  it('адрес сайта принимает только http и https, пустой разрешён', () => {
    expect(wizardConfig({ siteUrl: 'https://hostel.example.invalid/' }).siteUrl).toBe(
      'https://hostel.example.invalid/',
    );
    expect(wizardConfig({ siteUrl: '' }).siteUrl).toBe('');
    expect(() => wizardConfig({ siteUrl: 'hostel.example.invalid' })).toThrow('адрес сайта');
    expect(() => wizardConfig({ siteUrl: 'javascript:alert(1)' })).toThrow('адрес сайта');
    expect(() => wizardConfig({ siteUrl: `https://a.example.invalid/${'x'.repeat(600)}` })).toThrow();
  });

  it('отметки «найдено на сайте» хранятся списком имён полей', () => {
    expect(wizardConfig({ foundFields: 'businessName,niche' }).foundFields).toBe('businessName,niche');
  });

  it('опрос: три вопроса, лишнее поле и чужое значение отклоняются', () => {
    expect(wizardSurvey({ goal: 'Больше броней', leadsPerDay: '10-50', source: 'Google' })).toEqual({
      goal: 'Больше броней',
      leadsPerDay: '10-50',
      source: 'Google',
    });
    expect(wizardSurvey({})).toEqual({});
    expect(() => wizardSurvey({ leadsPerDay: 'много' })).toThrow('опроса');
    expect(() => wizardSurvey({ source: 'Telegram-канал' })).toThrow('опроса');
    expect(() => wizardSurvey({ goal: 'x'.repeat(1001) })).toThrow('опроса');
    expect(() => wizardSurvey({ password: '1' })).toThrow('опроса');
    expect(() => wizardSurvey('строка')).toThrow();
  });

  it('событие с клиента: только из белого списка, серверные события подделать нельзя', () => {
    expect(wizardClientEvent({ type: 'source_submitted' })).toBe('source_submitted');
    expect(wizardClientEvent({ type: 'testbot_cta' })).toBe('testbot_cta');
    expect(() => wizardClientEvent({ type: 'scan_completed' })).toThrow('событие');
    expect(() => wizardClientEvent({ type: 'complete' })).toThrow('событие');
    expect(() => wizardClientEvent(null)).toThrow();
  });
});
