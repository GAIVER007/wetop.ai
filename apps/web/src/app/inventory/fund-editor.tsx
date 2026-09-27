'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { InventoryCategory } from '../../lib/api';
import { saveInventory, inventoryRates } from './actions';

type Mode = 'category' | 'room';

/**
 * Управляемый drawer создания/правки фонда (ADR-106): открывается и кнопкой `FundEditor`,
 * и пунктами меню «+ Добавить» и «⋯» строки — у меню своей кнопки-триггера нет.
 */
export function FundEditorDialog({
  categories,
  mode = 'room',
  category,
  room,
  preferKind,
  open,
  onClose,
}: {
  categories: InventoryCategory[];
  mode?: Mode;
  category?: InventoryCategory;
  room?: { code: string; roomNumber: string };
  /** «Номер» предвыбирает категорию номеров, «Комнату с койками» — койко-мест */
  preferKind?: InventoryCategory['kind'];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null);
  const preferred =
    (preferKind && categories.find((c) => c.kind === preferKind)?.code) ?? categories[0]?.code ?? '';
  const [selected, setSelected] = useState(category?.code ?? preferred);
  const [kind, setKind] = useState<InventoryCategory['kind']>(category?.kind ?? 'PRIVATE_ROOM');
  const [rates, setRates] = useState<{ code: string; name: string }[]>([]);
  const [rate, setRate] = useState('');
  const [loadingRates, setLoadingRates] = useState(false);
  const router = useRouter();
  const edit = Boolean((mode === 'category' && category) || room);
  const dorm = categories.find((c) => c.code === selected)?.kind === 'DORM_BED';
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected(category?.code ?? preferred);
    if (mode === 'category' && !edit) {
      setLoadingRates(true);
      inventoryRates().then((r) => {
        setRates(r.plans);
        setRate(r.plans[0]?.code ?? '');
        setError(r.error);
        setLoadingRates(false);
      });
    }
    // предвыбор категории и тарифы освежаются при каждом открытии, не на каждую перерисовку
  }, [open]);
  const title = edit
    ? mode === 'category'
      ? 'Редактировать категорию'
      : 'Редактировать комнату'
    : mode === 'category'
      ? 'Создать категорию'
      : preferKind === 'DORM_BED'
        ? 'Добавить комнату с койками'
        : 'Добавить размещение';
  function submit(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    const body: Record<string, unknown> =
      mode === 'category'
        ? edit
          ? { name: fields.name }
          : {
              name: fields.name,
              ratePlanCode: rate,
              newRatePlanName: fields.newRatePlanName,
              kind,
              capacityAdults: kind === 'DORM_BED' ? 1 : Number(fields.capacityAdults),
            }
        : room
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
        mode === 'category' ? 'categories' : 'rooms',
        body,
        mode === 'category' ? category?.code : room?.code,
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
      {open && (
        <form
          className="fund-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit(e.currentTarget);
          }}
        >
          {mode === 'category' ? (
            <>
              <Field label="Название категории">
                <Input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={category?.name}
                  placeholder="Например, Двухместный номер"
                />
              </Field>
              {!edit ? (
                <>
                  <Field label="Что продаём">
                    <Select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as InventoryCategory['kind'])}
                    >
                      <option value="PRIVATE_ROOM">Номер целиком</option>
                      <option value="DORM_BED">Койко-место в общей комнате</option>
                      <option value="APARTMENT">Апартаменты целиком</option>
                    </Select>
                  </Field>
                  <Field
                    label={
                      kind === 'DORM_BED'
                        ? 'Гостей на койко-место'
                        : 'Максимум гостей в одном номере'
                    }
                  >
                    <Input
                      key={kind}
                      name="capacityAdults"
                      type="number"
                      min={1}
                      max={100}
                      required
                      defaultValue={kind === 'DORM_BED' ? 1 : 2}
                      readOnly={kind === 'DORM_BED'}
                    />
                  </Field>
                  <Field label="Тариф для категории">
                    <Select
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      disabled={loadingRates}
                    >
                      {rates.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                      <option value="">Создать новый тариф</option>
                    </Select>
                  </Field>
                  {!rate && !loadingRates && (
                    <Field label="Название нового тарифа">
                      <Input
                        name="newRatePlanName"
                        required
                        maxLength={100}
                        placeholder="Например, Стандартный"
                      />
                    </Field>
                  )}
                  <p className="muted">
                    После создания добавьте номера или койки, затем настройте цены в выбранном
                    тарифе.
                  </p>
                </>
              ) : (
                <p className="muted">
                  Меняется название. Тип размещения и вместимость сохраняются для существующих
                  броней.
                </p>
              )}
            </>
          ) : room ? (
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
                  {categories.map((c) => (
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
                <Field label="Обозначение номера в шахматке">
                  <Input name="codes" required maxLength={100} placeholder="201" />
                </Field>
              )}
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
            <Button type="submit" disabled={pending || loadingRates}>
              {pending ? 'Сохраняем…' : edit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      )}
    </Overlay>
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
