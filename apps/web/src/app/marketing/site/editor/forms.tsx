'use client';
import { useState, type ReactNode } from 'react';
import {
  EDITOR_LOCALES,
  LOCALE_LABEL,
  SITE_EDITOR_SECTIONS,
  SITE_SPEC_SOCIAL_HOSTS,
  THEME_OPTIONS,
  applySectionVariant,
  localizedText,
  normalizePageSlug,
  removeLocale,
} from '@pms/domain';
import { Button, Field, Input } from '../../../../components/ui';
import { getAt, pathId, type Path } from './paths';
import {
  ActionField,
  BoolField,
  CtaField,
  EnumField,
  FaviconField,
  FieldFor,
  ImageField,
  ItemControls,
  PlainField,
  TARGET_KINDS,
  TextField,
  useEditor,
  type Spec,
} from './fields';

/**
 * Формы редактора (MKT9 §16–§41): настройки сайта, страница, секция. Каждая форма правит один общий документ через
 * `useEditor().set`; что ИИ менять не может (контакты, языки, интеграции, SEO), человек здесь меняет явно.
 */
type Rec = Record<string, unknown>;

function Group({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <fieldset className="ed-group" data-testid={testId}>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

const THEME_LABEL: Record<keyof typeof THEME_OPTIONS, string> = {
  preset: 'Настроение',
  accent: 'Цвет акцента',
  typography: 'Шрифт',
  radius: 'Углы',
  density: 'Плотность',
  colorScheme: 'Схема',
};

/** Языки: включить или снять; язык по умолчанию снять нельзя, пока другой не выбран по умолчанию (§17) */
function LocalesField() {
  const c = useEditor();
  return (
    <Group title="Языки сайта" testId="ed-locales">
      {EDITOR_LOCALES.map((l) => {
        const on = c.locales.includes(l);
        const isDefault = l === c.defaultLocale;
        const id = pathId(['site', 'locales', l]);
        return (
          <div key={l} className="ed-check">
            <input
              id={id}
              type="checkbox"
              checked={on}
              disabled={c.readOnly || isDefault}
              onChange={(e) => {
                if (e.currentTarget.checked) c.set(['site', 'locales'], [...c.locales, l]);
                else c.set([], removeLocale(c.spec, l));
              }}
            />
            <label htmlFor={id}>
              {LOCALE_LABEL[l]}
              {isDefault ? ' (по умолчанию)' : ''}
            </label>
          </div>
        );
      })}
      <EnumField
        path={['site', 'defaultLocale']}
        label="Язык по умолчанию"
        options={c.locales.map((l) => ({ value: l, label: LOCALE_LABEL[l] ?? l }))}
      />
      <p className="muted">Новый язык не заполняется копией русского: тексты на нём добавьте сами.</p>
    </Group>
  );
}

function SocialField() {
  const c = useEditor();
  const path: Path = ['site', 'contacts', 'social'];
  const items = (getAt(c.spec, path) as Array<{ network: string; url: string }> | undefined) ?? [];
  const networks = Object.keys(SITE_SPEC_SOCIAL_HOSTS).map((n) => ({ value: n, label: n.charAt(0) + n.slice(1).toLowerCase() }));
  return (
    <Group title="Соцсети">
      {items.map((_, i) => (
        <div key={i} className="ed-list__item">
          <EnumField path={[...path, i, 'network']} label={`Сеть ${i + 1}`} options={networks} />
          <PlainField path={[...path, i, 'url']} label={`Адрес ${i + 1}`} inputMode="url" />
          <ItemControls
            label={`Соцсеть ${i + 1}`}
            index={i}
            count={items.length}
            canRemove
            onMove={(to) => {
              const next = [...items];
              const [item] = next.splice(i, 1);
              next.splice(to, 0, item!);
              c.set(path, next);
            }}
            onRemove={() => c.set(path, items.filter((__, j) => j !== i))}
          />
        </div>
      ))}
      <Button
        type="button"
        tone="secondary"
        size="sm"
        disabled={c.readOnly || items.length >= 6}
        onClick={() => c.set(path, [...items, { network: 'INSTAGRAM', url: 'https://www.instagram.com/' }])}
      >
        Добавить соцсеть
      </Button>
    </Group>
  );
}

function GeoField() {
  const c = useEditor();
  const path: Path = ['site', 'contacts', 'geo'];
  const geo = getAt(c.spec, path) as { lat?: number; lng?: number } | undefined;
  const [draft, setDraft] = useState({ lat: geo?.lat?.toString() ?? '', lng: geo?.lng?.toString() ?? '' });
  const apply = (next: { lat: string; lng: string }) => {
    setDraft(next);
    const lat = Number(next.lat.replace(',', '.'));
    const lng = Number(next.lng.replace(',', '.'));
    if (next.lat.trim() === '' && next.lng.trim() === '') c.set(path, undefined);
    else c.set(path, { lat: Number.isFinite(lat) ? lat : next.lat, lng: Number.isFinite(lng) ? lng : next.lng });
  };
  return (
    <div className="ed-row">
      <Field label="Широта" controlId={pathId([...path, 'lat'])} error={c.errorAt([...path, 'lat'])}>
        <Input inputMode="decimal" value={draft.lat} disabled={c.readOnly} onChange={(e) => apply({ ...draft, lat: e.currentTarget.value })} />
      </Field>
      <Field label="Долгота" controlId={pathId([...path, 'lng'])} error={c.errorAt([...path, 'lng'])}>
        <Input inputMode="decimal" value={draft.lng} disabled={c.readOnly} onChange={(e) => apply({ ...draft, lng: e.currentTarget.value })} />
      </Field>
    </div>
  );
}

/** Пункты шапки или подвала: подпись и цель (страница, секция, внешняя ссылка) */
function NavList({ which, max, labelMax }: { which: 'header' | 'footer'; max: number; labelMax: number }) {
  const c = useEditor();
  const path: Path = ['navigation', which];
  const items = (getAt(c.spec, path) as unknown[] | undefined) ?? [];
  const title = which === 'header' ? 'Меню в шапке' : 'Ссылки в подвале';
  const pages = (c.spec['pages'] as Rec[] | undefined) ?? [];
  return (
    <Group title={title} testId={`ed-nav-${which}`}>
      <ol className="ed-list">
        {items.map((_, i) => (
          <li key={i} className="ed-list__item">
            <TextField path={[...path, i, 'label']} label={`Пункт ${i + 1}`} max={labelMax} required />
            <ActionField path={[...path, i, 'target']} label="Куда ведёт" kinds={TARGET_KINDS} />
            <ItemControls
              label={`Пункт ${i + 1}`}
              index={i}
              count={items.length}
              canRemove
              onMove={(to) => {
                const next = [...items];
                const [item] = next.splice(i, 1);
                next.splice(to, 0, item!);
                c.set(path, next);
              }}
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
        disabled={c.readOnly || items.length >= max}
        onClick={() =>
          c.set(path, [...items, { label: { [c.defaultLocale]: 'Пункт' }, target: { kind: 'PAGE', pageId: String(pages[0]?.['id'] ?? '') } }])
        }
      >
        Добавить пункт
      </Button>
    </Group>
  );
}

/** Настройки сайта: имя, слоган, языки, контакты, оформление, логотип, бронь, аналитика, SEO, навигация */
export function SiteForm() {
  const c = useEditor();
  const analytics = getAt(c.spec, ['integrations', 'analytics', 'mode']);
  const pages = (c.spec['pages'] as Rec[] | undefined) ?? [];
  const legal = getAt(c.spec, ['site', 'legal']);
  return (
    <div className="ed-form" data-testid="ed-site-form">
      <h2 className="ed-form__title">Настройки сайта</h2>
      <Group title="Название">
        <TextField path={['site', 'displayName']} label="Название сайта" max={80} required />
        <TextField path={['site', 'brand', 'tagline']} label="Слоган" max={120} />
      </Group>
      <LocalesField />
      <Group title="Контакты" testId="ed-contacts">
        <PlainField path={['site', 'contacts', 'phone']} label="Телефон" hint="В виде +77010000000" inputMode="tel" />
        <PlainField path={['site', 'contacts', 'whatsapp']} label="WhatsApp" hint="В виде +77010000000" inputMode="tel" />
        <PlainField path={['site', 'contacts', 'email']} label="Почта" inputMode="email" />
        <TextField path={['site', 'contacts', 'address']} label="Адрес" max={200} />
        <GeoField />
      </Group>
      <SocialField />
      <Group title="Оформление" testId="ed-theme">
        <div className="ed-grid">
          {(Object.keys(THEME_OPTIONS) as Array<keyof typeof THEME_OPTIONS>).map((key) => (
            <EnumField key={key} path={['theme', key]} label={THEME_LABEL[key]} options={THEME_OPTIONS[key]} />
          ))}
        </div>
      </Group>
      <Group title="Логотип и значок">
        <ImageField path={['site', 'brand', 'logo']} label="Логотип" kind="LOGO" required={false} />
        <FaviconField path={['site', 'brand', 'faviconAssetId']} />
      </Group>
      <Group title="Бронирование и аналитика" testId="ed-integrations">
        <EnumField
          path={['integrations', 'booking', 'mode']}
          label="Бронирование на сайте"
          options={[
            { value: 'WETOP_WIDGET', label: 'Форма бронирования WETOP' },
            { value: 'NONE', label: 'Без бронирования' },
          ]}
        />
        <p className="muted">Тариф бронирования выбирается при публикации.</p>
        <EnumField
          path={['integrations', 'analytics', 'mode']}
          label="Аналитика посещений"
          options={[
            { value: 'WETOP_TRACKER', label: 'Счётчик WETOP' },
            { value: 'NONE', label: 'Без аналитики' },
          ]}
        />
        {analytics === 'WETOP_TRACKER' && (
          <EnumField
            path={['integrations', 'analytics', 'consent']}
            label="Согласие посетителя"
            options={[
              { value: 'NOT_REQUIRED', label: 'Не спрашивать' },
              { value: 'WAIT_FOR_CONSENT', label: 'Ждать согласия' },
            ]}
          />
        )}
      </Group>
      <Group title="SEO сайта" testId="ed-site-seo">
        <EnumField
          path={['site', 'seo', 'robots']}
          label="Поисковики"
          options={[
            { value: 'INDEX', label: 'Показывать в поиске' },
            { value: 'NOINDEX', label: 'Не показывать в поиске' },
          ]}
        />
        <TextField path={['site', 'seo', 'titleTemplate']} label="Шаблон заголовка (одно %s)" max={80} />
        <EnumField
          path={['site', 'seo', 'structuredData', 'type']}
          label="Тип объекта для поисковиков"
          options={[
            { value: 'HOTEL', label: 'Гостиница' },
            { value: 'HOSTEL', label: 'Хостел' },
            { value: 'APARTMENT', label: 'Апартаменты' },
            { value: 'LODGING', label: 'Жильё' },
          ]}
        />
        <BoolField path={['site', 'seo', 'structuredData', 'includeAddress']} label="Передавать адрес поисковикам" />
        <BoolField path={['site', 'seo', 'structuredData', 'includeGeo']} label="Передавать координаты поисковикам" />
      </Group>
      <Group title="Юридические данные">
        {legal ? (
          <>
            <TextField path={['site', 'legal', 'operatorName']} label="Оператор сайта" max={200} />
            <EnumField
              path={['site', 'legal', 'privacyPageId']}
              label="Страница политики конфиденциальности"
              optional="Не выбрана"
              options={pages.map((p) => ({ value: String(p['id']), label: localizedText(p['title'], c.defaultLocale) }))}
            />
          </>
        ) : (
          <Button type="button" tone="secondary" size="sm" disabled={c.readOnly} onClick={() => c.set(['site', 'legal'], {})}>
            Добавить юридические данные
          </Button>
        )}
      </Group>
      <NavList which="header" max={7} labelMax={30} />
      <CtaField path={['navigation', 'headerCta']} label="Кнопка в шапке" required={false} />
      <NavList which="footer" max={12} labelMax={40} />
    </div>
  );
}

/** Страница: название, адрес (у главной пустой и не меняется), SEO и картинка для соцсетей */
export function PageForm({ pageIndex }: { pageIndex: number }) {
  const c = useEditor();
  const path: Path = ['pages', pageIndex];
  const page = getAt(c.spec, path) as Rec;
  const home = page['isHome'] === true;
  const og = getAt(c.spec, [...path, 'seo', 'og']) as Rec | undefined;
  return (
    <div className="ed-form" data-testid="ed-page-form">
      <h2 className="ed-form__title">Страница: {localizedText(page['title'], c.defaultLocale) || 'без названия'}</h2>
      <Group title="Страница">
        <TextField path={[...path, 'title']} label="Название страницы" max={70} required />
        <PlainField
          path={[...path, 'slug']}
          label="Адрес страницы"
          hint={home ? 'У главной страницы адрес пустой' : 'Латиница, цифры и дефис'}
          normalize={normalizePageSlug}
          disabled={home}
        />
      </Group>
      <Group title="SEO страницы" testId="ed-page-seo">
        <TextField path={[...path, 'seo', 'title']} label="Заголовок для поисковиков" max={60} />
        <TextField path={[...path, 'seo', 'description']} label="Описание для поисковиков" max={160} multiline />
        <BoolField path={[...path, 'seo', 'index']} label="Показывать страницу в поиске" />
        <BoolField path={[...path, 'seo', 'includeInSitemap']} label="Включить в карту сайта" />
        {og ? (
          <>
            <TextField path={[...path, 'seo', 'og', 'title']} label="Заголовок для соцсетей" max={70} />
            <TextField path={[...path, 'seo', 'og', 'description']} label="Описание для соцсетей" max={200} multiline />
            <PickOgImage path={[...path, 'seo', 'og']} />
          </>
        ) : (
          <Button type="button" tone="secondary" size="sm" disabled={c.readOnly} onClick={() => c.set([...path, 'seo', 'og'], {})}>
            Настроить вид в соцсетях
          </Button>
        )}
      </Group>
    </div>
  );
}

function PickOgImage({ path }: { path: Path }) {
  const c = useEditor();
  const assetId = getAt(c.spec, [...path, 'imageAssetId']) as string | undefined;
  const asset = c.assets.find((a) => a.id === assetId);
  return (
    <div className="ed-image" data-path={`${path.join('.')}.imageAssetId`}>
      {asset?.previewUrl ? <img className="ed-thumb" src={asset.previewUrl} alt="Картинка для соцсетей" /> : <span className="ed-thumb ed-thumb--empty">{assetId ? 'Нет в библиотеке' : 'Не выбрано'}</span>}
      <div className="ed-image__actions">
        <Button type="button" tone="secondary" size="sm" disabled={c.readOnly} onClick={() => c.pickAsset('IMAGE', (a) => c.set([...path, 'imageAssetId'], a.id))}>
          {assetId ? 'Заменить картинку для соцсетей' : 'Выбрать картинку для соцсетей'}
        </Button>
        {assetId && (
          <Button type="button" tone="ghost" size="sm" disabled={c.readOnly} onClick={() => c.set([...path, 'imageAssetId'], undefined)}>
            Убрать
          </Button>
        )}
      </div>
    </div>
  );
}

/** Секция: вид (варианты того же типа из реестра) и поля по реестру; поля чужого варианта скрыты и снимаются */
export function SectionForm({
  pageIndex,
  sectionIndex,
  ai,
}: {
  pageIndex: number;
  sectionIndex: number;
  ai: ReactNode;
}) {
  const c = useEditor();
  const path: Path = ['pages', pageIndex, 'sections', sectionIndex];
  const section = getAt(c.spec, path) as Rec;
  const shape = SITE_EDITOR_SECTIONS[String(section['type'])];
  if (!shape) return <p className="ed-error">Секции этого вида нет в редакторе.</p>;
  const variant = String(section['variant']);
  return (
    <div className="ed-form" data-testid="ed-section-form">
      <h2 className="ed-form__title">
        {shape.label}: {localizedText(section['heading'], c.defaultLocale) || 'без заголовка'}
      </h2>
      {ai}
      <EnumField
        path={[...path, 'variant']}
        label="Вид секции"
        options={shape.variants}
        onPick={(next) => c.set(path, applySectionVariant(section, next))}
      />
      {shape.fields
        .filter((f) => !f.variants || f.variants.includes(variant))
        .map((f) => (
          <FieldFor key={f.key} field={f} path={[...path, f.key]} />
        ))}
    </div>
  );
}

/** Команда ИИ: текст человека как данные; пусто у секции значит «пересобери, сохранив назначение» */
export type { Spec };
