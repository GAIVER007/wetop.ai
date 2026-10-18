import { describe, expect, it } from 'vitest';
import { readCustomerCsv, previewCustomerCsv } from './customer-import';

describe('M4-B1 CSV: проверка без записи', () => {
  it.each([';', ',', '\t'])('BOM/CRLF и разделитель %s', (d) => {
    const file = readCustomerCsv(`\uFEFFИмя${d}Телефон\r\nТест${d}87000001001\r\n`);
    const report = previewCustomerCsv(file, file.mapping);
    expect(report.counts).toEqual({ ready: 1, warning: 0, duplicate: 0, skipped: 0 });
    expect(report.rows[0]).toMatchObject({ phoneNormalized: '+77000001001', firstName: 'Тест', line: 2 });
  });
  it('кавычки, разделитель и перенос внутри поля', () => {
    const file = readCustomerCsv('Имя;Телефон\n"Тест; ""один""\nдва";7000001001');
    expect(previewCustomerCsv(file, file.mapping).rows[0]?.firstName).toBe('Тест; "один"\nдва');
  });
  it('повтор канонического номера, отсутствие номера, пустая строка и плохой телефон', () => {
    const file = readCustomerCsv('Имя;Телефон\nПервый;87000001001\nВторой;+7 (700) 000-10-01\nБез номера;\n;\nПлохой;abc\n;+77000001002');
    const result = previewCustomerCsv(file, file.mapping);
    expect(result.counts).toEqual({ ready: 1, warning: 2, duplicate: 1, skipped: 2 });
    expect(result.rows[1]).toMatchObject({ status: 'duplicate', duplicateOf: 2 });
    expect(result.rows[3]).toMatchObject({ status: 'skipped', line: 5 });
    expect(result.rows[5]?.reason).toBe('Имя не указано: при импорте будет «Клиент»');
  });
  it('ручное сопоставление и отсутствие обязательных колонок', () => {
    const file = readCustomerCsv('A;B\n7000001001;Тест');
    expect(() => previewCustomerCsv(file, file.mapping)).toThrow('имени или телефона');
    expect(previewCustomerCsv(file, { firstName: 1, lastName: null, phone: 0 }).counts.ready).toBe(1);
    expect(() => previewCustomerCsv(file, { firstName: 0, lastName: null, phone: 0 })).toThrow('дважды');
  });
  it.each(['Имя;Телефон\n"Оборвано;7000001001', 'Имя;Телефон\n"Тест"oops;7000001001', 'Имя;Телефон\nТе"ст;7000001001'])('повреждённые кавычки отклоняются', (text) => {
    expect(() => readCustomerCsv(text)).toThrow('кавыч');
  });
  it('не принимает строки с лишними ячейками и слишком длинными полями', () => {
    const file = readCustomerCsv(`Имя;Телефон\nТест;7000001001;лишнее\n${'а'.repeat(101)};7000001002`);
    expect(previewCustomerCsv(file, file.mapping).counts.skipped).toBe(2);
  });
  it('пустые конечные ячейки можно опустить; сохраняются физические номера строк', () => {
    const file = readCustomerCsv('Имя;Телефон\n"Тест\nдва";7000001001\nБез номера');
    const result = previewCustomerCsv(file, file.mapping);
    expect(result.rows[1]).toMatchObject({ line: 4, status: 'warning' });
  });
  it('ограничивает количество строк 50 000', () => {
    expect(readCustomerCsv('Имя\n' + 'Тест\n'.repeat(50000)).records).toHaveLength(50000);
    expect(() => readCustomerCsv('Имя\n' + 'Тест\n'.repeat(50001))).toThrow('50 000');
  });
  it('не утрачивает нулевой индекс колонки и отвергает поддельные индексы', () => {
    const file = readCustomerCsv('Имя\nТест');
    expect(previewCustomerCsv(file, file.mapping).counts.warning).toBe(1);
    expect(() => previewCustomerCsv(file, { ...file.mapping, phone: 99 })).toThrow('колон');
    expect(() => readCustomerCsv('')).toThrow('пуст');
  });
});
