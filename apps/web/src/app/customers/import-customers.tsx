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
import { customerXlsxToCsv } from './xlsx-client';
import { msg, type Translate } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
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
  ready: msg('Готовы'), warning: msg('С замечаниями'), duplicate: msg('Повторы в файле'), skipped: msg('Пропустим'),
};
const columns = { firstName: msg('Колонка имени'), lastName: msg('Колонка фамилии'), phone: msg('Колонка телефона') };
const template = 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent('Имя;Фамилия;Телефон\r\nТестовый;Клиент;7000001001\r\n'); // kk-allow: шаблон файла, заголовки читает импорт
const activeStates: CustomerImportState[] = ['QUEUED', 'PROCESSING', 'UNDOING'];
const stateLabels: Record<CustomerImportState, string> = {
  UPLOADING: msg('Загрузка файла'), QUEUED: msg('В очереди'), PROCESSING: msg('Импортируем'), COMPLETED: msg('Завершён'),
  FAILED: msg('Остановлен с ошибкой'), UNDOING: msg('Отменяем'), UNDONE: msg('Отменён'),
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
    if (!packed.length) throw new Error(msg('Одна строка не помещается в безопасную часть импорта. Проверьте файл.'));
    chunks.push({ offset, rows: packed });
    offset += packed.length;
  }
  return chunks;
}

function ImportProgress({ job, t }: { job: CustomerImportView; t: Translate }) {
  const progress = job.state === 'UPLOADING' ? job.uploadedRows : job.processedRows;
  return <section aria-label={t('Состояние импорта клиентов')}>
    <h3>{t('Последний импорт: {state}', { state: t(stateLabels[job.state]) })}</h3>
    <progress max={job.totalRows} value={progress} aria-label={t('Прогресс импорта')} />
    <p>{t('{done} из {total} строк', { done: progress, total: job.totalRows })}</p>
    <dl className="beauty-facts">
      <div><dt>{t('Созданы')}</dt><dd>{job.createdCount}</dd></div>
      <div><dt>{t('Связаны с салоном')}</dt><dd>{job.linkedCount}</dd></div>
      <div><dt>{t('Уже были в салоне')}</dt><dd>{job.unchangedCount}</dd></div>
      <div><dt>{t('Пропущены')}</dt><dd>{job.skippedCount}</dd></div>
    </dl>
    {job.contentsExpired && <p className="muted">{t('Детали строк удалены по сроку хранения.')}</p>}
    {job.errorCode && <Alert boxed>{t('Импорт остановлен. Проверьте файл и повторите импорт после исправления.')}</Alert>}
  </section>;
}

export function ImportCustomers({ businessId, canImport = false }: { businessId: string; canImport?: boolean }) {
  const t = useT();
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
    const excel = /\.xlsx$/i.test(selected.name);
    if (!excel && !/\.csv$/i.test(selected.name)) {
      showError(t('Выберите файл CSV или Excel (XLSX).')); return;
    }
    if (selected.size > CUSTOMER_CSV_MAX_BYTES) {
      showError(t('Файл больше 10 МБ. Разделите его на несколько файлов.')); return;
    }
    setLoading(true);
    try {
      const bytes = await selected.arrayBuffer();
      if (id !== request.current) return;
      let text: string;
      if (excel) text = await customerXlsxToCsv(bytes, t);
      else {
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { text = new TextDecoder('windows-1251').decode(bytes); }
      }
      if (id !== request.current) return;
      const parsed = readCustomerCsv(text);
      setFile(parsed); setMapping(parsed.mapping);
      setSourceKey(`${selected.name}:${selected.size}:${selected.lastModified}`);
    } catch (cause) {
      if (id === request.current)
        showError(cause instanceof Error ? t(cause.message) : t('Не удалось прочитать файл. Выберите его ещё раз.'));
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
      showError(cause instanceof Error ? t(cause.message) : t('Проверьте колонки'));
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
            return showError(t('Открытый импорт создан для другого числа строк. Выберите исходный файл и колонки или начните отдельный импорт.'));
          }
          // Повторяем пакеты с нулевого смещения: сервер сверит receipt каждого уже принятого пакета.
          current = job;
        } else {
          if (!importRequest.current || importRequest.current.key !== key)
            importRequest.current = { key, id: crypto.randomUUID() };
          const started = await startCustomerImport(businessId, {
            clientRequestId: importRequest.current.id, totalRows: rows.length,
          });
          if (!started.item) return showError(started.error ?? t('Не удалось начать импорт.'));
          current = started.item;
        }
        setOfferSeparate(false);
        setJob(current);
        for (const chunk of packCustomerImportRows(rows)) {
          const uploaded = await uploadCustomerImportRows(businessId, current.id, chunk);
          if (!uploaded.item) {
            if (job?.state === 'UPLOADING') setOfferSeparate(true);
            return showError(uploaded.error ?? t('Не удалось загрузить часть файла.'));
          }
          current = uploaded.item;
          setJob(current);
        }
        const submitted = await submitCustomerImport(businessId, current.id);
        if (!submitted.item) return showError(submitted.error ?? t('Не удалось запустить импорт.'));
        setJob(submitted.item);
      } catch (cause) {
        showError(cause instanceof Error ? t(cause.message) : t('Не удалось подготовить импорт.'));
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
      title: t('Отменить импорт клиентов?'),
      body: t('Удалятся только карточки и связи, созданные этим импортом. Если клиент уже использован или изменён, сервер остановит отмену.'),
      confirmLabel: t('Отменить импорт'),
      tone: 'danger',
    }))) return;
    setError('');
    startTransition(async () => {
      const result = await undoCustomerImport(businessId, job.id);
      if (result.item) { setJob(result.item); router.refresh(); }
      else showError(result.error ?? t('Не удалось отменить импорт.'));
    });
  }

  const mayUndo = Boolean(
    canImport && job && (job.state === 'COMPLETED' || job.state === 'FAILED') &&
    job.undoDeadline && canUndoCustomerImport(new Date(job.undoDeadline), now),
  );

  return <div className="beauty-form">
    <p>{t('Проверьте файл перед переносом. Проверка выполняется на этом устройстве.')}</p>
    <p className="muted">{t('Карточки с одинаковым телефоном не объединяются и не перезаписываются: импорт использует существующего клиента.')}</p>
    <a href={template} download="wetop-customers-template.csv">{t('Скачать шаблон CSV')}</a>
    <Field label={t('Файл с клиентами: CSV или Excel')}><Input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={pending} onChange={(e) => void load(e.target.files?.[0])} /></Field>
    <p className="muted">{t('До 50 000 строк и 10 МБ. Excel: первый лист, первая строка с заголовками. CSV: UTF-8 или Windows-1251, разделители точка с запятой, запятая и табуляция.')}</p>
    {/* Одна живая область на окно: чтение файла и обновление состояния не объявляются двумя статусами сразу */}
    <p role="status" className="muted">{loading ? t('Читаем файл…') : canImport && pending ? t('Обновляем состояние импорта…') : ''}</p>
    {error && <div role="alert" className="alert alert--boxed" tabIndex={-1} ref={errorRef}>{error}</div>}
    {canImport && backgroundError && <div>
      <p>{backgroundError}</p>
      <Button type="button" tone="secondary" disabled={pending} onClick={refreshState}>{t('Обновить состояние')}</Button>
    </div>}
    {file && <>
      <p>{t('Строк в файле: {n}. Сопоставьте колонки. Имя или телефон обязательны.', { n: file.records.length })}</p>
      <p className="muted">{t('Сейчас проверяются имя, фамилия и телефон. Остальные колонки не используются.')}</p>
      {(Object.keys(columns) as (keyof CustomerCsvMapping)[]).map((key) => <Field key={key} label={t(columns[key])}>
        <Select value={mapping[key] ?? ''} disabled={pending} onChange={(e) => {
          setMapping({ ...mapping, [key]: e.target.value === '' ? null : Number(e.target.value) });
          setChecked(null); setError(''); importRequest.current = null;
        }}>
          <option value="">{t('Не выбрана')}</option>
          {file.headers.map((name, index) => <option key={index} value={index}>{index + 1}. {name || t('Без заголовка')}</option>)}
        </Select>
      </Field>)}
      <Button type="button" disabled={pending} onClick={check}>{t('Проверить строки')}</Button>
    </>}
    {checked && <div>
      <h3 ref={resultRef} tabIndex={-1}>{job && job.state !== 'UPLOADING' ? t('Проверка файла завершена. Результат последнего импорта ниже.') : t('Проверка завершена. Данные ещё не импортированы.')}</h3>
      <p>{t('Повторы проверены только внутри файла. Совпадения с базой салона проверит сервер при импорте.')}</p>
      {(Object.keys(labels) as CustomerCsvStatus[]).map((status) => <section key={status}>
        <h4>{t(labels[status])}: {checked.counts[status]}</h4>
        {checked.counts[status] > 0 && <>
          <p className="muted">{t('Первые 5 строк этой группы')}</p>
          <Table className="beauty-customers-table" aria-label={t(labels[status])}><thead><tr><th>{t('Строка')}</th><th>{t('Клиент')}</th><th>{t('Телефон')}</th><th>{t('Проверка')}</th></tr></thead>
            <tbody>{checked.rows.filter((row) => row.status === status).slice(0, 5).map((row) => <tr key={row.line}>
              <td data-label={t('Строка')}>{row.line}</td><td data-label={t('Клиент')}>{[row.firstName, row.lastName].filter(Boolean).join(' ') || t('Без имени')}</td>
              <td data-label={t('Телефон')}>{row.phoneNormalized ?? (row.phone || t('Нет телефона'))}</td><td data-label={t('Проверка')}>{t(row.reason)}</td>
            </tr>)}</tbody></Table>
        </>}
      </section>)}
      {canImport && <Button type="button" disabled={pending} onClick={() => beginImport()}>
        {pending ? t('Сохраняем состояние…') : t('Импортировать {n} строк', { n: checked.rows.length })}
      </Button>}
      {canImport && offerSeparate && <>
        <p className="muted">{t('Незавершённый импорт останется в журнале. Новый получит отдельный идентификатор.')}</p>
        <Button type="button" tone="secondary" disabled={pending} onClick={() => beginImport(true)}>{t('Начать отдельный импорт')}</Button>
      </>}
    </div>}
    {canImport && job && <>
      <ImportProgress job={job} t={t} />
      {mayUndo && <Button type="button" tone="danger" disabled={pending} onClick={() => void requestUndo()}>{t('Отменить импорт')}</Button>}
    </>}
    {dialog}
  </div>;
}
