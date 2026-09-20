import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_NAME_MAX,
  PERSON_NAME_MAX,
  isOrganizationNameShaped,
  isPersonNameShaped,
  normalizeOrganizationName,
  normalizePersonName,
  workspaceNameFor,
} from './registration';

describe('normalizeOrganizationName', () => {
  it('обрезает края и схлопывает пробелы внутри', () => {
    expect(normalizeOrganizationName('  Хостел   «Пример»\t\n')).toBe('Хостел «Пример»');
  });
  it('обычное название не трогает', () => {
    expect(normalizeOrganizationName('Luxx Aparts')).toBe('Luxx Aparts');
  });
});

describe('isOrganizationNameShaped', () => {
  it('одна буква — уже название', () => {
    expect(isOrganizationNameShaped('Я')).toBe(true);
  });
  it('пустая строка и одни пробелы — нет', () => {
    expect(isOrganizationNameShaped('')).toBe(false);
    expect(isOrganizationNameShaped('   \t ')).toBe(false);
  });
  it(`ровно ${ORGANIZATION_NAME_MAX} знаков проходит, на один больше — нет: столько влезает в колонку`, () => {
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX))).toBe(true);
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX + 1))).toBe(false);
  });
  it('длина считается после схлопывания пробелов', () => {
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX) + '     ')).toBe(true);
  });
});

describe('имя человека при регистрации', () => {
  it('обрезает края и схлопывает пробелы — как у названия организации', () => {
    expect(normalizePersonName('  Вячеслав   Петров \t')).toBe('Вячеслав Петров');
  });
  it('пустое имя не принимаем: в форме три поля, и это одно из них', () => {
    expect(isPersonNameShaped('')).toBe(false);
    expect(isPersonNameShaped('   ')).toBe(false);
  });
  it(`ровно ${PERSON_NAME_MAX} знаков проходит, на один больше — нет: столько влезает в колонку`, () => {
    expect(isPersonNameShaped('я'.repeat(PERSON_NAME_MAX))).toBe(true);
    expect(isPersonNameShaped('я'.repeat(PERSON_NAME_MAX + 1))).toBe(false);
  });
});

describe('workspaceNameFor', () => {
  // Отдельного поля «название» в форме нет (решение владельца 20.09.2026: почта, имя, пароль),
  // а organizations.name пустым быть не может — берём имя человека.
  it('рабочее пространство названо именем человека', () => {
    expect(workspaceNameFor('  Вячеслав  Петров ')).toBe('Вячеслав Петров');
  });
  it('слишком длинное имя обрезается по размеру колонки, а не роняет вставку', () => {
    expect(workspaceNameFor('я'.repeat(ORGANIZATION_NAME_MAX + 50))).toHaveLength(
      ORGANIZATION_NAME_MAX,
    );
  });
});
