'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import Link from 'next/link';
import { Alert, Badge, Button, Field, Input, Notice, Select } from '../../components/ui';
import type { InventoryCategory } from '../../lib/api';
import { saveInventory } from './actions';
import { KIND_WORD, capacityLong, usageLines } from './category-words';
import {
  CategoryRatePlanForm,
  NEW_PLAN,
  RatePlanChoice,
  planBody,
  planName,
  usePlans,
  type PlanPick,
} from './rate-plan-choice';

type Mode = 'category' | 'room';
type Created = {
  code: string;
  name: string;
  kind: InventoryCategory['kind'];
  rateName: string | null;
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
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null);
  const preferred =
    (preferKind && categories.find((c) => c.kind === preferKind)?.code) ??
    categories[0]?.code ??
    '';
  const [selected, setSelected] = useState(category?.code ?? preferred);
  const [kind, setKind] = useState<InventoryCategory['kind']>(category?.kind ?? 'PRIVATE_ROOM');
  /** Создание категории (C3, ADR-119): форма → «Категория создана» → номер или тариф */
  const [view, setView] = useState<'form' | 'created' | 'rate' | 'room'>('form');
  const [roomPreview, setRoomPreview] = useState({
    building: '',
    floor: '',
    room: '',
    codes: [] as string[],
  });
  const [created, setCreated] = useState<Created | null>(null);
  const [planMode, setPlanMode] = useState<'later' | 'now'>('later');
  const [pick, setPick] = useState<PlanPick>({ plan: '', newName: '' });
  const [errors, setErrors] = useState<{ name?: string; capacity?: string; plan?: string }>({});
  const creating = mode === 'category' && !category;
  const { plans, loading: loadingRates, error: ratesError } = usePlans(open && creating);
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
    setPlanMode('later');
    setPick({ plan: '', newName: '' });
    setKind(category?.kind ?? preferKind ?? 'PRIVATE_ROOM');
    setSelected(category?.code ?? preferred);
    // предвыбор категории освежается при каждом открытии, не на каждую перерисовку
  }, [open]);
  useEffect(() => {
    if (!loadingRates) setPick((p) => (p.plan ? p : { ...p, plan: plans[0]?.code ?? NEW_PLAN }));
  }, [loadingRates, plans]);
  const title =
    view === 'created'
      ? 'Категория создана'
      : view === 'rate'
        ? 'Настроить тариф'
        : edit
          ? mode === 'category'
            ? 'Редактировать категорию'
            : 'Редактировать комнату'
          : formMode === 'category'
            ? 'Создать категорию'
            : preferKind === 'DORM_BED'
              ? 'Добавить комнату с койками'
              : 'Добавить размещение';
  function createCategory(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    const name = String(fields.name ?? '').trim();
    const capacity = kind === 'DORM_BED' ? 1 : Number(fields.capacityAdults);
    const plan = planMode === 'now' ? planBody(pick) : { ratePlanLater: true };
    const found = {
      ...(name ? {} : { name: 'Укажите название категории' }),
      ...(Number.isInteger(capacity) && capacity >= 1 && capacity <= 100
        ? {}
        : { capacity: 'Вместимость — от 1 до 100 гостей' }),
      ...(plan ? {} : { plan: 'Назовите новый тариф или выберите существующий' }),
    };
    setErrors(found);
    if (Object.keys(found).length || !plan) return;
    setError(null);
    start(async () => {
      const result = await saveInventory('categories', {
        name,
        kind,
        capacityAdults: capacity,
        ...plan,
      });
      if (result.error || !result.code) {
        setError(result.error ?? 'Категория не создана. Обновите страницу и проверьте список.');
        return;
      }
      setCreated({
        code: result.code,
        name,
        kind,
        rateName: planMode === 'now' ? planName(pick, plans) : null,
      });
      setSelected(result.code);
      setView('created');
      router.refresh();
    });
  }
  function submit(form: HTMLFormElement) {
    if (formMode === 'category' && !edit) return createCategory(form);
    const fields = Object.fromEntries(new FormData(form));
    const body: Record<string, unknown> =
      formMode === 'category'
        ? { name: fields.name }
        : room && view !== 'room'
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
            <b>{created.name}</b> — {KIND_WORD[created.kind].toLowerCase()}. Категория уже в
            номерном фонде.
          </p>
          <dl className="fund-preview-facts">
            <div>
              <dt>Тариф</dt>
              <dd>{created.rateName ?? <Badge tone="warn">Тариф не настроен</Badge>}</dd>
            </div>
          </dl>
          <p className="muted">
            {created.rateName
              ? `Дальше — добавить ${created.kind === 'DORM_BED' ? 'комнату с койками' : 'номера'} и ввести цены в календаре тарифов.`
              : `Дальше — добавить ${created.kind === 'DORM_BED' ? 'комнату с койками' : 'номера'} и настроить тариф. Без тарифа и цен категория не продаётся.`}
          </p>
          <div className="fund-created-actions">
            <Button onClick={() => setView('room')}>
              {created.kind === 'DORM_BED' ? 'Добавить комнату с койками' : 'Добавить номер'}
            </Button>
            {created.rateName ? (
              <Link
                className="btn btn--secondary"
                href={`/rates?category=${encodeURIComponent(created.code)}`}
                prefetch={false}
              >
                Цены в календаре
              </Link>
            ) : (
              <Button tone="secondary" onClick={() => setView('rate')}>
                Настроить тариф
              </Button>
            )}
            <Button tone="ghost" onClick={onClose}>
              Готово
            </Button>
          </div>
        </div>
      )}
      {open && view === 'rate' && created && (
        <CategoryRatePlanForm
          category={created}
          onDone={onClose}
          onCancel={() => setView('created')}
        />
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
              <Field label="Название категории">
                <Input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={category?.name}
                  placeholder="Например, Двухместный номер"
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? 'fund-err-name' : undefined}
                />
              </Field>
              {errors.name && <Alert id="fund-err-name">{errors.name}</Alert>}
              {!edit ? (
                <>
                  <fieldset className="fund-choice">
                    <legend>Тип продажи</legend>
                    {(
                      [
                        ['PRIVATE_ROOM', 'Номер целиком', 'Гость занимает весь номер'],
                        ['DORM_BED', 'Койко-место', 'Продаётся отдельная койка в общей комнате'],
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
                          {label}
                          <small>{hint}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {kind === 'DORM_BED' ? (
                    <p className="muted">Вместимость: 1 гость на койко-место.</p>
                  ) : (
                    <>
                      <Field label="Гостей в номере">
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
                  <fieldset className="fund-choice">
                    <legend>Тариф</legend>
                    <label className="fund-choice__option">
                      <input
                        type="radio"
                        name="planMode"
                        value="later"
                        checked={planMode === 'later'}
                        onChange={() => setPlanMode('later')}
                      />
                      <span>
                        Настроить позже
                        <small>
                          Категория появится в фонде, продавать её можно после тарифа и цен
                        </small>
                      </span>
                    </label>
                    <label className="fund-choice__option">
                      <input
                        type="radio"
                        name="planMode"
                        value="now"
                        checked={planMode === 'now'}
                        onChange={() => setPlanMode('now')}
                      />
                      <span>
                        Настроить сейчас
                        <small>
                          Выбрать тариф объекта или назвать новый; цены — в календаре тарифов
                        </small>
                      </span>
                    </label>
                  </fieldset>
                  {planMode === 'now' && (
                    <RatePlanChoice
                      plans={plans}
                      loading={loadingRates}
                      value={pick}
                      onChange={(next) => {
                        setPick(next);
                        setErrors((e) => {
                          const next = { ...e };
                          delete next.plan;
                          return next;
                        });
                      }}
                      error={errors.plan ?? ratesError ?? undefined}
                    />
                  )}
                </>
              ) : (
                category && <CategoryUsage category={category} units={unitCount} />
              )}
            </>
          ) : room && view !== 'room' ? (
            <>
              <Field label="Обозначение физической комнаты">
                <Input name="roomNumber" required maxLength={100} defaultValue={room.roomNumber} />
              </Field>
              <p className="muted">
                Обозначение обновится у всех коек этой комнаты. Код места {room.code} и его
                бронирования сохранятся.
              </p>
            </>
          ) : (
            <>
              <Field label="Категория">
                <Select value={selected} onChange={(e) => setSelected(e.target.value)} required>
                  {roomChoices.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="fund-form-row">
                <Field label="Корпус">
                  <Input name="building" required maxLength={100} placeholder="Основной" />
                </Field>
                <Field label="Этаж">
                  <Input name="floor" required maxLength={100} placeholder="2" />
                </Field>
              </div>
              <Field label="Обозначение комнаты">
                <Input name="roomNumber" required maxLength={100} placeholder="201" />
              </Field>
              {dorm ? (
                <Field label="Обозначения коек — по одному на строку">
                  <textarea
                    className="inp"
                    name="codes"
                    required
                    rows={5}
                    placeholder={'201-A\n201-B\n201-C'}
                  />
                </Field>
              ) : (
                <Field label="Обозначение номера в календаре">
                  <Input name="codes" required maxLength={100} placeholder="201" />
                </Field>
              )}
              <div className="fund-room-preview" aria-label="Предпросмотр размещения">
                <strong>
                  {dorm
                    ? `Комната ${roomPreview.room || '…'}`
                    : `Номер ${roomPreview.codes[0] || '…'}`}
                </strong>
                {dorm && <span>Койко-мест: {roomPreview.codes.length}</span>}
                <span>
                  {[roomPreview.building, roomPreview.floor && `этаж ${roomPreview.floor}`]
                    .filter(Boolean)
                    .join(', ') || 'Укажите корпус и этаж'}
                </span>
                <span>{choices.find((c) => c.code === selected)?.name}</span>
                {dorm && roomPreview.codes.length > 0 && (
                  <span>В календаре: {roomPreview.codes.join(', ')}</span>
                )}
              </div>
              <p className="muted">
                {dorm
                  ? 'Будет создана одна общая комната с перечисленными койками.'
                  : 'Будет создан отдельный номер выбранной категории.'}{' '}
                Новые места требуют проверки уборки.
              </p>
            </>
          )}
          {error && <Alert>{error}</Alert>}
          <div className="fund-form-actions">
            <Button type="button" tone="secondary" disabled={pending} onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохраняем…' : edit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

/**
 * Правка категории (C4, ТЗ §17–§18): тип продажи и вместимость — фактами, не полями: на них держатся места, цены
 * и брони, а правила их смены ждут решения владельца (Q-173). Что использует категорию — списком; у сопоставленной
 * с Channex — что переименование туда не уходит (тип номера там создаётся с названием один раз, при настройке).
 */
function CategoryUsage({ category: c, units }: { category: InventoryCategory; units: number }) {
  const lines = usageLines(c, units);
  return (
    <>
      <dl className="fund-preview-facts">
        <div>
          <dt>Тип продажи</dt>
          <dd>{KIND_WORD[c.kind]}</dd>
        </div>
        <div>
          <dt>Вместимость</dt>
          <dd>{capacityLong(c)}</dd>
        </div>
      </dl>
      <Notice tone="muted">
        Тип продажи и вместимость после создания не меняются: на них держатся места, цены и брони.
      </Notice>
      {lines.length ? (
        <div className="fund-usage">
          <h3 id={`usage-${c.code}`}>Эту категорию используют</h3>
          <ul aria-labelledby={`usage-${c.code}`}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">Категорию пока ничего не использует.</p>
      )}
      {c.channexMapped && (
        <Notice tone="muted">
          В менеджере каналов тип номера сохранит прежнее название: там оно меняется отдельно.
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
  const [open, setOpen] = useState(false);
  const edit = Boolean((mode === 'category' && category) || room);
  return (
    <>
      <Button
        tone={edit ? 'secondary' : 'primary'}
        onClick={() => setOpen(true)}
        disabled={mode === 'room' && !room && !categories.length}
      >
        {edit ? 'Редактировать' : mode === 'category' ? '+ Категория' : '+ Номер / койки'}
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
