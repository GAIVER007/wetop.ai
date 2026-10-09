'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { LOCALE_LABEL, accommodationCardCodes, localizedText, type EditorField, type EditorOption } from '@pms/domain';
import type { SiteAssetView } from '../../../../lib/api';
import { Button, Field, Input, Select, Textarea, cx } from '../../../../components/ui';
import { getAt, pathId, pathString, type Path } from './paths';

/**
 * Поля редактора сайта (MKT9): каждое знает свой путь в документе SiteSpec и читает его из общего состояния, ошибку
 * берёт по тому же пути, что пишет валидатор. Текст на языках сайта правится по одному языку за раз, другой язык
 * пустым не копируется из русского.
 */
export type Spec = Record<string, unknown>;
export type AssetKind = 'IMAGE' | 'LOGO' | 'FAVICON';

export interface EditorContextValue {
  spec: Spec;
  set: (path: Path, value: unknown) => void;
  locales: string[];
  defaultLocale: string;
  errorAt: (path: Path) => string | null;
  readOnly: boolean;
  categories: Array<{ code: string; name: string }>;
  assets: SiteAssetView[];
  pickAsset: (kind: AssetKind, onPick: (asset: SiteAssetView) => void) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);
export const EditorProvider = EditorContext.Provider;
export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor вне редактора');
  return value;
}

type Text = Record<string, string>;
const asText = (v: unknown): Text => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Text) : {});

/** Текст на языках сайта: выбор языка, ввод одного языка, чего не хватает */
export function TextField({
  path,
  label,
  max,
  multiline,
  required,
}: {
  path: Path;
  label: string;
  max: number;
  multiline?: boolean | undefined;
  required?: boolean | undefined;
}) {
  const c = useEditor();
  const value = asText(getAt(c.spec, path));
  const [chosen, setChosen] = useState(c.defaultLocale);
  const locale = c.locales.includes(chosen) ? chosen : c.defaultLocale;
  const id = pathId([...path, locale]);
  const many = c.locales.length > 1;
  const missing = required ? c.locales.filter((l) => !value[l]?.trim()) : [];
  const update = (text: string) => {
    const next = { ...value };
    if (text === '') delete next[locale];
    else next[locale] = text;
    c.set(path, Object.keys(next).length ? next : undefined);
  };
  const control = multiline ? (
    <Textarea rows={3} maxLength={max} value={value[locale] ?? ''} disabled={c.readOnly} onChange={(e) => update(e.currentTarget.value)} />
  ) : (
    <Input maxLength={max} value={value[locale] ?? ''} disabled={c.readOnly} onChange={(e) => update(e.currentTarget.value)} />
  );
  return (
    <div className="ed-text" data-path={pathString(path)}>
      {many && (
        <div className="ed-locales" role="group" aria-label={`Язык поля «${label}»`}>
          {c.locales.map((l) => (
            <button
              key={l}
              type="button"
              className={cx('ed-locale', l === locale && 'is-on')}
              aria-pressed={l === locale}
              onClick={() => setChosen(l)}
            >
              {LOCALE_LABEL[l] ?? l}
              {missing.includes(l) && <span className="sr-only"> (нет текста)</span>}
              {missing.includes(l) && <span aria-hidden="true" className="ed-locale__missing" />}
            </button>
          ))}
        </div>
      )}
      <Field
        label={many ? `${label} (${LOCALE_LABEL[locale] ?? locale})` : label}
        controlId={id}
        error={c.errorAt(path)}
        hint={missing.length && many ? `Нет текста: ${missing.map((l) => LOCALE_LABEL[l] ?? l).join(', ')}` : undefined}
      >
        {control}
      </Field>
    </div>
  );
}

/** Строка без языков (телефон, адрес страницы, внешняя ссылка); пусто снимает необязательное поле */
export function PlainField({
  path,
  label,
  hint,
  inputMode,
  normalize,
  disabled,
}: {
  path: Path;
  label: string;
  hint?: string | undefined;
  inputMode?: 'tel' | 'email' | 'url' | 'decimal' | undefined;
  normalize?: ((raw: string) => string) | undefined;
  disabled?: boolean | undefined;
}) {
  const c = useEditor();
  const value = getAt(c.spec, path);
  return (
    <Field label={label} controlId={pathId(path)} error={c.errorAt(path)} hint={hint}>
      <Input
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        inputMode={inputMode}
        disabled={c.readOnly || disabled}
        onChange={(e) => {
          const raw = normalize ? normalize(e.currentTarget.value) : e.currentTarget.value;
          c.set(path, raw === '' ? undefined : raw);
        }}
      />
    </Field>
  );
}

export function BoolField({ path, label }: { path: Path; label: string }) {
  const c = useEditor();
  const id = pathId(path);
  return (
    <div className="ed-check">
      <input
        id={id}
        type="checkbox"
        checked={getAt(c.spec, path) === true}
        disabled={c.readOnly}
        onChange={(e) => c.set(path, e.currentTarget.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function EnumField({
  path,
  label,
  options,
  optional,
  onPick,
}: {
  path: Path;
  label: string;
  options: readonly EditorOption[];
  optional?: string | undefined;
  onPick?: ((value: string) => void) | undefined;
}) {
  const c = useEditor();
  const value = getAt(c.spec, path);
  return (
    <Field label={label} controlId={pathId(path)} error={c.errorAt(path)}>
      <Select
        value={typeof value === 'string' ? value : ''}
        disabled={c.readOnly}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (onPick) onPick(next);
          else c.set(path, next === '' ? undefined : next);
        }}
      >
        {optional !== undefined && <option value="">{optional}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Подсказка ALT из библиотеки только на языках сайта; итоговый ALT живёт в документе и правится отдельно */
function suggestedAlt(asset: SiteAssetView, locales: string[]): Text | undefined {
  const alt = Object.fromEntries(Object.entries(asset.defaultAlt ?? {}).filter(([l, t]) => locales.includes(l) && t.trim()));
  return Object.keys(alt).length ? alt : undefined;
}

function Thumb({ assetId, alt }: { assetId: string | undefined; alt: string }) {
  const c = useEditor();
  const asset = c.assets.find((a) => a.id === assetId);
  if (!assetId) return <span className="ed-thumb ed-thumb--empty">Не выбрано</span>;
  if (!asset?.previewUrl) return <span className="ed-thumb ed-thumb--empty">Нет в библиотеке</span>;
  // подписанный адрес на срок: обычный <img>, оптимизатор Next его не кэширует
  return <img className="ed-thumb" src={asset.previewUrl} alt={alt || 'Изображение без подписи'} />;
}

/** Одна картинка `ImageRef` (логотип, фото секции, картинка соцсетей): выбор из библиотеки нужного вида и ALT */
export function ImageField({ path, label, kind, required }: { path: Path; label: string; kind: AssetKind; required: boolean }) {
  const c = useEditor();
  const value = getAt(c.spec, path) as { assetId?: string; alt?: unknown } | undefined;
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{label}</legend>
      <div className="ed-image">
        <Thumb assetId={value?.assetId} alt={localizedText(value?.alt, c.defaultLocale)} />
        <div className="ed-image__actions">
          <Button
            type="button"
            tone="secondary"
            size="sm"
            disabled={c.readOnly}
            onClick={() =>
              c.pickAsset(kind, (asset) => c.set(path, { assetId: asset.id, alt: value?.alt ?? suggestedAlt(asset, c.locales) }))
            }
          >
            {value ? 'Заменить изображение' : 'Выбрать изображение'}
          </Button>
          {value && !required && (
            <Button type="button" tone="ghost" size="sm" disabled={c.readOnly} onClick={() => c.set(path, undefined)}>
              Убрать
            </Button>
          )}
        </div>
      </div>
      {c.errorAt([...path, 'assetId']) && <p className="ed-error">{c.errorAt([...path, 'assetId'])}</p>}
      {!value && c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
      {value && <TextField path={[...path, 'alt']} label="Подпись для незрячих (ALT)" max={150} required />}
    </fieldset>
  );
}

/** Значок сайта: только id ассета вида FAVICON, без ALT */
export function FaviconField({ path }: { path: Path }) {
  const c = useEditor();
  const value = getAt(c.spec, path) as string | undefined;
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>Значок сайта</legend>
      <div className="ed-image">
        <Thumb assetId={value} alt="Значок сайта" />
        <div className="ed-image__actions">
          <Button type="button" tone="secondary" size="sm" disabled={c.readOnly} onClick={() => c.pickAsset('FAVICON', (a) => c.set(path, a.id))}>
            {value ? 'Заменить изображение' : 'Выбрать изображение'}
          </Button>
          {value && (
            <Button type="button" tone="ghost" size="sm" disabled={c.readOnly} onClick={() => c.set(path, undefined)}>
              Убрать
            </Button>
          )}
        </div>
      </div>
      {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
    </fieldset>
  );
}

/** Кнопки «вверх», «вниз», «удалить» у элемента списка: путь с клавиатуры без перетаскивания */
export function ItemControls({
  label,
  index,
  count,
  canRemove,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  canRemove: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const c = useEditor();
  return (
    <span className="ed-item-controls">
      <Button type="button" tone="ghost" size="sm" aria-label={`${label}: выше`} disabled={c.readOnly || index === 0} onClick={() => onMove(index - 1)}>
        ↑
      </Button>
      <Button type="button" tone="ghost" size="sm" aria-label={`${label}: ниже`} disabled={c.readOnly || index === count - 1} onClick={() => onMove(index + 1)}>
        ↓
      </Button>
      <Button type="button" tone="ghost" size="sm" aria-label={`${label}: удалить`} disabled={c.readOnly || !canRemove} onClick={onRemove}>
        Удалить
      </Button>
    </span>
  );
}

function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

/** Галерея и фото категорий: выбор из библиотеки, порядок, ALT, удаление; загрузка только в библиотеке MKT8 */
export function ImagesField({ path, label, min, max }: { path: Path; label: string; min: number; max: number }) {
  const c = useEditor();
  const items = (getAt(c.spec, path) as Array<{ assetId: string; alt?: unknown }> | undefined) ?? [];
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{label}</legend>
      {items.length === 0 && <p className="muted">Изображений нет.</p>}
      <ol className="ed-list">
        {items.map((img, i) => (
          <li key={`${img.assetId}-${i}`} className="ed-list__item" data-testid="ed-gallery-item">
            <div className="ed-image">
              <Thumb assetId={img.assetId} alt={localizedText(img.alt, c.defaultLocale)} />
              <ItemControls
                label={`Изображение ${i + 1}`}
                index={i}
                count={items.length}
                canRemove={items.length > 0}
                onMove={(to) => c.set(path, moved(items, i, to))}
                onRemove={() => c.set(path, items.filter((_, j) => j !== i))}
              />
            </div>
            <TextField path={[...path, i, 'alt']} label={`Подпись изображения ${i + 1} (ALT)`} max={150} required />
          </li>
        ))}
      </ol>
      {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
      <div className="ed-row">
        <Button
          type="button"
          tone="secondary"
          size="sm"
          disabled={c.readOnly || items.length >= max}
          data-testid="ed-gallery-add"
          onClick={() =>
            c.pickAsset('IMAGE', (asset) => c.set(path, [...items, { assetId: asset.id, alt: suggestedAlt(asset, c.locales) }]))
          }
        >
          Выбрать изображение
        </Button>
        <a className="ed-link" href="/marketing/site/assets">
          Открыть библиотеку изображений
        </a>
      </div>
      {min > 0 && <p className="muted">Нужно от {min} до {max} изображений.</p>}
    </fieldset>
  );
}

const ACTION_LABEL: Record<string, string> = {
  BOOK: 'Бронирование',
  PHONE: 'Позвонить',
  WHATSAPP: 'Написать в WhatsApp',
  EMAIL: 'Написать на почту',
  PAGE: 'Страница сайта',
  SECTION: 'Секция страницы',
  EXTERNAL: 'Внешняя ссылка',
};
export const CTA_KINDS = ['BOOK', 'PAGE', 'SECTION', 'PHONE', 'WHATSAPP', 'EMAIL', 'EXTERNAL'];
export const TARGET_KINDS = ['PAGE', 'SECTION', 'EXTERNAL'];

/** Куда ведёт кнопка или пункт меню: внутренняя цель выбирается из документа, id руками не вводится */
export function ActionField({ path, label, kinds }: { path: Path; label: string; kinds: readonly string[] }) {
  const c = useEditor();
  const value = (getAt(c.spec, path) as Record<string, string> | undefined) ?? {};
  const pages = ((c.spec['pages'] as Array<Record<string, unknown>> | undefined) ?? []).filter((p) => typeof p['id'] === 'string');
  const page = pages.find((p) => p['id'] === value['pageId']) ?? pages[0];
  const sections = ((page?.['sections'] as Array<Record<string, unknown>> | undefined) ?? []).filter((s) => typeof s['id'] === 'string');
  const kindChange = (kind: string) => {
    const home = String(pages[0]?.['id'] ?? '');
    if (kind === 'PAGE') c.set(path, { kind, pageId: home });
    else if (kind === 'SECTION') c.set(path, { kind, pageId: home, sectionId: String((pages[0]?.['sections'] as Array<Record<string, unknown>>)?.[0]?.['id'] ?? '') });
    else if (kind === 'EXTERNAL') c.set(path, { kind, url: 'https://' });
    else c.set(path, { kind });
  };
  return (
    <div className="ed-action" data-path={pathString(path)}>
      <EnumField path={[...path, 'kind']} label={label} options={kinds.map((k) => ({ value: k, label: ACTION_LABEL[k] ?? k }))} onPick={kindChange} />
      {(value['kind'] === 'PAGE' || value['kind'] === 'SECTION') && (
        <EnumField
          path={[...path, 'pageId']}
          label="Страница"
          options={pages.map((p) => ({ value: String(p['id']), label: localizedText(p['title'], c.defaultLocale) || String(p['id']) }))}
          onPick={(pageId) => {
            const first = (pages.find((p) => p['id'] === pageId)?.['sections'] as Array<Record<string, unknown>> | undefined)?.[0];
            c.set(path, value['kind'] === 'SECTION' ? { kind: 'SECTION', pageId, sectionId: String(first?.['id'] ?? '') } : { kind: 'PAGE', pageId });
          }}
        />
      )}
      {value['kind'] === 'SECTION' && (
        <EnumField
          path={[...path, 'sectionId']}
          label="Секция"
          options={sections.map((s) => ({ value: String(s['id']), label: localizedText(s['heading'], c.defaultLocale) || String(s['id']) }))}
        />
      )}
      {value['kind'] === 'EXTERNAL' && <PlainField path={[...path, 'url']} label="Адрес https://" inputMode="url" />}
      {c.errorAt(path) && !c.errorAt([...path, 'kind']) && <p className="ed-error">{c.errorAt(path)}</p>}
    </div>
  );
}

/** Кнопка (`CTA`): подпись и действие; необязательная добавляется и убирается */
export function CtaField({ path, label, required }: { path: Path; label: string; required: boolean }) {
  const c = useEditor();
  const value = getAt(c.spec, path);
  if (!value)
    return (
      <fieldset className="ed-group" data-path={pathString(path)}>
        <legend>{label}</legend>
        <Button
          type="button"
          tone="secondary"
          size="sm"
          disabled={c.readOnly}
          onClick={() => c.set(path, { label: { [c.defaultLocale]: 'Забронировать' }, action: { kind: 'BOOK' } })}
        >
          Добавить кнопку
        </Button>
        {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
      </fieldset>
    );
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{label}</legend>
      <TextField path={[...path, 'label']} label="Текст кнопки" max={30} required />
      <ActionField path={[...path, 'action']} label="Что делает кнопка" kinds={CTA_KINDS} />
      {!required && (
        <Button type="button" tone="ghost" size="sm" disabled={c.readOnly} onClick={() => c.set(path, undefined)}>
          Убрать кнопку
        </Button>
      )}
    </fieldset>
  );
}

/** Список строк на языках сайта (абзацы, короткие пункты) */
export function TextListField({ path, label, max, min, maxItems }: { path: Path; label: string; max: number; min: number; maxItems: number }) {
  const c = useEditor();
  const items = (getAt(c.spec, path) as unknown[] | undefined) ?? [];
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{label}</legend>
      <ol className="ed-list">
        {items.map((_, i) => (
          <li key={i} className="ed-list__item">
            <TextField path={[...path, i]} label={`${label}: ${i + 1}`} max={max} multiline={max > 200} required />
            <ItemControls
              label={`${label} ${i + 1}`}
              index={i}
              count={items.length}
              canRemove={items.length > min}
              onMove={(to) => c.set(path, moved(items, i, to))}
              onRemove={() => c.set(path, items.filter((__, j) => j !== i))}
            />
          </li>
        ))}
      </ol>
      {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={c.readOnly || items.length >= maxItems}
        onClick={() => c.set(path, [...items, { [c.defaultLocale]: 'Новый пункт' }])}
      >
        Добавить
      </Button>
    </fieldset>
  );
}

/** Новый элемент списка секции: обязательные поля заполнены на языке по умолчанию, остальные пустые */
function newListItem(fields: readonly EditorField[], c: EditorContextValue, itemLabel: string): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.required) continue;
    if (f.spec.kind === 'text') item[f.key] = { [c.defaultLocale]: f.key === 'title' || f.key === 'label' || f.key === 'question' ? itemLabel : 'Текст' };
    else if (f.spec.kind === 'enum') item[f.key] = f.spec.options[0]?.value;
    else if (f.spec.kind === 'category') item[f.key] = c.categories[0]?.code ?? '';
  }
  return item;
}

/** Список объектов секции (преимущества, категории, удобства, вопросы) */
export function ListField({ path, field }: { path: Path; field: EditorField & { spec: { kind: 'list' } } }) {
  const c = useEditor();
  const { min, max, itemLabel, item } = field.spec;
  const items = (getAt(c.spec, path) as unknown[] | undefined) ?? [];
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{field.label}</legend>
      <ol className="ed-list">
        {items.map((_, i) => (
          <li key={i} className="ed-list__item" data-testid="ed-list-item">
            <div className="ed-list__head">
              <b>
                {itemLabel} {i + 1}
              </b>
              <ItemControls
                label={`${itemLabel} ${i + 1}`}
                index={i}
                count={items.length}
                canRemove={items.length > min}
                onMove={(to) => c.set(path, moved(items, i, to))}
                onRemove={() => c.set(path, items.filter((__, j) => j !== i))}
              />
            </div>
            {item.map((f) => (
              <FieldFor key={f.key} field={f} path={[...path, i, f.key]} />
            ))}
          </li>
        ))}
      </ol>
      {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={c.readOnly || items.length >= max}
        onClick={() => c.set(path, [...items, newListItem(item, c, itemLabel)])}
      >
        Добавить: {itemLabel.toLowerCase()}
      </Button>
    </fieldset>
  );
}

/** Категория карточки: только категории брифа точного объекта, своего кода нет */
function CategoryField({ path, label }: { path: Path; label: string }) {
  const c = useEditor();
  const value = getAt(c.spec, path);
  const options = c.categories.map((cat) => ({ value: cat.code, label: cat.name }));
  if (typeof value === 'string' && value && !options.some((o) => o.value === value))
    options.push({ value, label: 'Нет в данных гостиницы' });
  return <EnumField path={path} label={label} options={options} optional="Выберите категорию" />;
}

/** Категории секции цен: только коды карточек размещения этого документа; цена руками не вводится */
function CategoryCodesField({ path, label, hint }: { path: Path; label: string; hint?: string | undefined }) {
  const c = useEditor();
  const value = (getAt(c.spec, path) as string[] | undefined) ?? [];
  const codes = accommodationCardCodes(c.spec);
  const name = (code: string) => c.categories.find((cat) => cat.code === code)?.name ?? code;
  return (
    <fieldset className="ed-group" data-path={pathString(path)}>
      <legend>{label}</legend>
      {codes.length === 0 && <p className="muted">Сначала добавьте категории в секцию «Номера».</p>}
      {codes.map((code) => (
        <div key={code} className="ed-check">
          <input
            id={pathId([...path, code])}
            type="checkbox"
            checked={value.includes(code)}
            disabled={c.readOnly}
            onChange={(e) => c.set(path, e.currentTarget.checked ? [...value, code] : value.filter((v) => v !== code))}
          />
          <label htmlFor={pathId([...path, code])}>{name(code)}</label>
        </div>
      ))}
      {hint && <p className="muted">{hint}</p>}
      {c.errorAt(path) && <p className="ed-error">{c.errorAt(path)}</p>}
    </fieldset>
  );
}

function MapField({ path, label }: { path: Path; label: string }) {
  const c = useEditor();
  const id = pathId(path);
  return (
    <div className="ed-check">
      <input
        id={id}
        type="checkbox"
        checked={!!getAt(c.spec, path)}
        disabled={c.readOnly}
        onChange={(e) => c.set(path, e.currentTarget.checked ? { provider: 'OPENSTREETMAP_LINK' } : undefined)}
      />
      <label htmlFor={id}>{label}: ссылка на OpenStreetMap по координатам из контактов</label>
    </div>
  );
}

/** Поле по описанию реестра редактора */
export function FieldFor({ field, path }: { field: EditorField; path: Path }): ReactNode {
  const s = field.spec;
  switch (s.kind) {
    case 'text':
      return <TextField path={path} label={field.label} max={s.max} multiline={s.multiline} required={field.required} />;
    case 'textList':
      return <TextListField path={path} label={field.label} max={s.max} min={s.min} maxItems={s.maxItems} />;
    case 'bool':
      return <BoolField path={path} label={field.label} />;
    case 'enum':
      return <EnumField path={path} label={field.label} options={s.options} />;
    case 'image':
      return <ImageField path={path} label={field.label} kind="IMAGE" required={field.required} />;
    case 'images':
      return <ImagesField path={path} label={field.label} min={s.min} max={s.max} />;
    case 'cta':
      return <CtaField path={path} label={field.label} required={field.required} />;
    case 'category':
      return <CategoryField path={path} label={field.label} />;
    case 'categoryCodes':
      return <CategoryCodesField path={path} label={field.label} hint={field.hint} />;
    case 'map':
      return <MapField path={path} label={field.label} />;
    case 'list':
      return <ListField path={path} field={field as EditorField & { spec: { kind: 'list' } }} />;
  }
}
