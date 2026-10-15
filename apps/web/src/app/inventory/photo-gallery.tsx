'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CategoryPhoto, SiteAssetView } from '../../lib/api';
import { Alert, Button, cx } from '../../components/ui';
import { Icon } from '../../components/icon';
import { Overlay } from '../../components/overlay';
import { loadPhotoLibraryAction, saveCategoryPhotosAction } from './actions';
import { MAX_CATEGORY_PHOTOS } from './photo-limits';

/**
 * Галерея категории в панели места и выбор фото из библиотеки сайта (DATA_MODEL §30, ADR-153).
 * Загрузка новых картинок остаётся в «Маркетинг → Изображения сайта»; здесь только выбор и порядок.
 */
export function PhotoGallery({
  categoryCode,
  categoryName,
  photos,
}: {
  categoryCode: string;
  categoryName: string;
  photos: CategoryPhoto[];
}) {
  const [index, setIndex] = useState(0);
  const [picking, setPicking] = useState(false);
  const shown = photos.filter((p) => p.url);
  const current = shown[Math.min(index, Math.max(shown.length - 1, 0))];
  return (
    <>
      <div className="unit-photo" data-testid="unit-photo">
        {current ? (
          <>
            <img
              src={current.url!}
              alt={current.alt ?? `Фото: ${categoryName}`}
              width={current.width}
              height={current.height}
              decoding="async"
            />
            {shown.length > 1 && (
              <>
                <button
                  type="button"
                  className="unit-photo__nav unit-photo__nav--prev"
                  aria-label="Предыдущее фото"
                  onClick={() => setIndex((i) => (i + shown.length - 1) % shown.length)}
                >
                  <Icon name="back" width={18} height={18} />
                </button>
                <button
                  type="button"
                  className="unit-photo__nav unit-photo__nav--next"
                  aria-label="Следующее фото"
                  onClick={() => setIndex((i) => (i + 1) % shown.length)}
                >
                  <Icon name="chevron" width={18} height={18} />
                </button>
                <span className="unit-photo__count" aria-live="polite">
                  {Math.min(index, shown.length - 1) + 1}/{shown.length}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="unit-photo__empty">
            <Icon name="bed" width={40} height={40} />
            Фото ещё не добавлены
          </span>
        )}
      </div>
      <Button tone="secondary" size="sm" onClick={() => setPicking(true)}>
        <Icon name="plus" width={16} height={16} />
        {photos.length ? 'Изменить фото категории' : 'Добавить фото категории'}
      </Button>
      {picking && (
        <PhotoPicker
          categoryCode={categoryCode}
          categoryName={categoryName}
          current={photos.map((p) => p.assetId)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

function PhotoPicker({
  categoryCode,
  categoryName,
  current,
  onClose,
}: {
  categoryCode: string;
  categoryName: string;
  current: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState<SiteAssetView[] | null>(null);
  const [selected, setSelected] = useState<string[]>(current);
  const [error, setError] = useState<string | null>(null);
  const [storageOff, setStorageOff] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    let alive = true;
    void loadPhotoLibraryAction().then((r) => {
      if (!alive) return;
      setAssets(r.assets);
      setStorageOff(r.storageOff);
      if (r.error) setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((v) => v !== id)
        : prev.length >= MAX_CATEGORY_PHOTOS
          ? prev
          : [...prev, id],
    );
  function save() {
    start(async () => {
      const r = await saveCategoryPhotosAction(categoryCode, selected);
      if (r.error) return setError(r.error);
      onClose();
      router.refresh();
    });
  }
  return (
    <Overlay open onClose={onClose} title={`Фото категории: ${categoryName}`} size="lg">
      <div className="photo-picker">
        <p className="sub">
          Выберите до {MAX_CATEGORY_PHOTOS} фото, порядок выбора и есть порядок показа. Новые
          картинки загружаются в{' '}
          <Link href="/marketing/site/assets">«Маркетинг → Изображения сайта»</Link>.
        </p>
        {error && <Alert>{error}</Alert>}
        {storageOff && (
          <Alert>Хранилище изображений не настроено: картинки пока не показать.</Alert>
        )}
        {assets === null ? (
          <p className="sub">Загружаем библиотеку...</p>
        ) : assets.length === 0 ? (
          <p className="sub">В библиотеке пока нет изображений.</p>
        ) : (
          <ul className="photo-picker__grid">
            {assets.map((a) => {
              const at = selected.indexOf(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={at >= 0}
                    aria-label={a.defaultAlt?.ru ?? `Изображение ${a.width}×${a.height}`}
                    className={cx('photo-picker__item', at >= 0 && 'is-on')}
                    onClick={() => toggle(a.id)}
                  >
                    {a.previewUrl ? (
                      <img src={a.previewUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <Icon name="bed" />
                    )}
                    {at >= 0 && <span className="photo-picker__order">{at + 1}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="photo-picker__actions">
          <span className="sub">
            Выбрано {selected.length} из {MAX_CATEGORY_PHOTOS}
          </span>
          <Button tone="secondary" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={save} disabled={pending}>
            Сохранить
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
