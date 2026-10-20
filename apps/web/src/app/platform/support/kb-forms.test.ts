import { describe, expect, it } from 'vitest';
import {
  kbEditorValues,
  kbPublishBlockReason,
  kbSaveCompletion,
  kbSaveRouting,
  type KbEditable,
  type KbEditorValues,
} from './kb-forms';

const values = (content: string): KbEditorValues => ({
  title: 'Проверка публикации',
  category: 'HOW_TO',
  visibility: 'PUBLIC_SUPPORT',
  content,
});

const publishBlock = (
  current: KbEditorValues,
  saved: KbEditorValues,
  options: { documentId?: string; savedDocumentId?: string; busy?: boolean } = {},
) =>
  kbPublishBlockReason({
    documentId: options.documentId ?? 'doc-b',
    savedDocumentId: options.savedDocumentId ?? 'doc-b',
    values: current,
    savedValues: saved,
    busy: options.busy ?? false,
  });

describe('редактор базы знаний C-P1-2', () => {
  it('блокирует публикацию изменённого текста и занятого редактора', () => {
    expect(publishBlock(values('B'), values('A'))).toBe('Сначала сохраните изменения.');
    expect(publishBlock(values('A'), values('A'), { busy: true })).toBe(
      'Дождитесь завершения операции.',
    );
  });

  it('после подтверждения повторно замечает новую правку и не разрешает публикацию', () => {
    expect(publishBlock(values('B'), values('B'))).toBeNull();
    expect(publishBlock(values('C'), values('B'))).toBe('Сначала сохраните изменения.');
  });

  it('сохранение B во время ввода C подтверждает B, но сохраняет C несохранённым', () => {
    const completion = kbSaveCompletion(
      { error: null, message: 'Сохранено.', createdId: null },
      values('B'),
      values('C'),
    );

    expect(completion.savedValues).toEqual(values('B'));
    expect(completion.result).toEqual({
      error: null,
      message: 'Сохранена отправленная версия. Сначала сохраните новые изменения.',
    });
    expect(publishBlock(values('C'), completion.savedValues!)).toBe('Сначала сохраните изменения.');
  });

  it('ошибка сохранения не подтверждает отправленный текст', () => {
    const completion = kbSaveCompletion(
      { error: 'Не удалось сохранить', message: null, createdId: null },
      values('B'),
      values('B'),
    );

    expect(completion.savedValues).toBeNull();
    expect(completion.result).toEqual({ error: 'Не удалось сохранить', message: null });
  });

  it('явное успешное сохранение разрешает публикацию соответствующей версии', () => {
    const completion = kbSaveCompletion(
      { error: null, message: 'Сохранено.', createdId: null },
      values('B'),
      values('B'),
    );

    expect(completion.savedValues).toEqual(values('B'));
    expect(completion.result).toEqual({ error: null, message: 'Сохранено.' });
    expect(publishBlock(values('B'), completion.savedValues!)).toBeNull();
  });

  it('после create B с текущим C остаётся на форме и следующий save использует созданный ID', () => {
    const created = kbSaveRouting({
      entryDocumentId: null,
      requestDocumentId: null,
      createdId: 'doc-created',
      savedValues: values('B'),
      currentValues: values('C'),
    });

    expect(created).toEqual({ effectiveDocumentId: 'doc-created', navigateToId: null });

    const updated = kbSaveRouting({
      entryDocumentId: null,
      requestDocumentId: created.effectiveDocumentId,
      createdId: null,
      savedValues: values('C'),
      currentValues: values('C'),
    });

    expect(updated).toEqual({ effectiveDocumentId: 'doc-created', navigateToId: 'doc-created' });
  });

  it('чистый initial create сохраняет прежний немедленный переход', () => {
    expect(
      kbSaveRouting({
        entryDocumentId: null,
        requestDocumentId: null,
        createdId: 'doc-created',
        savedValues: values('B'),
        currentValues: values('B'),
      }),
    ).toEqual({ effectiveDocumentId: 'doc-created', navigateToId: 'doc-created' });
  });

  it('смена документа сбрасывает значения и блокирует старое подтверждение', () => {
    const entryC: KbEditable = {
      id: 'doc-c',
      title: 'Документ C',
      category: 'KNOWN_ISSUE',
      visibility: 'PLATFORM_ADMIN_ONLY',
      content: 'Текст C',
      status: 'DRAFT',
    };
    const current = kbEditorValues(entryC);

    expect(current).toEqual({
      title: 'Документ C',
      category: 'KNOWN_ISSUE',
      visibility: 'PLATFORM_ADMIN_ONLY',
      content: 'Текст C',
    });
    expect(
      publishBlock(current, values('B'), { documentId: 'doc-c', savedDocumentId: 'doc-b' }),
    ).toBe('Документ изменился. Дождитесь загрузки.');
    expect(
      publishBlock(current, current, { documentId: 'doc-c', savedDocumentId: 'doc-c' }),
    ).toBeNull();
  });
});
