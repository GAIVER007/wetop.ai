/** Профиль выгрузки без вывода ПД: заголовки, число строк, заполненность, примеры только безопасных колонок. */
import ExcelJS from 'exceljs';
const file = process.argv[2]!;
/** Маска ПД по заголовку. Правило: сомневаешься — скрывай. Число гостей — не ПД, исключение ниже. */
const PII =
  /заказчик|плательщик|гост|фио|имя|фамил|отчеств|телефон|phone|mail|почт|паспорт|документ|удостовер|рожден|коммент|примеч|заметк|адрес|контакт|guest|name|customer/i;
const NOT_PII = /^количество гостей$/i;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
for (const ws of wb.worksheets) {
  console.log(`\n=== Лист «${ws.name}»: строк ${ws.rowCount}, колонок ${ws.columnCount} ===`);
  // ищем строку заголовков: первая строка, где ≥5 непустых текстовых ячеек
  let headerRow = 1;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const vals = (ws.getRow(r).values as unknown[]).filter(
      (v) => typeof v === 'string' && v.trim() !== '',
    );
    if (vals.length >= 5) {
      headerRow = r;
      break;
    }
  }
  const headers = (ws.getRow(headerRow).values as unknown[]).map((v) =>
    v == null ? '' : String(v).trim(),
  );
  console.log(`заголовки в строке ${headerRow}; строк данных: ${ws.rowCount - headerRow}`);
  headers.forEach((h, i) => {
    if (i === 0 || h === '') return;
    let filled = 0;
    const distinct = new Set<string>();
    const samples: string[] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const cell = ws.getRow(r).getCell(i).value;
      if (cell == null || cell === '') continue;
      filled++;
      const s =
        cell instanceof Date
          ? cell.toISOString().slice(0, 10)
          : typeof cell === 'object'
            ? JSON.stringify(cell).slice(0, 40)
            : String(cell);
      distinct.add(s);
      if (samples.length < 4 && !samples.includes(s)) samples.push(s);
    }
    const pii = PII.test(h) && !NOT_PII.test(h);
    const show = pii
      ? '(скрыто: возможные ПД)'
      : distinct.size <= 12
        ? [...distinct].slice(0, 12).join(' | ')
        : samples.map((s) => s.slice(0, 30)).join(' | ');
    console.log(
      `${String(i).padStart(2)}. ${h.padEnd(34).slice(0, 34)} заполнено ${String(filled).padStart(4)}  уник ${String(distinct.size).padStart(4)}  ${show}`,
    );
  });
}
