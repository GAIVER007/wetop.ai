'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CUSTOMER_CSV_MAX_BYTES,
  CUSTOMER_IMPORT_CHUNK_MAX_ROWS,
  CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES,
  canUndoCustomerImport,
  previewCustomerCsv,
  readCustomerCsv,
} from '@pms/domain';
import type {
  CustomerCsvFile,
  CustomerCsvMapping,
  CustomerCsvRow,
  CustomerCsvStatus,
  CustomerImportChunkInput,
  CustomerImportState,
  CustomerImportView,
} from '@pms/domain';
import { useConfirm } from '../../components/use-confirm';
import { Alert, Button, Field, Input, Select, Table } from '../../components/ui';
import {
  getCustomerImport,
  listCustomerImports,
  startCustomerImport,
  submitCustomerImport,
  undoCustomerImport,
  uploadCustomerImportRows,
} from './customer-import-actions';

const labels: Record<CustomerCsvStatus, string> = {
  ready: 'Готовы', warning: 'С замечаниями', duplicate: 'Повторы в файле', skipped: 'Пропустим',
};
const columns = { firstName: 'Колонка имени', lastName: 'Колонка фамилии', phone: 'Колонка телефона' };
const template = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent('Имя;Фамилия;Телефон\r\nТестовый;Клиент;7000001001\r\n');
const activeStates: CustomerImportState[] = ['QUEUED', 'PROCESSING', 'UNDOING'];
const stateLabels: Record<CustomerImportState, string> = {
  UPLOADING: 'Загрузка файла', QUEUED: 'В очереди', PROCESSING: 'Импортируем', COMPLETED: 'Завершён',
  FAILED: 'Остановлен с ошибкой', UNDOING: 'Отменяем', UNDONE: 'Отменён',
};
type Preview = ReturnType<typeof previewCustomerCsv>;

function importRows(rows: CustomerCsvRow[]): CustomerImportChunkInput['rows'] {
  return rows.map((row) => ({
    sourceLine: row.line, firstName: row.firstName, lastName: row.lastName, phone: row.phone,
  }));
}

/** Пакет ограничивается по реальному UTF-8 JSON, который уйдёт в API, а не по числу символов. */
export function packCustomerImportRows(rows: CustomerImportChunkInput['rows']): CustomerImportChunkInput[] {
  const encoder = new TextEncoder();
  const chunks: CustomerImportChunkInput[] = [];
  let offset = 0;
  while (offset < rows.length) {
    const packed: CustomerImportChunkInput['rows'] = [];
    while (offset + packed.length < rows.length && packed.length < CUSTOMER_IMPORT_CHUNK_MAX_ROWS) {
      const next = [...packed, rows[offset + packed.length]!];
      if (encoder.encode(JSON.stringify({ offset, rows: next })).byteLength > CUSTOMER_IMPORT_ENVELOPE_MAX_BYTES) break;
      packed.push(next.at(-1)!);
    }
    if (!packed.length) throw new Error('Одна строка не помещается в безопасную часть импорта. Проверьте файл.');
    chunks.push({ offset, rows: packed });
    offset += packed.length;
  }
  return chunks;
}

function ImportProgress({ job }: { job: CustomerImportView }) {
  const progress = job.state === 'UPLOADING' ? job.uploadedRows : job.processedRows;
  return <section aria-label="Состояние импорта клиентов">
    <h3>Последний импорт: {stateLabels[job.state]}</h3>
    <progress max={job.totalRows} value={progress} aria-label="Прогресс импорта" />
    <p>{progress} из {job.totalRows} строк</p>
    <dl className="beauty-facts">
      <div><dt>Созданы</dt><dd>{job.createdCount}</dd></div>
      <div><dt>Связаны с салоном</dt><dd>{job.linkedCount}</dd></div>
      <div><dt>Уже были в салоне</dt><dd>{job.unchangedCount}</dd></div>
      <div><dt>Пропущены</dt><dd>{job.skippedCount}</dd></div>
    </dl>
    {job.contentsExpired && <p className="muted">Детали строк удалены по сроку хранения.</p>}
    {job.errorCode && <Alert boxed>Импорт остановлен. Проверьте файл и повторите импорт после исправления.</Alert>}
  </section>;
}

export function ImportCustomers({ businessId, canImport = false }: { businessId: string; canImport?: boolean }) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [file, setFile] = useState<CustomerCsvFile | null>(null);
  const [sourceKey, setSourceKey] = useState('');
  const [mapping, setMapping] = useState<CustomerCsvMapping>({ firstName: null, lastName: null, phone: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Preview | null>(null);
  const [job, setJob] = useState<CustomerImportView | null>(null);
  const [backgroundError, setBackgroundError] = useState('');
  const [offerSeparate, setOfferSeparate] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const request = useRef(0);
  const importRequest = useRef<{ key: string; id: string } | null>(null);
  const refreshed = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const showError = useCallback((message: string) => {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!canImport || !businessId) return;
    let active = true;
    startTransition(async () => {
      const result = await listCustomerImports(businessId);
      if (!active) return;
      if (result.error) setBackgroundError(result.error);
      else { setBackgroundError(''); setJob(result.items?.[0] ?? null); }
    });
    return () => { active = false; };
  }, [businessId, canImport, showError]);

  useEffect(() => {
    if (!job || !activeStates.includes(job.state)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      startTransition(async () => {
        const result = await getCustomerImport(businessId, job.id);
        if (!active) return;
        if (result.item) {
          setBackgroundError('');
          setJob(result.item);
          if (active) timer = setTimeout(poll, 1500);
        } else if (result.error) setBackgroundError(result.error);
      });
    };
    timer = setTimeout(poll, 1500);
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [businessId, job?.id, job?.state, showError]);

  useEffect(() => {
    if (!job?.undoDeadline) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [job?.undoDeadline]);

  useEffect(() => {
    if (job?.state === 'COMPLETED' && refreshed.current !== job.id) {
      refreshed.current = job.id;
      router.refresh();
    }
  }, [job, router]);

  async function load(selected: File | undefined) {
    const id = ++request.current;
    setFile(null); setChecked(null); setError(''); setLoading(false); setSourceKey('');
    importRequest.current = null;
    if (!selected) return;
    if (!/\.csv$/i.test(selected.name)) {
      showError('Выберите CSV. Файл Excel сначала сохраните в формате CSV.'); return;
    }
    if (selected.size > CUSTOMER_CSV_MAX_BYTES) {
      showError('Файл больше 10 МБ. Разделите его на несколько CSV.'); return;
    }
    setLoading(true);
    try {
      const bytes = await selected.arrayBuffer();
      if (id !== request.current) return;
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder('windows-1251').decode(bytes); }
      const parsed = readCustomerCsv(text);
      setFile(parsed); setMapping(parsed.mapping);
      setSourceKey(`${selected.name}:${selected.size}:${selected.lastModified}`);
    } catch (cause) {
      if (id === request.current)
        showError(cause instanceof Error ? cause.message : 'Не удалось прочитать CSV. Выберите файл ещё раз.');
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
    } catch (cause) {
      setChecked(null);
      showError(cause instanceof Error ? cause.message : 'Проверьте колонки');
    }
  }

  function beginImport(separate = false) {
    if (!checked || !canImport || pending) return;
    setError('');
    setBackgroundError('');
    startTransition(async () => {
      try {
        const key = `${sourceKey}:${JSON.stringify(mapping)}`;
        const rows = importRows(checked.rows);
        let current: CustomerImportView;
        if (!separate && job?.state === 'UPLOADING') {
          if (job.totalRows !== rows.length) {
            setOfferSeparate(true);
            return showError('Открытый импорт создан для другого числа строк. Выберите исходный файл и колонки или начните отдельный импорт.');
          }
          // Повторяем пакеты с нулевого смещения: сервер сверит receipt каждого уже принятого пакета.
          current = job;
        } else {
          if (!importRequest.current || importRequest.current.key !== key)
            importRequest.current = { key, id: crypto.randomUUID() };
          const started = await startCustomerImport(businessId, {
            clientRequestId: importRequest.current.id, totalRows: rows.length,
          });
          if (!started.item) return showError(started.error ?? 'Не удалось начать импорт.');
          current = started.item;
        }
        setOfferSeparate(false);
        setJob(current);
        for (const chunk of packCustomerImportRows(rows)) {
          const uploaded = await uploadCustomerImportRows(businessId, current.id, chunk);
          if (!uploaded.item) {
            if (job?.state === 'UPLOADING') setOfferSeparate(true);
            return showError(uploaded.error ?? 'Не удалось загрузить часть файла.');
          }
          current = uploaded.item;
          setJob(current);
        }
        const submitted = await submitCustomerImport(businessId, current.id);
        if (!submitted.item) return showError(submitted.error ?? 'Не удалось запустить импорт.');
        setJob(submitted.item);
      } catch (cause) {
        showError(cause instanceof Error ? cause.message : 'Не удалось подготовить импорт.');
      }
    });
  }

  function refreshState() {
    if (!canImport || pending) return;
    setError('');
    startTransition(async () => {
      const result = job
        ? await getCustomerImport(businessId, job.id)
        : await listCustomerImports(businessId);
      if (result.error) showError(result.error);
      else {
        setBackgroundError('');
        setJob(result.item ?? result.items?.[0] ?? null);
      }
    });
  }

  async function requestUndo() {
    if (!job?.undoDeadline || !canUndoCustomerImport(new Date(job.undoDeadline), now)) return;
    if (!(await ask({
      title: 'Отменить импорт клиентов?',
      body: 'Удалятся только карточки и связи, созданные этим импортом. Если клиент уже использован или изменён, сервер остановит отмену.',
      confirmLabel: 'Отменить импорт',
      tone: 'danger',
    }))) return;
    setError('');
    startTransition(async () => {
      const result = await undoCustomerImport(businessId, job.id);
      if (result.item) { setJob(result.item); router.refresh(); }
      else showError(result.error ?? 'Не удалось отменить импорт.');
    });
  }

  const mayUndo = Boolean(
    canImport && job && (job.state === 'COMPLETED' || job.state === 'FAILED') &&
    job.undoDeadline && canUndoCustomerImport(new Date(job.undoDeadline), now),
  );

  return <div className="beauty-form">
    <p>Проверьте файл перед переносом. Проверка выполняется на этом устройстве.</p>
    <p className="muted">Карточки с одинаковым телефоном не объединяются и не перезаписываются: импорт использует существующего клиента.</p>
    <a href={template} download="wetop-customers-template.csv">Скачать шаблон CSV</a>
    <Field label="CSV с клиентами"><Input type="file" accept=".csv,text/csv" disabled={pending} onChange={(e) => void load(e.target.files?.[0])} /></Field>
    <p className="muted">До 50 000 строк и 10 МБ. Поддерживаются UTF-8 и Windows-1251, разделители: точка с запятой, запятая и табуляция.</p>
    {loading && <p role="status">Читаем файл…</p>}
    {error && <div role="alert" className="alert alert--boxed" tabIndex={-1} ref={errorRef}>{error}</div>}
    {canImport && backgroundError && <div role="status">
      <p>{backgroundError}</p>
      <Button type="button" tone="secondary" disabled={pending} onClick={refreshState}>Обновить состояние</Button>
    </div>}
    {file && <>
      <p>Строк в файле: {file.records.length}. Сопоставьте колонки. Имя или телефон обязательны.</p>
      <p className="muted">Сейчас проверяются имя, фамилия и телефон. Остальные колонки не используются.</p>
      {(Object.keys(columns) as (keyof CustomerCsvMapping)[]).map((key) => <Field key={key} label={columns[key]}>
        <Select value={mapping[key] ?? ''} disabled={pending} onChange={(e) => {
          setMapping({ ...mapping, [key]: e.target.value === '' ? null : Number(e.target.value) });
          setChecked(null); setError(''); importRequest.current = null;
        }}>
          <option value="">Не выбрана</option>
          {file.headers.map((name, index) => <option key={index} value={index}>{index + 1}. {name || 'Без заголовка'}</option>)}
        </Select>
      </Field>)}
      <Button type="button" disabled={pending} onClick={check}>Проверить строки</Button>
    </>}
    {checked && <div>
      <h3 ref={resultRef} tabIndex={-1}>{job && job.state !== 'UPLOADING' ? 'Проверка файла завершена. Результат последнего импорта ниже.' : 'Проверка завершена. Данные ещё не импортированы.'}</h3>
      <p>Повторы проверены только внутри файла. Совпадения с базой салона проверит сервер при импорте.</p>
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
      {canImport && <Button type="button" disabled={pending} onClick={() => beginImport()}>
        {pending ? 'Сохраняем состояние…' : `Импортировать ${checked.rows.length} строк`}
      </Button>}
      {canImport && offerSeparate && <>
        <p className="muted">Незавершённый импорт останется в журнале. Новый получит отдельный идентификатор.</p>
        <Button type="button" tone="secondary" disabled={pending} onClick={() => beginImport(true)}>Начать отдельный импорт</Button>
      </>}
    </div>}
    {canImport && job && <>
      <ImportProgress job={job} />
      {mayUndo && <Button type="button" tone="danger" disabled={pending} onClick={() => void requestUndo()}>Отменить импорт</Button>}
    </>}
    {canImport && pending && <p role="status">Обновляем состояние импорта…</p>}
    {dialog}
  </div>;
}
