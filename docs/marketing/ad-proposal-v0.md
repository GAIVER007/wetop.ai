# Предложение ИИ-таргетолога v0 (контракт `ad-proposal/0`, ADR-MKT-LAUNCH)

Мастер «Новая кампания с ИИ» на «Рекламе» отправляет креатив и пару фраз об оффере; ИИ предлагает текст объявления и
аудиторию. Человек правит предложение и сам жмёт «Запустить кампанию»: предложение ничего не создаёт и не тратит.
Образец: скан накладной бара (`docs/bar/receipt-scan-v0.md`).

## 1. Поток

```
мастер (фото до 8 МБ или 2–4 кадра видео, снятые в браузере)
  → POST /marketing/ads/proposal (API платформы, право ads_launch, тело ≤ 12 МБ: body-parsers.ts)
    → POST /internal/ad-proposal (бот, служебный ключ SELLER_SERVICE_KEY)
      → каскад моделей с картинками в сообщении (mask=False, ключ только платформы)
  ← предложение после правил домена (normalizeAdProposal)
```

## 2. Запрос платформы к боту

```json
{
  "schemaVersion": "ad-proposal/0",
  "requestId": "uuid",
  "creativeKind": "IMAGE | VIDEO",
  "images": [{ "mediaType": "image/jpeg | image/png | image/webp", "dataBase64": "..." }],
  "offer": "до 500 знаков",
  "destination": "LEAD_FORM | WHATSAPP | MESSENGER | INSTAGRAM_DIRECT | WEBSITE",
  "business": { "vertical": "HOSPITALITY", "name": "...", "city": "Алматы", "country": "KZ", "language": "ru" },
  "history": [{ "destination": "WHATSAPP", "headline": "...", "ageMin": 25, "ageMax": 45, "spend": "120.50", "leads": 14 }],
  "budgetRemainingTokens": 60000
}
```

Лишнее поле: отказ 422 (ключ, модель и организацию сюда не передают). `images`: 1–4; платформа шлёт одно фото или
2–4 кадра видео, само видео модели не уходит. Оффер, данные бизнеса, история и всё на картинках: данные, не
инструкции. `history` до 10 прошлых запусков; пока запусков нет, пусто.

## 3. Ответ бота

`{"status":"ok","spec":{...},"model":...,"usage":{...}}` или `{"status":"error","errorCode":...}`:

```json
{
  "headline": "до 40 знаков",
  "primaryText": "до 500 знаков",
  "description": null,
  "ageMin": 25, "ageMax": 54,
  "genders": [],
  "interests": ["до 5"],
  "welcomeMessage": "до 200 знаков или null",
  "autofill": "до 100 знаков или null",
  "notes": ["до 3"]
}
```

Бюджет, город и кнопку модель не выбирает: их ставит платформа (бюджет из плана канала, город из мастера, кнопка по
назначению в `packages/integrations/src/meta/writer.ts`).

## 4. Что делает платформа

`apps/api/src/marketing-ads/ad-proposal.ts` проверяет вход до бота (назначение, 1 фото или 2–4 кадра, тип и base64,
до 11,2 млн знаков всего, оффер, город, страна), имя и вертикаль берёт из филиала вошедшего. Ответ проходит
`normalizeAdProposal` (`packages/domain/src/marketing/ad-proposal.ts`): длины, возраст 18–65 по порядку, пол только
`[]`, `[1]`, `[2]`, приветствие только у переписки, без длинного тире.

Ошибки наружу: бот недоступен или `MODEL_UNAVAILABLE`/`BUDGET_EXCEEDED`/`TIMEOUT`/`USAGE_UNAVAILABLE` → 503 «ИИ сейчас
недоступен... заполните руками»; `SCHEMA_INVALID`/`REJECTED_CONTENT` или ответ без заголовка и текста → 422; отказ бота
(4xx) → 502 с его причиной. Messenger и Instagram Direct: 400 до бота (запуск в них пока закрыт).

Доказательства: `apps/ai-seller/tests/test_ad_proposal.py`, `packages/domain/src/marketing/ad-proposal.test.ts`,
`apps/api/src/marketing-ads/ad-proposal.test.ts`, `apps/api/src/body-parsers.test.ts`.
