'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Notice, Select, Textarea } from '../../components/ui';
import type { InventoryCategory } from '../../lib/api';
import { currencySign, formatMoney } from '../../lib/money';
import { saveInventory } from './actions';
import { KIND_WORD, capacityLong, usageLines } from './category-words';
import { floorText } from './unit-state';
import { msg, type Translate } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';

type Mode = 'category' | 'room';
type Created = {
  code: string;
  name: string;
  kind: InventoryCategory['kind'];
  price: string;
};

/** Цена категории из поля: «7 000», «7000», «456,50» → строка для API; иначе null (та же проверка, что на сервере) */
export function priceField(raw: string): string | null {
  const text = raw.replace(/\s/g, '').replace(',', '.');
  const m = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m || Number(text) <= 0 || Number(m[1]) >= 100_000_000) return null;
  return m[2] ? `${Number(m[1])}.${m[2]}` : String(Number(m[1]));
}
/** Подпись поля цены: койка продаётся поштучно, номер — целиком, одна цена при любом числе гостей */
const priceLabel = (kind: InventoryCategory['kind'], currency: string | null | undefined, t: Translate) =>
  `${kind === 'DORM_BED' ? t('Цена за койку в ночь') : t('Цена за номер в ночь')}, ${currencySign(currency ?? 'KZT')}`;
/** Текущая цена в поле правки: тиыны → «11000» или «456.5» */
const priceInputValue = (minor: string | null) => {
  if (!minor) return '';
  const v = BigInt(minor);
  return v % 100n ? `${v / 100n}.${String(v % 100n).padStart(2, '0')}` : String(v / 100n);
};

/**
 * Управляемый drawer создания/правки фонда (ADR-108): открывается и кнопкой `FundEditor`,
 * и пунктами меню «+ Добавить» и «⋯» строки — у меню своей кнопки-триггера нет.
 */
export function FundEditorDialog({
  categories,
  mode = 'room',
  category,
  room,
  preferKind,
  unitCount = 0,
  open,
  onClose,
}: {
  categories: InventoryCategory[];
  mode?: Mode;
  category?: InventoryCategory;
  room?: { code: string; roomNumber: string };
  /** «Номер» предвыбирает категорию номеров, «Комнату с койками» — койко-мест */
  preferKind?: InventoryCategory['kind'];
  /** Мест в правимой категории — для «Эту категорию используют» (C4) */
  unitCount?: number;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null);
  const preferred =
    (preferKind && categories.find((c) => c.kind === preferKind)?.code) ??
    categories[0]?.code ??
    '';
  const [selected, setSelected] = useState(category?.code ?? preferred);
  const [kind, setKind] = useState<InventoryCategory['kind']>(category?.kind ?? 'PRIVATE_ROOM');
  /** Создание категории: форма с ценой → «Категория создана» → номер (тарифы стойка больше не показывает) */
  const [view, setView] = useState<'form' | 'created' | 'room'>('form');
  const [roomPreview, setRoomPreview] = useState({
    building: '',
    floor: '',
    room: '',
    codes: [] as string[],
  });
  const [created, setCreated] = useState<Created | null>(null);
  const [errors, setErrors] = useState<{ name?: string; capacity?: string; price?: string }>({});
  const router = useRouter();
  const formMode: Mode = view === 'room' ? 'room' : mode;
  const edit = view !== 'room' && Boolean((mode === 'category' && category) || room);
  const selectedKind =
    categories.find((c) => c.code === selected)?.kind ??
    (created?.code === selected ? created.kind : undefined);
  const dorm = selectedKind === 'DORM_BED';
  const choices =
    created && !categories.some((c) => c.code === created.code)
      ? [...categories, { code: created.code, name: created.name }]
      : categories;
  const roomKind = created?.kind ?? preferKind;
  const roomChoices = roomKind
    ? choices.filter(
        (c) =>
          (categories.find((item) => item.code === c.code)?.kind ?? created?.kind) === roomKind,
      )
    : choices;
  useEffect(() => {
    if (!open) return;
    setError(null);
    setRoomPreview({ building: '', floor: '', room: '', codes: [] });
    setErrors({});
    setView('form');
    setCreated(null);
    setKind(category?.kind ?? preferKind ?? 'PRIVATE_ROOM');
    setSelected(category?.code ?? preferred);
    // предвыбор категории освежается при каждом открытии, не на каждую перерисовку
  }, [open]);
  const title =
    view === 'created'
      ? msg('Категория создана')
      : edit
          ? mode === 'category'
            ? msg('Редактировать категорию')
            : msg('Редактировать комнату')
          : formMode === 'category'
            ? msg('Создать категорию')
            : preferKind === 'DORM_BED'
              ? msg('Добавить комнату с койками')
              : msg('Добавить размещение');
  /** Название, вместимость и цена проверяются до отправки; ошибка у поля, введённое не стирается */
  function categoryFields(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    const name = String(fields.name ?? '').trim();
    const capacity = kind === 'DORM_BED' ? 1 : Number(fields.capacityAdults);
    const rawPrice = String(fields.price ?? '');
    const price = priceField(rawPrice);
    const found = {
      ...(name ? {} : { name: t('Укажите название категории') }),
      ...(edit || (Number.isInteger(capacity) && capacity >= 1 && capacity <= 100)
        ? {}
        : { capacity: t('Вместимость — от 1 до 100 гостей') }),
      // при правке пустая цена — «не менять», при создании цена обязательна
      ...(price || (edit && !rawPrice.trim()) ? {} : { price: t('Цена — число больше нуля, например 7000') }),
    };
    setErrors(found);
    return Object.keys(found).length ? null : { name, capacity, price };
  }
  function createCategory(form: HTMLFormElement) {
    const valid = categoryFields(form);
    if (!valid) return;
    setError(null);
    start(async () => {
      const result = await saveInventory('categories', {
        name: valid.name,
        kind,
        capacityAdults: valid.capacity,
        price: valid.price,
      });
      if (result.error || !result.code) {
        setError(result.error ?? t('Категория не создана. Обновите страницу и проверьте список.'));
        return;
      }
      setCreated({ code: result.code, name: valid.name, kind, price: valid.price! });
      setSelected(result.code);
      setView('created');
      router.refresh();
    });
  }
  function submit(form: HTMLFormElement) {
    if (formMode === 'category' && !edit) return createCategory(form);
    let body: Record<string, unknown>;
    if (formMode === 'category') {
      const valid = categoryFields(form);
      if (!valid) return;
      body = { name: valid.name, ...(valid.price ? { price: valid.price } : {}) };
    } else {
      const fields = Object.fromEntries(new FormData(form));
      body =
        room && view !== 'room'
          ? { roomNumber: fields.roomNumber }
          : {
              categoryCode: selected,
              building: fields.building,
              floor: fields.floor,
              roomNumber: fields.roomNumber,
              codes: String(fields.codes ?? '')
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean),
            };
    }
    setError(null);
    start(async () => {
      const result = await saveInventory(
        formMode === 'category' ? 'categories' : 'rooms',
        body,
        formMode === 'category' ? category?.code : view === 'room' ? undefined : room?.code,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }
  return (
    <Overlay
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={title}
      drawer
    >
      {open && view === 'created' && created && (
        <div className="fund-form fund-created">
          <p>
            <b>{created.name}</b>:{' '}
            {t('{kind}. Категория уже в номерном фонде.', { kind: t(KIND_WORD[created.kind]).toLowerCase() })}
          </p>
          <dl className="fund-preview-facts">
            <div>
              <dt>{created.kind === 'DORM_BED' ? t('Цена за койку в ночь') : t('Цена за номер в ночь')}</dt>
              <dd>{formatMoney(String(Math.round(Number(created.price) * 100)))}</dd>
            </div>
          </dl>
          <p className="muted">
            {created.kind === 'DORM_BED'
              ? t('Дальше: добавить комнату с койками. Без мест категория не продаётся.')
              : t('Дальше: добавить номера. Без мест категория не продаётся.')}
          </p>
          <div className="fund-created-actions">
            <Button onClick={() => setView('room')}>
              {created.kind === 'DORM_BED' ? t('Добавить комнату с койками') : t('Добавить номер')}
            </Button>
            <Button tone="ghost" onClick={onClose}>
              {t('Готово')}
            </Button>
          </div>
        </div>
      )}
      {open && (view === 'form' || view === 'room') && (
        <form
          className="fund-form"
          onChange={(e) => {
            if (formMode !== 'room' || edit) return;
            const data = new FormData(e.currentTarget);
            setRoomPreview({
              building: String(data.get('building') ?? ''),
              floor: String(data.get('floor') ?? ''),
              room: String(data.get('roomNumber') ?? ''),
              codes: String(data.get('codes') ?? '')
                .split(/[\n,]+/)
                .map((v) => v.trim())
                .filter(Boolean),
            });
          }}
          noValidate={formMode === 'category' && !edit}
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit(e.currentTarget);
          }}
        >
          {formMode === 'category' ? (
            <>
              <Field label={t('Название категории')}>
                <Input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={category?.name}
                  placeholder={t('Например, Двухместный номер')}
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? 'fund-err-name' : undefined}
                />
              </Field>
              {errors.name && <Alert id="fund-err-name">{errors.name}</Alert>}
              {!edit ? (
                <>
                  <fieldset className="fund-choice">
                    <legend>{t('Тип продажи')}</legend>
                    {(
                      [
                        ['PRIVATE_ROOM', msg('Номер целиком'), msg('Гость занимает весь номер')],
                        ['DORM_BED', msg('Койко-место'), msg('Продаётся отдельная койка в общей комнате')],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <label key={value} className="fund-choice__option">
                        <input
                          type="radio"
                          name="kind"
                          value={value}
                          checked={kind === value}
                          onChange={() => setKind(value)}
                        />
                        <span>
                          {t(label)}
                          <small>{t(hint)}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {kind === 'DORM_BED' ? (
                    <p className="muted">{t('Вместимость: 1 гость на койко-место.')}</p>
                  ) : (
                    <>
                      <Field label={t('Гостей в номере')}>
                        <Input
                          name="capacityAdults"
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={2}
                          aria-invalid={errors.capacity ? 'true' : undefined}
                          aria-describedby={errors.capacity ? 'fund-err-capacity' : undefined}
                        />
                      </Field>
                      {errors.capacity && <Alert id="fund-err-capacity">{errors.capacity}</Alert>}
                    </>
                  )}
                  <PriceField kind={kind} currency={categories.find((c) => c.currency)?.currency} error={errors.price} />
                </>
              ) : (
                category && (
                  <>
                    <PriceField
                      kind={category.kind}
                      currency={category.currency}
                      error={errors.price}
                      defaultValue={priceInputValue(category.priceMinor)}
                    />
                    <CategoryUsage category={category} units={unitCount} />
                  </>
                )
              )}
            </>
          ) : room && view !== 'room' ? (
            <>
              <Field label={t('Обозначение физической комнаты')}>
                <Input name="roomNumber" required maxLength={100} defaultValue={room.roomNumber} />
              </Field>
              <p className="muted">
                {t('Обозначение обновится у всех коек этой комнаты. Код места {code} и его бронирования сохранятся.', { code: room.code })}
              </p>
            </>
          ) : (
            <>
              <Field label={t('Категория')}>
                <Select value={selected} onChange={(e) => setSelected(e.target.value)} required>
                  {roomChoices.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="fund-form-row">
                <Field label={t('Корпус')}>
                  <Input name="building" required maxLength={100} placeholder={t('Основной')} />
                </Field>
                <Field label={t('Этаж')}>
                  <Input name="floor" required maxLength={100} placeholder="2" />
                </Field>
              </div>
              <Field label={t('Обозначение комнаты')}>
                <Input name="roomNumber" required maxLength={100} placeholder="201" />
              </Field>
              {dorm ? (
                <Field label={t('Обозначения коек — по одному на строку')}>
                  <Textarea
                    name="codes"
                    required
                    rows={5}
                    placeholder={'201-A\n201-B\n201-C'}
                  />
                </Field>
              ) : (
                <Field label={t('Обозначение номера в календаре')}>
                  <Input name="codes" required maxLength={100} placeholder="201" />
                </Field>
              )}
              <div className="fund-room-preview" aria-label={t('Предпросмотр размещения')}>
                <strong>
                  {dorm
                    ? t('Комната {n}', { n: roomPreview.room || '…' })
                    : t('Номер {code}', { code: roomPreview.codes[0] || '…' })}
                </strong>
                {dorm && <span>{t('Койко-мест: {n}', { n: roomPreview.codes.length })}</span>}
                <span>
                  {[roomPreview.building, roomPreview.floor && floorText(roomPreview.floor, t)]
                    .filter(Boolean)
                    .join(', ') || t('Укажите корпус и этаж')}
                </span>
                <span>{choices.find((c) => c.code === selected)?.name}</span>
                {dorm && roomPreview.codes.length > 0 && (
                  <span>{t('В календаре: {codes}', { codes: roomPreview.codes.join(', ') })}</span>
                )}
              </div>
              <p className="muted">
                {dorm
                  ? t('Будет создана одна общая комната с перечисленными койками.')
                  : t('Будет создан отдельный номер выбранной категории.')}{' '}
                {t('Новые места требуют проверки уборки.')}
              </p>
            </>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="fund-form-actions">
            <Button type="button" tone="secondary" disabled={pending} onClick={onClose}>
              {t('Отмена')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t('Сохраняем…') : edit ? t('Сохранить') : t('Создать')}
            </Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

/** Цена категории: одна на все дни и любое число гостей, ставится на год вперёд и уходит в каналы */
function PriceField({
  kind,
  currency,
  error,
  defaultValue = '',
}: {
  kind: InventoryCategory['kind'];
  /** валюта объекта (у категории своя `currency`); у нового объекта без категорий тенге */
  currency?: string | null | undefined;
  error?: string | undefined;
  defaultValue?: string;
}) {
  const t = useT();
  return (
    <>
      <Field label={priceLabel(kind, currency, t)}>
        <Input
          name="price"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={defaultValue}
          placeholder={t('Например, 7000')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'fund-err-price' : 'fund-price-hint'}
        />
      </Field>
      {error ? (
        <Alert id="fund-err-price">{error}</Alert>
      ) : (
        <p className="muted" id="fund-price-hint">
          {t('Цена на все дни на год вперёд. Новая цена уходит и в каналы продаж; уже принятые брони не меняются.')}
        </p>
      )}
    </>
  );
}

/**
 * Правка категории (C4, ТЗ §17–§18): тип продажи и вместимость — фактами, не полями: на них держатся места, цены
 * и брони, а правила их смены ждут решения владельца (Q-173). Что использует категорию — списком; у сопоставленной
 * с Channex — что переименование туда не уходит (тип номера там создаётся с названием один раз, при настройке).
 */
function CategoryUsage({ category: c, units }: { category: InventoryCategory; units: number }) {
  const t = useT();
  const locale = useLocale();
  const lines = usageLines(c, units, locale, t);
  return (
    <>
      <dl className="fund-preview-facts">
        <div>
          <dt>{t('Тип продажи')}</dt>
          <dd>{t(KIND_WORD[c.kind])}</dd>
        </div>
        <div>
          <dt>{t('Вместимость')}</dt>
          <dd>{capacityLong(c, locale, t)}</dd>
        </div>
      </dl>
      <Notice tone="muted">
        {t('Тип продажи и вместимость после создания не меняются: на них держатся места, цены и брони.')}
      </Notice>
      {lines.length ? (
        <div className="fund-usage">
          <h3 id={`usage-${c.code}`}>{t('Эту категорию используют')}</h3>
          <ul aria-labelledby={`usage-${c.code}`}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">{t('Категорию пока ничего не использует.')}</p>
      )}
      {c.channexMapped && (
        <Notice tone="muted">
          {t('В менеджере каналов тип номера сохранит прежнее название: там оно меняется отдельно.')}
        </Notice>
      )}
    </>
  );
}

/** Кнопка с собственным drawer — «Категории» пользуются ей как раньше */
export function FundEditor({
  categories,
  mode = 'room',
  category,
  room,
}: {
  categories: InventoryCategory[];
  mode?: Mode;
  category?: InventoryCategory;
  room?: { code: string; roomNumber: string };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const edit = Boolean((mode === 'category' && category) || room);
  return (
    <>
      <Button
        tone={edit ? 'secondary' : 'primary'}
        onClick={() => setOpen(true)}
        disabled={mode === 'room' && !room && !categories.length}
      >
        {edit ? t('Редактировать') : mode === 'category' ? t('Добавить категорию') : t('+ Номер / койки')}
      </Button>
      <FundEditorDialog
        categories={categories}
        mode={mode}
        {...(category ? { category } : {})}
        {...(room ? { room } : {})}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
