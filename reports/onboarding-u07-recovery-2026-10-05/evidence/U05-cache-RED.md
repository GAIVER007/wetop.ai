# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> U05 unsaved/saved back and forward are explicit
- Location: tests/onboarding-full/acceptance.spec.ts:97:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByRole('main').getByLabel('Название филиала')
Expected: "QA-U05"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" getByRole('main').getByLabel('Название филиала') with timeout 5000ms
  - waiting for getByRole('main').getByLabel('Название филиала')

```

```yaml
- main:
  - paragraph: Настройка рабочего пространства
  - heading "Настройте Beauty" [level=1]
  - list "Прогресс настройки":
    - listitem: Бизнес
    - listitem: Филиал
    - listitem: Проверка
  - region "Бизнес":
    - heading "Бизнес" [level=2]
    - text: Название бизнеса
    - textbox "Название бизнеса": MV3-browser-full-5a79aa4d-9c68-4b4f-8991-fc3318ffb2f4
  - status: Нажмите «Сохранить», чтобы продолжить после перезагрузки.
  - button "Сохранить"
  - button "Продолжить"
- alert
```

# Test source

```ts
  12  |   await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Настройте/);
  13  | }
  14  | async function snapshot(request: APIRequestContext) {
  15  |   return (await request.get(`${qa}/__qa/snapshot`)).json();
  16  | }
  17  | async function apiSession(
  18  |   request: APIRequestContext,
  19  |   f: { email: string; password: string; businessId: string; locationId: string },
  20  | ) {
  21  |   const response = await request.post(`${qa}/auth/login`, {
  22  |     data: { email: f.email, password: f.password },
  23  |   });
  24  |   expect(response.ok()).toBe(true);
  25  |   const { token } = await response.json();
  26  |   return {
  27  |     'x-wetop-session': token,
  28  |     'x-wetop-scope': `business=${f.businessId};location=${f.locationId}`,
  29  |   };
  30  | }
  31  | test.afterAll(async ({ request }) =>
  32  |   expect((await request.post(`${qa}/__qa/cleanup`)).ok()).toBe(true),
  33  | );
  34  | test('U01 first launch uses verified vertical and creates no draft on read', async ({
  35  |   page,
  36  |   request,
  37  | }) => {
  38  |   const f = await fixture(request);
  39  |   const before = await snapshot(request);
  40  |   await login(page, f);
  41  |   await page.goto('/register/setup?vertical=HOSPITALITY');
  42  |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройте Beauty');
  43  |   expect(await snapshot(request)).toEqual(before);
  44  | });
  45  | test('U02 save/reload restores version, step and draft', async ({ page, request }) => {
  46  |   const f = await fixture(request);
  47  |   await login(page, f);
  48  |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U02');
  49  |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  50  |   await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  51  |   await page.reload();
  52  |   await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  53  |   const s = await snapshot(request);
  54  |   expect(s.progress).toHaveLength(1);
  55  |   expect(s.progress[0]).toMatchObject({
  56  |     flowVersion: 1,
  57  |     currentStep: 'location',
  58  |     draft: { businessName: 'QA-U02' },
  59  |   });
  60  | });
  61  | test('U03 close/reopen and real re-login preserve saved progress', async ({
  62  |   page,
  63  |   context,
  64  |   request,
  65  | }) => {
  66  |   const f = await fixture(request);
  67  |   await login(page, f);
  68  |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U03');
  69  |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  70  |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  71  |   const reopened = await context.newPage();
  72  |   await page.close();
  73  |   await reopened.goto('/register/setup');
  74  |   await expect(reopened.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U03');
  75  |   await request.post(`${qa}/__qa/access`, { data: { revoke: true } });
  76  |   await login(reopened, f);
  77  |   await expect(reopened.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U03');
  78  |   await reopened.close();
  79  | });
  80  | test('U04 commit with lost response, repeat and reload produce one progress', async ({
  81  |   page,
  82  |   request,
  83  | }) => {
  84  |   const f = await fixture(request);
  85  |   await login(page, f);
  86  |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U04');
  87  |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'after' } });
  88  |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  89  |   await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  90  |   const committed = await snapshot(request);
  91  |   await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  92  |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  93  |   await page.reload();
  94  |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U04');
  95  |   expect(await snapshot(request)).toEqual(committed);
  96  | });
  97  | test('U05 unsaved/saved back and forward are explicit', async ({ page, request }) => {
  98  |   const f = await fixture(request);
  99  |   await login(page, f);
  100 |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-unsaved');
  101 |   await expect(page.getByRole('status')).toHaveText('Есть несохранённые изменения');
  102 |   await page.reload();
  103 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).not.toHaveValue('QA-unsaved');
  104 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  105 |   await page.getByRole('main').getByLabel('Название филиала').fill('QA-U05');
  106 |   await page.getByRole('button', { name: 'Назад', exact: true }).click();
  107 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeVisible();
  108 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  109 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  110 |   await page.goto('/auth/fallback');
  111 |   await page.goBack();
> 112 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
      |                                                                       ^ Error: expect(locator).toHaveValue(expected) failed
  113 |   await page.goForward();
  114 |   await page.goBack();
  115 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  116 | });
  117 | test('U06 invalid input never persists, correction proceeds', async ({ page, request }) => {
  118 |   const f = await fixture(request);
  119 |   await login(page, f);
  120 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  121 |   const before = await snapshot(request);
  122 |   await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Invalid/Zone');
  123 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  124 |   await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  125 |   expect(await snapshot(request)).toEqual(before);
  126 |   await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Asia/Almaty');
  127 |   await page.getByRole('main').getByLabel('Название филиала').fill('');
  128 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  129 |   await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  130 |   expect(await snapshot(request)).toEqual(before);
  131 |   await page.getByRole('main').getByLabel('Название филиала').fill('QA-valid');
  132 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  133 |   await expect(page.getByRole('button', { name: 'Завершить настройку' })).toBeVisible();
  134 | });
  135 | test('U07 complete API disconnect preserves input and retry', async ({ page, request }) => {
  136 |   const f = await fixture(request);
  137 |   await login(page, f);
  138 |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U07');
  139 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'offline' } });
  140 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  141 |   await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  142 |   expect(new URL(page.url()).pathname).toBe('/register/setup');
  143 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
  144 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'none' } });
  145 |   await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  146 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  147 |   await page.reload();
  148 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
  149 | });
  150 | test('U08 completion replay is denied and re-login preserves completion', async ({
  151 |   page,
  152 |   request,
  153 | }) => {
  154 |   const f = await fixture(request);
  155 |   await login(page, f);
  156 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  157 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  158 |   await page.getByRole('button', { name: 'Завершить настройку' }).click();
  159 |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
  160 |   await page.reload();
  161 |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
  162 |   const before = await snapshot(request);
  163 |   const headers = await apiSession(request, f);
  164 |   const current = await (await request.get(`${qa}/onboarding`, { headers })).json();
  165 |   expect(
  166 |     (
  167 |       await request.post(`${qa}/onboarding`, {
  168 |         headers,
  169 |         data: { action: 'complete', draft: current.draft, updatedAt: current.updatedAt },
  170 |       })
  171 |     ).status(),
  172 |   ).toBe(409);
  173 |   expect(await snapshot(request)).toEqual(before);
  174 |   await request.post(`${qa}/__qa/access`, { data: { revoke: true } });
  175 |   await page.goto('/auth/fallback');
  176 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  177 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  178 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  179 |   await page.goto('/register/setup');
  180 |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('Настройка сохранена');
  181 | });
  182 | test('U09 existing hotel fund and rates survive reopening wizard', async ({ page, request }) => {
  183 |   const f = await fixture(request, 'HOSPITALITY');
  184 |   await login(page, f);
  185 |   await page.getByRole('main').getByLabel('Название категории').fill('QA-U09-room');
  186 |   await page
  187 |     .getByRole('main')
  188 |     .getByLabel(/Цена за ночь/)
  189 |     .fill('18000');
  190 |   await page.getByRole('main').getByLabel('Сколько мест').fill('2');
  191 |   await page.getByRole('button', { name: 'Запустить отель' }).click();
  192 |   await page.waitForURL('**/today');
  193 |   const before = await snapshot(request);
  194 |   expect(before.units).toBe(2);
  195 |   expect(before.rates).toBeGreaterThan(0);
  196 |   await page.goto('/register/setup');
  197 |   await page.waitForURL('**/today');
  198 |   await page.reload();
  199 |   expect(await snapshot(request)).toEqual(before);
  200 | });
  201 | test('U10 read-only UI and direct API forbid writes', async ({ page, request }) => {
  202 |   const f = await fixture(request);
  203 |   const headers = await apiSession(request, f);
  204 |   await request.post(`${qa}/__qa/access`, { data: { status: 'READ_ONLY' } });
  205 |   await login(page, f);
  206 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  207 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  208 |   const before = await snapshot(request);
  209 |   expect(
  210 |     (
  211 |       await request.post(`${qa}/onboarding`, {
  212 |         headers,
```