'use client';
import { Tabs } from '../../components/tabs';
import { BranchArchiveButton } from './branch-archive-button';
import { selectBranch } from './actions';
import type { BranchItem } from '../../lib/api';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Icon } from '../../components/icon';
import { saveBusinessCard } from './actions';
import type { BusinessCardView } from './reference-board';
import { Button, Input, Textarea } from '../../components/ui';
import { useT } from '../../i18n/locale-provider';
export function BusinessCardEditor({
  business,
  onClose,
  branches = [],
}: {
  business: BusinessCardView;
  onClose: () => void;
  branches?: BranchItem[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useT();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(business.coverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const localUrl = useRef<string | null>(null);
  useEffect(() => {
    const target = dialog.current;
    target?.showModal();
    return () => {
      target?.close();
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    form.set('businessId', business.id);
    form.set('expectedUpdatedAt', business.updatedAt);
    form.set('removeCover', removeCover ? '1' : '0');
    startTransition(async () => {
      const result = await saveBusinessCard(form);
      if (result.error) setError(result.error);
      else onClose();
    });
  };
  return (
    <dialog
      ref={dialog}
      className="org-editor"
      aria-labelledby="org-editor-title"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else onClose();
      }}
    >
      <header>
        <div>
          <h2 id="org-editor-title">{t('Редактировать карточку')}</h2>
          <p>{business.name}</p>
        </div>
        <button type="button" className="icon-button" aria-label={t('Закрыть редактор')} disabled={pending} onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <Tabs
        label={t('Редактирование бизнеса')}
        panels={[
          {
            id: 'business-card',
            label: t('Карточка бизнеса'),
            content: (
              <form onSubmit={submit} className="org-editor-form">
                <div className="org-editor-fields">
                  <label>
                    {t('Название бизнеса')}
                    <Input
                      name="name"
                      required
                      maxLength={200}
                      defaultValue={business.name}
                      disabled={pending}
                    />
                  </label>
                  <label>
                    {t('Описание')}
                    <Textarea
                      name="description"
                      maxLength={1000}
                      rows={3}
                      defaultValue={business.description ?? ''}
                      disabled={pending}
                    />
                    <small>{t('До 1000 символов')}</small>
                  </label>
                </div>
                <section className="org-editor-cover" aria-label={t('Обложка бизнеса')}>
                  <h3>{t('Обложка бизнеса')}</h3>
                  <div className="org-editor-photo">
                    {preview ? (
                      <img src={preview} alt={t('Предпросмотр обложки')} />
                    ) : (
                      <div>
                        <Icon name="image" />
                        <span>
                          {business.hasCover ? t('Обложка временно недоступна') : t('Обложка не выбрана')}
                        </span>
                      </div>
                    )}
                  </div>
                  <label>
                    {t('Выбрать обложку')}
                    <input
                      type="file"
                      name="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending || !business.canUpload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError(t('Фото должно быть не больше 5 МБ.'));
                          e.target.value = '';
                          return;
                        }
                        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                          setError(t('Выберите JPEG, PNG или WebP.'));
                          e.target.value = '';
                          return;
                        }
                        if (localUrl.current) URL.revokeObjectURL(localUrl.current);
                        localUrl.current = URL.createObjectURL(file);
                        setPreview(localUrl.current);
                        setRemoveCover(false);
                        setError('');
                      }}
                    />
                    <small>
                      {business.canUpload
                        ? t('JPEG, PNG или WebP, до 5 МБ')
                        : t('Загрузка фото недоступна: хранилище ещё не подключено.')}
                    </small>
                  </label>
                  {(preview || business.hasCover) && !removeCover && (
                    <Button
                      type="button"
                      tone="secondary"
                      size="sm"
                      className="org-remove-photo"
                      disabled={pending}
                      onClick={() => {
                        setRemoveCover(true);
                        setPreview(null);
                        const input =
                          dialog.current?.querySelector<HTMLInputElement>('input[type=file]');
                        if (input) input.value = '';
                      }}
                    >
                      {t('Убрать обложку')}
                    </Button>
                  )}
                </section>
                {error && (
                  <p role="alert" className="org-editor-error">
                    {error}
                  </p>
                )}
                <footer>
                  <Button type="button" tone="secondary" onClick={onClose} disabled={pending}>
                    {t('Отмена')}
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? t('Сохраняем…') : t('Сохранить изменения')}
                  </Button>
                </footer>
              </form>
            ),
          },
          {
            id: 'business-branches',
            label: t('Объекты и филиалы'),
            count: branches.length,
            content: (
              <section className="org-editor-branches">
                <h3>{t('Объекты и филиалы')}</h3>
                <p>
                  {t('Откройте филиал для работы или измените его настройки. Удалённый филиал можно восстановить из архива.')}
                </p>
                {branches.length ? (
                  <ul>
                    {branches.map((branch) => (
                      <li key={branch.locationId}>
                        <div className="org-editor-branch-info">
                          <strong>{branch.name}</strong>
                          <small>{branch.address || t('Адрес не указан')}</small>
                        </div>
                        <div className="org-editor-branch-actions">
                          <form action={selectBranch}>
                            <input type="hidden" name="id" value={branch.id} />
                            <Button type="submit" tone="secondary" size="sm" className="org-editor-open">
                              {t('Открыть филиал')}
                            </Button>
                          </form>
                          {branch.vertical === 'HOSPITALITY' && (
                            <form action={selectBranch}>
                              <input type="hidden" name="id" value={branch.id} />
                              <input type="hidden" name="returnTo" value="/hotel-settings" />
                              <Button type="submit" tone="secondary" size="sm" className="org-editor-settings">
                                {t('Редактировать филиал')}
                              </Button>
                            </form>
                          )}
                          <BranchArchiveButton id={branch.locationId} name={branch.name} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {t('Активных объектов пока нет. Архивные можно восстановить в разделе «Архив объектов».')}
                  </p>
                )}
              </section>
            ),
          },
        ]}
      />
    </dialog>
  );
}
