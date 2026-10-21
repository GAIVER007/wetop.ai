'use client';
import { useActionState, useState, useTransition } from 'react';
import type { MarketingAdAssets, MarketingAdProposal } from '../../../../lib/api';
import { currencySign, formatMoney } from '../../../../lib/money';
import { Segmented } from '../../../../components/segmented';
import { Switch } from '../../../../components/switch';
import { Alert, Button, Field, Grid, Input, Select, Stack, Textarea } from '../../../../components/ui';
import { useConfirm } from '../../../../components/use-confirm';
import { launchAdAction, proposeAdAction, searchCityAction, type LaunchActionResult } from './actions';
import { captureVideoFrames } from './video-frames';

/**
 * Мастер «Новая кампания с ИИ» (DATA_MODEL §57, ADR-MKT-LAUNCH, техпроект §7): куда ведёт реклама, фото и пара фраз,
 * «Подготовить с ИИ» заполняет текст и аудиторию, человек правит и запускает. Кампания создаётся в Meta сразу
 * активной (решение владельца), поэтому перед запуском окно подтверждения с суммой в день.
 */
type Connected = Extract<MarketingAdAssets, { connected: true }>;
type Destination = 'WHATSAPP' | 'LEAD_FORM' | 'WEBSITE';
const DESTINATIONS: Array<{ value: Destination; label: string }> = [
  // коротко: три варианта в один ряд и на телефоне 320 px
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'LEAD_FORM', label: 'Форма заявки' },
  { value: 'WEBSITE', label: 'Сайт' },
];
const NONE: LaunchActionResult = { error: null, ok: 0 };
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

/** Видео креатива: сохраняется на сервере сразу при выборе (в действие формы такой файл не пройдёт), кадры для ИИ снимает браузер */
type VideoState =
  | { phase: 'none' }
  | { phase: 'loading' }
  | { phase: 'ready'; creativeId: string; frames: string[] }
  | { phase: 'error'; message: string };

async function saveVideo(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file, file.name);
  const res = await fetch('/marketing/ads/creatives', { method: 'POST', body });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(data.error ?? 'Не удалось сохранить видео, повторите позже');
  return data.id;
}

export function LaunchWizard({ assets, country }: { assets: Connected; country: string }) {
  const [proposed, propose, proposing] = useActionState(proposeAdAction, NONE);
  const [launched, launch, launching] = useActionState(launchAdAction, NONE);
  const { ask, dialog } = useConfirm();
  const [requestKey] = useState(() => crypto.randomUUID());
  const [destination, setDestination] = useState<Destination>('WHATSAPP');
  const [preview, setPreview] = useState<{ url: string; video: boolean } | null>(null);
  const [video, setVideo] = useState<VideoState>({ phase: 'none' });
  const [cities, setCities] = useState<Array<{ key: string; name: string }>>([]);
  const [found, setFound] = useState<Array<{ key: string; name: string; region: string }>>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [cityError, setCityError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [, startPropose] = useTransition();
  const advertisable = assets.pages.filter((page) => page.canAdvertise);
  const [pageId, setPageId] = useState(assets.defaults.pageId ?? advertisable[0]?.id ?? '');
  const page = assets.pages.find((x) => x.id === pageId);
  const sameCurrency = assets.cabinet.currency === assets.reportingCurrency;
  // предложение ИИ встаёт в поля: ключ полей меняется вместе с ответом, React пересоздаёт их с новыми значениями
  const p: MarketingAdProposal | null = proposed.proposal ?? null;
  const v = p ?? { headline: '', primaryText: '', description: null, ageMin: 18, ageMax: 65, genders: [], interests: [], welcome: null, notes: [] };
  const gender = v.genders.length === 1 ? String(v.genders[0]) : 'all';
  const fieldsKey = proposed.ok || 'empty';
  const error = launched.error ?? proposed.error;

  return (
    <form action={launch} className="panel" data-testid="ad-wizard">
      <input type="hidden" name="requestKey" value={requestKey} />
      <input type="hidden" name="destination" value={destination} />
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="cities" value={JSON.stringify(cities)} />
      <input type="hidden" name="cityName" value={cities[0]?.name ?? ''} />
      <input type="hidden" name="proposal" value={p ? JSON.stringify(p) : ''} />
      {preview?.video && (
        <>
          <input type="hidden" name="creativeKind" value="VIDEO" />
          <input type="hidden" name="creativeId" value={video.phase === 'ready' ? video.creativeId : ''} />
          {video.phase === 'ready' && video.frames.map((f, i) => <input key={i} type="hidden" name="frame" value={f} />)}
        </>
      )}
      <input type="hidden" name="instagramUserId" value={page?.instagramUserId ?? ''} />
      <Stack>
        <h2 className="budget-files__title">1. Куда ведёт реклама</h2>
        <Segmented label="Куда ведёт реклама" value={destination} options={DESTINATIONS} onChange={setDestination} />
        <Grid min={240}>
          <Field label="Страница Facebook" controlId="ad-page" required>
            <Select name="pageId" value={pageId} onChange={(e) => setPageId(e.target.value)} data-testid="ad-page">
              {advertisable.length === 0 && <option value="">Нет страниц с правом рекламы</option>}
              {advertisable.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          {destination === 'LEAD_FORM' && (
            <Field label="Номер формы заявки" controlId="ad-form" required hint="Форма создаётся в Meta Business Suite">
              <Input name="leadFormId" inputMode="numeric" data-testid="ad-form" />
            </Field>
          )}
          {destination === 'WEBSITE' && (
            <Field label="Адрес сайта" controlId="ad-link" required>
              <Input name="link" type="url" placeholder="https://" data-testid="ad-link" />
            </Field>
          )}
        </Grid>
        {page?.instagramUserId ? (
          <Switch name="useInstagram" label="Показывать и в Instagram" hint="Instagram, привязанный к странице" defaultChecked />
        ) : (
          <p className="settings-note">К странице не привязан Instagram: реклама пойдёт только в Facebook.</p>
        )}
        {assets.pagesError && <Alert boxed>{`Страницы не загрузились: ${assets.pagesError}`}</Alert>}

        <h2 className="budget-files__title">2. Креатив и оффер</h2>
        <Grid min={240}>
          <Field label="Фото или видео креатива" controlId="ad-creative" required hint="Фото JPEG или PNG до 8 МБ, видео MP4 или MOV до 200 МБ">
            <Input
              // видео в форме не едет: его номер и кадры лежат в скрытых полях (выше), файл сохраняется отдельно
              name={preview?.video ? undefined : 'creative'}
              type="file"
              accept="image/jpeg,image/png,video/mp4,video/quicktime"
              data-testid="ad-creative"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (preview) URL.revokeObjectURL(preview.url);
                if (!f) {
                  setPreview(null);
                  setVideo({ phase: 'none' });
                  return;
                }
                const isVideo = VIDEO_TYPES.includes(f.type);
                setPreview({ url: URL.createObjectURL(f), video: isVideo });
                if (!isVideo) {
                  setVideo({ phase: 'none' });
                  return;
                }
                if (f.size > VIDEO_MAX_BYTES) {
                  setVideo({ phase: 'error', message: 'Видео больше 200 МБ: выберите файл меньше' });
                  return;
                }
                setVideo({ phase: 'loading' });
                Promise.all([saveVideo(f), captureVideoFrames(f)]).then(
                  ([creativeId, frames]) => setVideo({ phase: 'ready', creativeId, frames }),
                  (err: unknown) => setVideo({ phase: 'error', message: err instanceof Error ? err.message : 'Не удалось сохранить видео' }),
                );
              }}
            />
          </Field>
          {preview &&
            (preview.video ? (
              // превью локального файла до загрузки: адрес blob
              <video src={preview.url} aria-label="Превью видео" className="ad-wizard__preview" muted controls playsInline />
            ) : (
              <img src={preview.url} alt="Превью креатива" className="ad-wizard__preview" />
            ))}
        </Grid>
        {preview?.video && (
          <p className="settings-note" role="status" data-testid="ad-video-status">
            {video.phase === 'loading' && 'Сохраняю видео…'}
            {video.phase === 'ready' &&
              (video.frames.length >= 2
                ? 'Видео сохранено. Кадры для ИИ сняты.'
                : 'Видео сохранено. Кадры для ИИ снять не удалось: текст объявления можно написать руками.')}
            {video.phase === 'error' && video.message}
          </p>
        )}
        <Field label="Об оффере в двух словах" controlId="ad-offer" hint="Что предлагаете и кому: ИИ напишет текст по фото и этим словам">
          <Textarea name="offer" rows={2} maxLength={500} data-testid="ad-offer" />
        </Field>
        <div>
          {/* вызов вручную, а не действием формы: React 19 после действия формы сбрасывает поля, и выбранный файл
              пропал бы до запуска; обязательные поля запуска здесь ещё не заполнены и не проверяются */}
          <Button
            type="button"
            tone="secondary"
            onClick={(e) => {
              const form = e.currentTarget.form;
              if (form) startPropose(() => propose(new FormData(form)));
            }}
            disabled={proposing}
            aria-busy={proposing}
            data-testid="ad-propose"
          >
            {proposing ? 'ИИ готовит…' : 'Подготовить с ИИ'}
          </Button>
        </div>
        {proposed.message && !proposed.error && <p className="settings-note" data-testid="ad-proposed">{proposed.message}</p>}

        <h2 className="budget-files__title">3. Текст и аудитория</h2>
        <Grid min={240} key={`t-${fieldsKey}`}>
          <Field label="Заголовок" controlId="ad-headline" required hint="до 40 знаков">
            <Input name="headline" maxLength={40} defaultValue={v.headline} data-testid="ad-headline" />
          </Field>
          <Field label="Описание" controlId="ad-description" required={false} hint="до 30 знаков, в Instagram не показывается">
            <Input name="description" maxLength={30} defaultValue={v.description ?? ''} />
          </Field>
        </Grid>
        <Field label="Текст объявления" controlId="ad-text" required key={`x-${fieldsKey}`}>
          <Textarea name="primaryText" rows={4} maxLength={500} defaultValue={v.primaryText} data-testid="ad-text" />
        </Field>
        {destination === 'WHATSAPP' && (
          <Grid min={240} key={`w-${fieldsKey}`}>
            <Field label="Приветствие в WhatsApp" controlId="ad-welcome" required={false}>
              <Input name="welcomeText" maxLength={200} defaultValue={v.welcome?.text ?? ''} />
            </Field>
            <Field label="Первая фраза клиента" controlId="ad-autofill" required={false} hint="подставится в сообщение">
              <Input name="welcomeAutofill" maxLength={100} defaultValue={v.welcome?.autofill ?? ''} />
            </Field>
          </Grid>
        )}
        <Grid min={160} key={`a-${fieldsKey}`}>
          <Field label="Возраст от" controlId="ad-age-min" required>
            <Input name="ageMin" type="number" min={18} max={65} defaultValue={v.ageMin} data-testid="ad-age-min" />
          </Field>
          <Field label="Возраст до" controlId="ad-age-max" required>
            <Input name="ageMax" type="number" min={18} max={65} defaultValue={v.ageMax} data-testid="ad-age-max" />
          </Field>
          <Field label="Пол" controlId="ad-gender" required>
            <Select name="gender" defaultValue={gender}>
              <option value="all">Все</option>
              <option value="2">Женщины</option>
              <option value="1">Мужчины</option>
            </Select>
          </Field>
        </Grid>
        <Switch name="advantageAudience" label="Разрешить Meta расширять аудиторию" hint="Advantage+: возраст «от» тогда только 18–25, «до» Meta не учитывает" />
        {p && p.interests.length > 0 && <p className="settings-note">Интересы по мнению ИИ (подсказка): {p.interests.join(', ')}</p>}
        <Stack gap="sm">
          <Grid min={240}>
            <Field label="Город" controlId="ad-city" required={false} hint="Пусто: вся страна">
              <Input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} data-testid="ad-city" />
            </Field>
            <div className="ad-wizard__find">
              <Button
                type="button"
                tone="secondary"
                disabled={searching || cityQuery.trim().length < 2}
                aria-busy={searching}
                data-testid="ad-city-find"
                onClick={() =>
                  startSearch(async () => {
                    const r = await searchCityAction(cityQuery, country);
                    setFound(r.cities);
                    setCityError(r.error);
                  })
                }
              >
                {searching ? 'Ищу…' : 'Найти город'}
              </Button>
            </div>
          </Grid>
          {cityError && <Alert boxed>{cityError}</Alert>}
          {found.length > 0 && (
            <ul className="ad-wizard__list" aria-label="Найденные города">
              {found.map((c) => (
                <li key={c.key}>
                  <Button
                    type="button"
                    tone="ghost"
                    size="sm"
                    onClick={() => {
                      if (!cities.some((x) => x.key === c.key)) setCities([...cities, { key: c.key, name: c.name }]);
                      setFound([]);
                      setCityQuery('');
                    }}
                  >
                    {c.region && c.region !== c.name ? `${c.name}, ${c.region}` : c.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {cities.length > 0 && (
            <ul className="ad-wizard__list" aria-label="Города показа" data-testid="ad-cities">
              {cities.map((c) => (
                <li key={c.key}>
                  <Button type="button" tone="ghost" size="sm" onClick={() => setCities(cities.filter((x) => x.key !== c.key))}>
                    Убрать {c.name}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Stack>

        <h2 className="budget-files__title">4. Бюджет и запуск</h2>
        <Grid min={240}>
          <Field
            label={`Бюджет в день, ${currencySign(assets.cabinet.currency)}`}
            controlId="ad-budget"
            required
            hint={
              assets.roomDailyMinor === null
                ? 'Плана Meta на месяц нет: задайте его в «Бюджете»'
                : `По плану Meta можно ещё до ${formatMoney(assets.roomDailyMinor, assets.reportingCurrency)} в день`
            }
          >
            <Input name="dailyBudget" inputMode="decimal" data-testid="ad-budget" />
          </Field>
          {!sameCurrency && (
            <Field label={`Курс: 1 ${assets.cabinet.currency} в ${assets.reportingCurrency}`} controlId="ad-fx" required hint="Как у расходов, вручную">
              <Input name="fxRate" inputMode="decimal" data-testid="ad-fx" />
            </Field>
          )}
        </Grid>
        {error && (
          <Alert boxed data-testid="ad-error">
            {error}
          </Alert>
        )}
        <div>
          <Button
            type="button"
            disabled={launching || !pageId || (preview?.video === true && video.phase !== 'ready')}
            aria-busy={launching}
            data-testid="ad-launch"
            onClick={async (e) => {
              const form = e.currentTarget.form;
              const budget = (form?.elements.namedItem('dailyBudget') as HTMLInputElement | null)?.value ?? '';
              const yes = await ask({
                title: 'Запустить кампанию в Meta?',
                body: `Кампания начнёт показы сразу после проверки Meta и будет тратить до ${budget || '…'} ${assets.cabinet.currency} в день. Остановить можно на «Рекламе».`,
                confirmLabel: 'Запустить',
              });
              if (yes) form?.requestSubmit();
            }}
          >
            {launching ? 'Запускаю…' : 'Запустить кампанию'}
          </Button>
        </div>
      </Stack>
      {dialog}
    </form>
  );
}
