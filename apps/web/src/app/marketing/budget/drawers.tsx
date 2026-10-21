'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import type { MarketingExpenseRow } from '../../../lib/api';
import { formatMoney, minorToInput, currencySign } from '../../../lib/money';
import { csvField } from '../../finance/csv';
import { Icon } from '../../../components/icon';
import { Overlay } from '../../../components/overlay';
import { useToast } from '../../../components/toast';
import { useConfirm } from '../../../components/use-confirm';
import { Switch } from '../../../components/switch';
import { Alert, Button, Field, Input, Select, Textarea } from '../../../components/ui';
import {
  deleteExpenseAction,
  removeExpenseFileAction,
  uploadExpenseFileAction,
  importExpensesAction,
  saveExpenseAction,
  saveLinesAction,
  savePlanAction,
  type BudgetActionResult,
} from './actions';
import { CATEGORY_HINTS, PLATFORM_LABELS, monthTitle, platformLabel } from './parts';

const NONE: BudgetActionResult = { error: null, ok: 0 };

/** То же устройство, что у /market: уведомление сразу по ответу, панель закрывается эффектом */
export function useBudgetAction(
  serverAction: (prev: BudgetActionResult, fd: FormData) => Promise<BudgetActionResult>,
  close: () => void,
) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(
    async (prev: BudgetActionResult, fd: FormData) => {
      const next = await serverAction(prev, fd);
      if (next.ok) toast({ text: next.message ?? 'Сохранено', tone: 'success' });
      return next;
    },
    NONE,
  );
  const seen = useRef(0);
  useEffect(() => {
    if (!state.ok || state.ok === seen.current) return;
    seen.current = state.ok;
    close();
  }, [state, close]);
  return [state, action, pending] as const;
}

/** Умолчания формы расхода; `campaigns`: кампании филиала для выбора (§53), без них поле выбора не показывается */
export interface ExpenseDefaults {
  today: string;
  reportingCurrency: string;
  locationCurrency: string;
  campaigns?: Array<{ id: string; name: string; platform: string; status: string }> | undefined;
}

/** «Добавить расход» и «Изменить»: одна форма (экран 4 макета); при правке внизу «Удалить» */
export function ExpenseButton({
  expense,
  defaults,
  primary,
}: {
  expense?: MarketingExpenseRow | undefined;
  defaults: ExpenseDefaults;
  primary?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone={expense ? 'ghost' : primary ? undefined : 'secondary'}
        size={expense ? 'xs' : undefined}
        onClick={() => setOpen(true)}
        data-testid={expense ? `budget-edit-${expense.id}` : 'budget-add'}
        aria-label={expense ? `Изменить расход: ${platformLabel(expense.platform)}, ${expense.date}` : undefined}
      >
        {!expense && <Icon name="plus" width={16} aria-hidden="true" />}
        {expense ? 'Изменить' : 'Добавить расход'}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={expense ? 'Расход' : 'Новый расход'}
          onClose={() => setOpen(false)}
        >
          <ExpenseForm expense={expense} defaults={defaults} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function ExpenseForm({
  expense,
  defaults,
  onClose,
}: {
  expense?: MarketingExpenseRow | undefined;
  defaults: ExpenseDefaults;
  onClose: () => void;
}) {
  const [state, action, pending] = useBudgetAction(saveExpenseAction, onClose);
  const [deleted, remove, removing] = useBudgetAction(deleteExpenseAction, onClose);
  const { ask, dialog } = useConfirm();
  const deleteForm = useRef<HTMLFormElement>(null);
  const error = state.error ?? deleted.error;
  const v = (name: string, fallback: string | null | undefined) =>
    state.values?.[name] ?? (fallback ?? '');
  const currencies = [...new Set([defaults.reportingCurrency, defaults.locationCurrency, 'USD', 'EUR', 'RUB', expense?.currency ?? defaults.reportingCurrency])];
  const [currency, setCurrency] = useState(v('currency', expense?.currency ?? defaults.reportingCurrency));
  const foreign = currency !== defaults.reportingCurrency;
  return (
    <>
      <form action={action} className="settings-service-form" data-testid="budget-expense-form">
        {error && <Alert boxed>{error}</Alert>}
        {expense && <input type="hidden" name="id" value={expense.id} />}
        <Field label="Дата">
          <Input
            name="date"
            type="date"
            required
            defaultValue={v('date', expense?.date ?? defaults.today)}
            data-testid="budget-date"
          />
        </Field>
        <Field label="Платформа">
          <Select
            name="platform"
            required
            defaultValue={v('platform', expense?.platform ?? 'META')}
            data-testid="budget-platform"
          >
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        {(defaults.campaigns?.length ?? 0) > 0 && (
          <Field label="Кампания из «Рекламы»" controlId="budget-campaign-id" hint="Расход войдёт в расход кампании; её имя запишется в поле ниже">
            <Select id="budget-campaign-id" name="campaignId" defaultValue={v('campaignId', expense?.campaignId)} data-testid="budget-campaign-id">
              <option value="">Без кампании</option>
              {defaults.campaigns!
                .filter((c) => c.status !== 'FINISHED' || c.id === expense?.campaignId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {platformLabel(c.platform)}: {c.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        <Field label="Кампания" controlId="budget-campaign-input" hint="Необязательно: название кампании или поста">
          <Input name="campaign" maxLength={200} defaultValue={v('campaign', expense?.campaign)} data-testid="budget-campaign" />
        </Field>
        <Field label={`Сумма, ${currencySign(currency)}`}>
          <Input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={v('amount', expense ? minorToInput(expense.amount) : '')}
            data-testid="budget-amount"
          />
        </Field>
        <Field label="Валюта">
          <Select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            data-testid="budget-currency"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        {foreign && (
          <Field
            label={`Курс ${currency} к ${defaults.reportingCurrency}`}
            controlId="budget-fx-input"
            hint="На дату расхода; пересчёт запишется и не изменится задним числом"
          >
            <Input
              name="fxRate"
              inputMode="decimal"
              required
              defaultValue={v('fxRate', expense?.fxRate === '1' ? '' : expense?.fxRate)}
              data-testid="budget-fx"
            />
          </Field>
        )}
        <Field label="Статья">
          <>
            <Input
              name="category"
              required
              maxLength={100}
              list="budget-category-hints"
              defaultValue={v('category', expense?.category ?? 'Реклама')}
              data-testid="budget-category"
            />
            <datalist id="budget-category-hints">
              {CATEGORY_HINTS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        </Field>
        <Field label="Описание">
          <Textarea name="description" rows={2} maxLength={500} defaultValue={v('description', expense?.description)} />
        </Field>
        <Switch
          name="countedInBudget"
          label="Учитывать в бюджете"
          hint="Выключите для расходов вне плана: они останутся в журнале и аналитике"
          defaultChecked={state.values ? state.values['countedInBudget'] === 'true' : (expense?.countedInBudget ?? true)}
        />
        <div className="settings-service-actions">
          <Button type="button" tone="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-save">
            {pending ? 'Сохраняю…' : expense ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>
      {expense ? (
        <ExpenseFiles expense={expense} />
      ) : (
        <p className="settings-note" data-testid="budget-files-later">
          Чек или файл можно приложить после сохранения расхода.
        </p>
      )}
      {expense && (
        <form ref={deleteForm} action={remove} className="budget-delete">
          <input type="hidden" name="id" value={expense.id} />
          <p className="settings-note">
            Удаление попадёт в журнал организации; суммы месяца пересчитаются сразу.
          </p>
          <Button
            type="button"
            tone="danger"
            disabled={removing}
            data-testid="budget-delete"
            onClick={async () => {
              const yes = await ask({
                title: 'Удалить расход?',
                body: 'Строка исчезнет из журнала расходов; запись об удалении останется в журнале организации.',
                confirmLabel: 'Удалить',
                tone: 'danger',
              });
              if (yes) deleteForm.current?.requestSubmit();
            }}
          >
            {removing ? 'Удаляю…' : 'Удалить расход'}
          </Button>
          {dialog}
        </form>
      )}
    </>
  );
}

/** Те же действия, что у форм раздела, но панель не закрывается: файлы прикладывают по одному подряд */
export function useFileAction(serverAction: (prev: BudgetActionResult, fd: FormData) => Promise<BudgetActionResult>) {
  const { toast } = useToast();
  return useActionState(async (prev: BudgetActionResult, fd: FormData) => {
    const next = await serverAction(prev, fd);
    if (next.ok) toast({ text: next.message ?? 'Сохранено', tone: 'success' });
    return next;
  }, NONE);
}

const sizeText = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;

/** «Чеки и файлы» расхода (DATA_MODEL §51, ADR-MKT-B7): фото чека или PDF до 10 МиБ, до 10 файлов, удаление в журнал */
function ExpenseFiles({ expense }: { expense: MarketingExpenseRow }) {
  const [uploaded, upload, uploading] = useFileAction(uploadExpenseFileAction);
  const [removed, remove, removing] = useFileAction(removeExpenseFileAction);
  const { ask, dialog } = useConfirm();
  const files = expense.files ?? [];
  const error = uploaded.error ?? removed.error;
  return (
    <section className="budget-files" aria-labelledby={`budget-files-${expense.id}`} data-testid="budget-files">
      <h3 id={`budget-files-${expense.id}`} className="budget-files__title">
        Чеки и файлы
      </h3>
      {error && <Alert boxed>{error}</Alert>}
      {files.length === 0 ? (
        <p className="settings-note">Чеков пока нет: приложите фото чека, скриншот или PDF.</p>
      ) : (
        <ul className="budget-files__list" data-testid="budget-files-list">
          {files.map((f) => (
            <li key={f.id} className="budget-files__item">
              <Icon name="receipt" width={16} aria-hidden="true" />
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="budget-files__name">
                  {f.fileName}
                </a>
              ) : (
                <span className="budget-files__name">{f.fileName}</span>
              )}
              <span className="budget-files__size">{sizeText(f.byteSize)}</span>
              <form action={remove}>
                <input type="hidden" name="expenseId" value={expense.id} />
                <input type="hidden" name="fileId" value={f.id} />
                <Button
                  type="button"
                  tone="ghost"
                  size="xs"
                  disabled={removing}
                  aria-label={`Удалить файл ${f.fileName}`}
                  onClick={async (e) => {
                    const form = e.currentTarget.form;
                    const yes = await ask({
                      title: 'Удалить файл?',
                      body: 'Файл исчезнет из расхода; запись об удалении останется в журнале организации.',
                      confirmLabel: 'Удалить',
                      tone: 'danger',
                    });
                    if (yes) form?.requestSubmit();
                  }}
                >
                  Удалить
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {files.length < 10 && (
        <form action={upload} className="budget-files__add" key={files.length}>
          <input type="hidden" name="expenseId" value={expense.id} />
          <Field label="Фото чека или PDF, до 10 МБ">
            <Input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
              data-testid="budget-file-input"
            />
          </Field>
          <Button type="submit" tone="secondary" size="sm" disabled={uploading} aria-busy={uploading} data-testid="budget-file-upload">
            {uploading ? 'Загружаю…' : 'Приложить файл'}
          </Button>
        </form>
      )}
      {dialog}
    </section>
  );
}

/** План месяца: одна сумма в валюте отчётности (экран 2, вкладка «Планы») */
/**
 * «Распределить план» (DATA_MODEL §52, ADR-MKT-B7): поле суммы на каждый канал, пустое значит «канала в плане нет».
 * Сумма каналов больше общего плана не запрещается: форма показывает «распределено N из M» и предупреждает.
 */
export function LinesButton({
  month,
  plan,
  lines,
  prevLines,
  currency,
}: {
  month: string;
  plan: string | null;
  lines: Array<{ platform: string; amount: string }>;
  prevLines: Array<{ platform: string; amount: string }>;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="secondary" size="sm" onClick={() => setOpen(true)} data-testid="budget-lines-edit">
        {lines.length === 0 ? 'Распределить план' : 'Изменить план по каналам'}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={`План по каналам на ${monthTitle(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          <LinesForm
            month={month}
            plan={plan}
            lines={lines}
            prevLines={prevLines}
            currency={currency}
            onClose={() => setOpen(false)}
          />
        </Overlay>
      )}
    </>
  );
}

/** Тиыны строкой → тиыны bigint из поля ввода («120 000,5»); неразборчивое считается нулём, отказ даст сервер */
const inputMinor = (v: string): bigint => {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(v.replace(/\s/g, ''));
  return m ? BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0')) : 0n;
};

function LinesForm({
  month,
  plan,
  lines,
  prevLines,
  currency,
  onClose,
}: {
  month: string;
  plan: string | null;
  lines: Array<{ platform: string; amount: string }>;
  prevLines: Array<{ platform: string; amount: string }>;
  currency: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useBudgetAction(saveLinesAction, onClose);
  const fill = (source: Array<{ platform: string; amount: string }>) =>
    Object.fromEntries(Object.keys(PLATFORM_LABELS).map((p) => {
      const line = source.find((l) => l.platform === p);
      return [p, line ? minorToInput(line.amount) : ''];
    }));
  const [values, setValues] = useState<Record<string, string>>(() =>
    state.values
      ? Object.fromEntries(Object.keys(PLATFORM_LABELS).map((p) => [p, state.values?.[`amount-${p}`] ?? '']))
      : fill(lines),
  );
  const allocated = Object.values(values).reduce((sum, v) => sum + inputMinor(v), 0n);
  const total = plan === null ? null : BigInt(plan);
  return (
    <form action={action} className="settings-service-form" data-testid="budget-lines-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="month" value={month} />
      <p className="settings-note">
        Разбивка общего плана месяца по каналам, {currencySign(currency)}. Пустое поле: канала в плане нет. Без общего плана
        сумма каналов и есть план месяца.
      </p>
      {prevLines.length > 0 && (
        <Button type="button" tone="secondary" size="sm" onClick={() => setValues(fill(prevLines))} data-testid="budget-lines-copy">
          Взять из прошлого месяца
        </Button>
      )}
      {Object.entries(PLATFORM_LABELS).map(([platform, label]) => (
        <Field key={platform} label={label}>
          <Input
            name={`amount-${platform}`}
            inputMode="decimal"
            value={values[platform] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [platform]: e.target.value }))}
            data-testid={`budget-line-${platform}`}
          />
        </Field>
      ))}
      <p className="settings-note" aria-live="polite" data-testid="budget-lines-allocated">
        {total === null
          ? `Сумма каналов: ${formatMoney(allocated, currency)}`
          : `Распределено ${formatMoney(allocated, currency)} из ${formatMoney(total, currency)}`}
      </p>
      {total !== null && allocated > total && (
        <Alert tone="warning" data-testid="budget-lines-over">
          Каналы расписаны больше общего плана на {formatMoney(allocated - total, currency)}. Сохранить можно.
        </Alert>
      )}
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-lines-save">
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

export function PlanButton({
  month,
  plan,
  currency,
}: {
  month: string;
  plan: string | null;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="secondary" onClick={() => setOpen(true)} data-testid="budget-plan-edit">
        {plan === null ? 'Задать план' : 'Изменить план'}
      </Button>
      {open && (
        <Overlay
          open
          drawer
          className="settings-service-drawer"
          title={`План на ${monthTitle(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          <PlanForm month={month} plan={plan} currency={currency} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function PlanForm({
  month,
  plan,
  currency,
  onClose,
}: {
  month: string;
  plan: string | null;
  currency: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useBudgetAction(savePlanAction, onClose);
  return (
    <form action={action} className="settings-service-form" data-testid="budget-plan-form">
      {state.error && <Alert boxed>{state.error}</Alert>}
      <input type="hidden" name="month" value={month} />
      <p className="settings-note">
        Общий бюджет месяца в валюте отчётности ({currencySign(currency)}). Прогноз и рекомендация на обзоре
        считаются от этой суммы.
      </p>
      <Field label={`План, ${currencySign(currency)}`}>
        <Input
          name="amount"
          inputMode="decimal"
          required
          autoFocus
          defaultValue={state.values?.['amount'] ?? (plan === null ? '' : minorToInput(plan))}
          data-testid="budget-plan-amount"
        />
      </Field>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-plan-save">
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}

/**
 * «Загрузить CSV» (МКТ-В2, импорт данных): файл формата выгрузки, колонки по заголовку. Ошибка в любой
 * строке отклоняет весь файл, поэтому после правки его можно загрузить снова без дублей.
 */
export function ImportCsvButton({ reportingCurrency }: { reportingCurrency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" tone="secondary" size="sm" onClick={() => setOpen(true)} data-testid="budget-import">
        Загрузить CSV
      </Button>
      {open && (
        <Overlay open drawer className="settings-service-drawer" title="Загрузка расходов" onClose={() => setOpen(false)}>
          <ImportForm reportingCurrency={reportingCurrency} onClose={() => setOpen(false)} />
        </Overlay>
      )}
    </>
  );
}

function ImportForm({ reportingCurrency, onClose }: { reportingCurrency: string; onClose: () => void }) {
  const [state, action, pending] = useBudgetAction(importExpensesAction, onClose);
  return (
    <form action={action} className="settings-service-form" data-testid="budget-import-form">
      {state.error && (
        <Alert boxed className="budget-import-error" data-testid="budget-import-error">
          {state.error}
        </Alert>
      )}
      <input type="hidden" name="currency" value={reportingCurrency} />
      <p className="settings-note">
        Таблица в формате выгрузки «Выгрузить CSV»: обязательны колонки «Дата», «Платформа», «Статья» и «Сумма»,
        остальные по желанию. Дата ГГГГ-ММ-ДД или ДД.ММ.ГГГГ, платформа подписью или кодом, валюта по умолчанию{' '}
        {reportingCurrency}, для другой валюты нужен курс. До 1000 строк за раз.
      </p>
      <p className="settings-note">
        Если в строке ошибка, файл не загружается целиком и ничего не записывается: исправьте строки из списка и
        загрузите снова.
      </p>
      <Field label="Файл CSV">
        <Input type="file" name="file" accept=".csv,text/csv" required data-testid="budget-import-file" />
      </Field>
      <div className="settings-service-actions">
        <Button type="button" tone="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending} data-testid="budget-import-save">
          {pending ? 'Загружаю…' : 'Загрузить'}
        </Button>
      </div>
    </form>
  );
}

/** Выгрузка журнала месяца в CSV: файл собирается из уже загруженных строк, без запроса */
export function ExportCsvButton({
  rows,
  month,
  reportingCurrency,
}: {
  rows: MarketingExpenseRow[];
  month: string;
  reportingCurrency: string;
}) {
  const save = () => {
    const head = ['Дата', 'Платформа', 'Кампания', 'Статья', 'Описание', 'Сумма', 'Валюта', 'Курс', `Сумма, ${reportingCurrency}`, 'В бюджете'];
    const line = (r: MarketingExpenseRow) =>
      [r.date, platformLabel(r.platform), r.campaign ?? '', r.category, r.description ?? '', minorToInput(r.amount), r.currency, r.fxRate, minorToInput(r.baseAmount), r.countedInBudget ? 'да' : 'нет']
        .map((c) => csvField(String(c)))
        .join(';');
    const csv = '﻿' + [head.join(';'), ...rows.map(line)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-expenses-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button type="button" tone="secondary" size="sm" onClick={save} disabled={rows.length === 0} data-testid="budget-export">
      Выгрузить CSV
    </Button>
  );
}
