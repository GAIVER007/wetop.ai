'use client';
import { useRef, useState } from 'react';
import { CUSTOMER_CSV_MAX_BYTES, readCustomerCsv, previewCustomerCsv } from '@pms/domain';
import type { CustomerCsvFile, CustomerCsvMapping, CustomerCsvStatus } from '@pms/domain';
import { Button, Field, Input, Select, Table } from '../../components/ui';

const labels: Record<CustomerCsvStatus, string> = { ready: 'Готовы', warning: 'С замечаниями', duplicate: 'Повторы в файле', skipped: 'Пропустим' };
const columns = { firstName: 'Колонка имени', lastName: 'Колонка фамилии', phone: 'Колонка телефона' };
const template = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent('Имя;Фамилия;Телефон\r\nТестовый;Клиент;7000001001\r\n');

/** Только локальная проверка. Запись и объединение клиентов этим компонентом не выполняются. */
export function ImportCustomers() {
  const [file, setFile] = useState<CustomerCsvFile | null>(null);
  const [mapping, setMapping] = useState<CustomerCsvMapping>({ firstName: null, lastName: null, phone: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<ReturnType<typeof previewCustomerCsv> | null>(null);
  const request = useRef(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const showError = (message: string) => { setError(message); requestAnimationFrame(() => errorRef.current?.focus()); };
  async function load(selected: File | undefined) {
    const id = ++request.current;
    setFile(null); setChecked(null); setError(''); setLoading(false);
    if (!selected) return;
    if (!/\.csv$/i.test(selected.name)) { showError('Выберите CSV. Файл Excel сначала сохраните в формате CSV.'); return; }
    if (selected.size > CUSTOMER_CSV_MAX_BYTES) { showError('Файл больше 10 МБ. Разделите его на несколько CSV.'); return; }
    setLoading(true);
    try {
      const bytes = await selected.arrayBuffer();
      if (id !== request.current) return;
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder('windows-1251').decode(bytes); }
      const parsed = readCustomerCsv(text);
      setFile(parsed); setMapping(parsed.mapping);
    } catch (cause) {
      if (id === request.current) showError(cause instanceof Error ? cause.message : 'Не удалось прочитать CSV. Выберите файл ещё раз.');
    } finally { if (id === request.current) setLoading(false); }
  }
  function check() {
    if (!file) return;
    setError('');
    try {
      setChecked(previewCustomerCsv(file, mapping));
      requestAnimationFrame(() => {
        resultRef.current?.focus({ preventScroll: true });
        resultRef.current?.scrollIntoView({ block: 'center' });
      });
    } catch (cause) { setChecked(null); showError(cause instanceof Error ? cause.message : 'Проверьте колонки'); }
  }
  return <div className="beauty-form">
    <p>Проверьте файл перед переносом. Клиенты пока не сохраняются. Проверка выполняется на этом устройстве.</p>
    <a href={template} download="wetop-customers-template.csv">Скачать шаблон CSV</a>
    <Field label="CSV с клиентами"><Input type="file" accept=".csv,text/csv" onChange={(e) => void load(e.target.files?.[0])} /></Field>
    <p className="muted">До 50 000 строк и 10 МБ. Поддерживаются UTF-8 и Windows-1251, разделители: точка с запятой, запятая и табуляция.</p>
    {loading && <p role="status">Читаем файл…</p>}
    {error && <div role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    {file && <>
      <p>Строк в файле: {file.records.length}. Сопоставьте колонки. Имя или телефон обязательны.</p>
      <p className="muted">Сейчас проверяются имя, фамилия и телефон. Остальные колонки не используются.</p>
      {(Object.keys(columns) as (keyof CustomerCsvMapping)[]).map((key) => <Field key={key} label={columns[key]}>
        <Select value={mapping[key] ?? ''} onChange={(e) => {
          setMapping({ ...mapping, [key]: e.target.value === '' ? null : Number(e.target.value) }); setChecked(null); setError('');
        }}>
          <option value="">Не выбрана</option>
          {file.headers.map((name, index) => <option key={index} value={index}>{index + 1}. {name || 'Без заголовка'}</option>)}
        </Select>
      </Field>)}
      <Button type="button" onClick={check}>Проверить строки</Button>
    </>}
    {checked && <div>
      <h3 ref={resultRef} tabIndex={-1}>Проверка завершена. Данные ещё не импортированы.</h3>
      <p>Повторы проверены только внутри файла. Совпадения с базой салона здесь не проверяются.</p>
      {(Object.keys(labels) as CustomerCsvStatus[]).map((status) => <section key={status}>
        <h4>{labels[status]}: {checked.counts[status]}</h4>
        {checked.counts[status] > 0 && <>
          <p className="muted">Первые 5 строк этой группы</p>
          <Table className="beauty-customers-table" aria-label={labels[status]}><thead><tr><th>Строка</th><th>Клиент</th><th>Телефон</th><th>Проверка</th></tr></thead>
            <tbody>{checked.rows.filter((row) => row.status === status).slice(0, 5).map((row) => <tr key={row.line}>
              <td data-label="Строка">{row.line}</td><td data-label="Клиент">{[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Без имени'}</td>
              <td data-label="Телефон">{row.phoneNormalized ?? (row.phone || 'Нет телефона')}</td><td data-label="Проверка">{row.reason}</td>
            </tr>)}</tbody></Table>
        </>}
      </section>)}
    </div>}
  </div>;
}
