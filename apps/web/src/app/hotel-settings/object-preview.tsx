'use client';
import { useState } from 'react';
import { CANCELLATION_RULE_LABELS, PROPERTY_AMENITIES, type CancellationRule } from '@pms/domain';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { Button } from '../../components/ui';
import { amenityIcon, amenityLabel } from './card-model';
import { useLive, type LiveValues } from './settings-save';

export interface PreviewPhoto {
  id: string;
  url: string;
  alt: string;
}

/** Что показывает карточка: живые значения формы, а без формы (другая вкладка) значения из записи объекта */
function useCard(initial: LiveValues): LiveValues {
  const live = useLive();
  return live ? { ...initial, ...live } : initial;
}

const code = (v: string | undefined) => (v ?? '').split(',').filter(Boolean);

/**
 * «Как объект увидит гость» (верстка владельца, ADR-156): сжатая карточка объекта с первым фото, адресом, часами и
 * удобствами. Это предпросмотр сведений, а не отдельная страница сайта: рейтинга и отзывов в системе нет, поэтому их
 * здесь нет. Данные берёт из формы, поэтому правка видна сразу, ещё до «Сохранить».
 */
export function PreviewCard({
  initial,
  photos,
  onOpen,
}: {
  initial: LiveValues;
  photos: PreviewPhoto[];
  onOpen?: () => void;
}) {
  const v = useCard(initial);
  const amenities = code(v['amenities']).slice(0, 4);
  const place = [v['city'], v['address']].filter(Boolean).join(', ');
  const first = photos[0];
  return (
    <div className="obj-preview" data-testid="object-preview">
      <div className="obj-preview__photo">
        {first ? (
          <img src={first.url} alt={first.alt} />
        ) : (
          <span className="obj-preview__empty" role="img" aria-label="Фото ещё не добавлены">
            <Icon name="image" width={28} height={28} />
          </span>
        )}
      </div>
      <div className="obj-preview__body">
        <div className="obj-preview__title">{v['name'] || 'Название объекта'}</div>
        {place && (
          <div className="obj-preview__line">
            <Icon name="pin" width={14} height={14} />
            {place}
          </div>
        )}
        <div className="obj-preview__times">
          <span>
            <Icon name="clock" width={14} height={14} />
            Заезд с {v['checkInTime'] || '—'}
          </span>
          <span>
            <Icon name="clock" width={14} height={14} />
            Выезд до {v['checkOutTime'] || '—'}
          </span>
        </div>
        {amenities.length > 0 && (
          <ul className="obj-preview__amenities" aria-label="Удобства">
            {amenities.map((c) => (
              <li key={c}>
                <Icon name={amenityIcon(c)} width={20} height={20} />
                <span>{amenityLabel(c)}</span>
              </li>
            ))}
          </ul>
        )}
        {onOpen && (
          <button type="button" className="obj-preview__open" onClick={onOpen}>
            Открыть пример
            <Icon name="external" width={14} height={14} />
          </button>
        )}
      </div>
    </div>
  );
}

const yesNo = (v: string | undefined) => (v === 'true' ? 'Да' : 'Нет');

/** Полный пример: то, что гость прочтёт об объекте целиком (описание, правила, удобства) */
function PreviewFull({ initial, photos }: { initial: LiveValues; photos: PreviewPhoto[] }) {
  const v = useCard(initial);
  const amenities = code(v['amenities']);
  const rules: Array<[string, string]> = [
    ['Заезд и выезд', `с ${v['checkInTime'] || '—'} до ${v['checkOutTime'] || '—'}`],
    ['Ранний заезд', v['earlyCheckIn'] === 'true' ? 'при наличии возможности' : 'нет'],
    ['Поздний выезд', v['lateCheckOut'] === 'true' ? 'при наличии возможности' : 'нет'],
    ['С детьми', yesNo(v['childrenAllowed'])],
    ['С питомцами', yesNo(v['petsAllowed'])],
    ['Курение', v['smokingAllowed'] === 'true' ? 'разрешено' : 'запрещено'],
    ['Минимальный возраст гостя', `${v['minGuestAge'] || '0'} лет`],
    ...(v['quietHoursFrom'] && v['quietHoursTo']
      ? ([['Тихие часы', `${v['quietHoursFrom']} – ${v['quietHoursTo']}`]] as Array<[string, string]>)
      : []),
    [
      'Отмена брони',
      CANCELLATION_RULE_LABELS[v['cancellationRule'] as CancellationRule] ?? '—',
    ],
  ];
  return (
    <div className="obj-sample">
      {photos.length > 0 && (
        <div className="obj-sample__photos">
          {photos.slice(0, 3).map((p) => (
            <img key={p.id} src={p.url} alt={p.alt} />
          ))}
        </div>
      )}
      <h3>{v['name'] || 'Название объекта'}</h3>
      <p className="settings-note">
        {[v['city'], v['address']].filter(Boolean).join(', ') || 'Адрес не указан'}
      </p>
      <p>{v['description'] || 'Краткое описание не заполнено.'}</p>
      <dl className="obj-sample__rules">
        {rules.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      {v['houseRulesNote'] && <p className="obj-sample__note">{v['houseRulesNote']}</p>}
      {amenities.length > 0 && (
        <ul className="obj-sample__amenities" aria-label="Удобства">
          {PROPERTY_AMENITIES.filter((a) => amenities.includes(a.code)).map((a) => (
            <li key={a.code}>
              <Icon name={amenityIcon(a.code)} width={16} height={16} />
              {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Кнопка шапки и окно «Предпросмотр карточки» */
export function PreviewButton({
  initial,
  photos,
}: {
  initial: LiveValues;
  photos: PreviewPhoto[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        tone="secondary"
        onClick={() => setOpen(true)}
        data-testid="preview-open"
      >
        <Icon name="eye" width={18} height={18} />
        Предпросмотр карточки
      </Button>
      <Overlay open={open} onClose={() => setOpen(false)} title="Предпросмотр карточки" size="lg">
        <PreviewFull initial={initial} photos={photos} />
      </Overlay>
    </>
  );
}

/** Карточка справа на экране и то же окно по «Открыть пример» */
export function PreviewPanel({
  initial,
  photos,
}: {
  initial: LiveValues;
  photos: PreviewPhoto[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PreviewCard initial={initial} photos={photos} onOpen={() => setOpen(true)} />
      <Overlay open={open} onClose={() => setOpen(false)} title="Предпросмотр карточки" size="lg">
        <PreviewFull initial={initial} photos={photos} />
      </Overlay>
    </>
  );
}
