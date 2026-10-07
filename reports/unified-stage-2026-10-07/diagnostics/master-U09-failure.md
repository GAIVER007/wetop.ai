# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> U09 existing hotel fund and rates survive reopening wizard
- Location: tests/onboarding-full/acceptance.spec.ts:188:1

# Error details

```
Test timeout of 150000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 150000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/today" until "load"
  navigated to "http://127.0.0.1:56080/register/setup"
============================================================
```

# Test source

```ts
  103 |   await expect(page.getByRole('status')).toHaveText('Есть несохранённые изменения');
  104 |   await page.reload();
  105 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).not.toHaveValue('QA-unsaved');
  106 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  107 |   await page.getByRole('main').getByLabel('Название филиала').fill('QA-U05');
  108 |   await page.getByRole('button', { name: 'Назад', exact: true }).click();
  109 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeVisible();
  110 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  111 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  112 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  113 |   await page.goto('/auth/fallback');
  114 |   await page.goBack();
  115 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  116 |   await page.goForward();
  117 |   await page.goBack();
  118 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toHaveValue('QA-U05');
  119 | });
  120 | test('U06 invalid input never persists, correction proceeds', async ({ page, request }) => {
  121 |   const f = await fixture(request);
  122 |   await login(page, f);
  123 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  124 |   await expect(page.getByRole('main').getByLabel('Название филиала')).toBeVisible();
  125 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  126 |   const before = await snapshot(request);
  127 |   await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Invalid/Zone');
  128 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  129 |   await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  130 |   expect(await snapshot(request)).toEqual(before);
  131 |   await page.getByRole('main').getByLabel('Часовой пояс IANA').fill('Asia/Almaty');
  132 |   await page.getByRole('main').getByLabel('Название филиала').fill('');
  133 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  134 |   await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  135 |   expect(await snapshot(request)).toEqual(before);
  136 |   await page.getByRole('main').getByLabel('Название филиала').fill('QA-valid');
  137 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  138 |   await expect(page.getByRole('button', { name: 'Завершить настройку' })).toBeVisible();
  139 | });
  140 | test('U07 complete API disconnect preserves input and retry', async ({ page, request }) => {
  141 |   const f = await fixture(request);
  142 |   await login(page, f);
  143 |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-U07');
  144 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'offline' } });
  145 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  146 |   await expect(page.getByRole('button', { name: 'Повторить', exact: true })).toBeVisible();
  147 |   expect(new URL(page.url()).pathname).toBe('/register/setup');
  148 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
  149 |   await request.post(`${qa}/__qa/fault`, { data: { mode: 'none' } });
  150 |   await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  151 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  152 |   await page.reload();
  153 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-U07');
  154 | });
  155 | test('U08 completion replay is denied and re-login preserves completion', async ({
  156 |   page,
  157 |   request,
  158 | }) => {
  159 |   const f = await fixture(request);
  160 |   await login(page, f);
  161 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  162 |   await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  163 |   await page.getByRole('button', { name: 'Завершить настройку' }).click();
  164 |   await page.waitForURL('**/today');
  165 |   await page.reload();
  166 |   await page.waitForURL('**/today');
  167 |   const before = await snapshot(request);
  168 |   const headers = await apiSession(request, f);
  169 |   const current = await (await request.get(`${qa}/onboarding`, { headers })).json();
  170 |   expect(
  171 |     (
  172 |       await request.post(`${qa}/onboarding`, {
  173 |         headers,
  174 |         data: { action: 'complete', draft: current.draft, updatedAt: current.updatedAt },
  175 |       })
  176 |     ).status(),
  177 |   ).toBe(409);
  178 |   expect(await snapshot(request)).toEqual(before);
  179 |   await request.post(`${qa}/__qa/access`, { data: { revoke: true } });
  180 |   await page.goto('/auth/fallback');
  181 |   await page.getByRole('main').getByLabel('Email', { exact: true }).fill(f.email);
  182 |   await page.getByRole('main').getByLabel('Пароль', { exact: true }).fill(f.password);
  183 |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  184 |   await page.waitForURL('**/today');
  185 |   await page.goto('/register/setup');
  186 |   await page.waitForURL('**/today');
  187 | });
  188 | test('U09 existing hotel fund and rates survive reopening wizard', async ({ page, request }) => {
  189 |   const f = await fixture(request, 'HOSPITALITY');
  190 |   await login(page, f);
  191 |   await page.getByRole('main').getByLabel('Название категории').fill('QA-U09-room');
  192 |   await page
  193 |     .getByRole('main')
  194 |     .getByLabel(/Цена за ночь/)
  195 |     .fill('18000');
  196 |   await page.getByRole('main').getByLabel('Сколько мест').fill('2');
  197 |   await page.getByRole('button', { name: 'Запустить отель' }).click();
  198 |   await page.waitForURL('**/today');
  199 |   const before = await snapshot(request);
  200 |   expect(before.units).toBe(2);
  201 |   expect(before.rates).toBeGreaterThan(0);
  202 |   await page.goto('/register/setup');
> 203 |   await page.waitForURL('**/today');
      |              ^ Error: page.waitForURL: Test timeout of 150000ms exceeded.
  204 |   await page.reload();
  205 |   expect(await snapshot(request)).toEqual(before);
  206 | });
  207 | test('U10 read-only UI and direct API forbid writes', async ({ page, request }) => {
  208 |   const f = await fixture(request);
  209 |   const headers = await apiSession(request, f);
  210 |   await request.post(`${qa}/__qa/access`, { data: { status: 'READ_ONLY' } });
  211 |   await login(page, f);
  212 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  213 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
  214 |   const before = await snapshot(request);
  215 |   expect(
  216 |     (
  217 |       await request.post(`${qa}/onboarding`, {
  218 |         headers,
  219 |         data: { action: 'save', draft: { businessName: 'forbidden' }, updatedAt: null },
  220 |       })
  221 |     ).status(),
  222 |   ).toBe(403);
  223 |   expect(await snapshot(request)).toEqual(before);
  224 | });
  225 | test('U11 real STAFF rejected, MANAGER saved', async ({ page, request }) => {
  226 |   const f = await fixture(request);
  227 |   const headers = await apiSession(request, f);
  228 |   await request.post(`${qa}/__qa/access`, { data: { role: 'STAFF' } });
  229 |   await login(page, f);
  230 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  231 |   const before = await snapshot(request);
  232 |   expect(
  233 |     (
  234 |       await request.post(`${qa}/onboarding`, {
  235 |         headers,
  236 |         data: { action: 'save', draft: {}, updatedAt: null },
  237 |       })
  238 |     ).status(),
  239 |   ).toBe(403);
  240 |   expect(await snapshot(request)).toEqual(before);
  241 |   await request.post(`${qa}/__qa/access`, { data: { role: 'MANAGER' } });
  242 |   await page.reload();
  243 |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-manager');
  244 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  245 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  246 |   await page.reload();
  247 |   await expect(page.getByRole('main').getByLabel('Название бизнеса')).toHaveValue('QA-manager');
  248 | });
  249 | test('U12 full guarded API and UI isolate organizations', async ({ page, context, request }) => {
  250 |   const a = await fixture(request);
  251 |   await login(page, a);
  252 |   await page.getByRole('main').getByLabel('Название бизнеса').fill('QA-private-A');
  253 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  254 |   await expect(page.getByRole('status')).toHaveText('Сохранено');
  255 |   const headers = await apiSession(request, a);
  256 |   const branch = await (await request.post(`${qa}/__qa/branch`)).json();
  257 |   const branchHeaders = {
  258 |     ...headers,
  259 |     'x-wetop-scope': `business=${branch.businessId};location=${branch.locationId}`,
  260 |   };
  261 |   const branchState = await (
  262 |     await request.get(`${qa}/onboarding`, { headers: branchHeaders })
  263 |   ).json();
  264 |   expect(
  265 |     (
  266 |       await request.post(`${qa}/onboarding`, {
  267 |         headers: branchHeaders,
  268 |         data: {
  269 |           action: 'save',
  270 |           draft: { ...branchState.draft, businessName: 'QA-private-A2' },
  271 |           updatedAt: branchState.updatedAt,
  272 |         },
  273 |       })
  274 |     ).status(),
  275 |   ).toBe(201);
  276 |   expect(
  277 |     (await (await request.get(`${qa}/onboarding`, { headers })).json()).draft.businessName,
  278 |   ).toBe('QA-private-A');
  279 |   expect(
  280 |     (await (await request.get(`${qa}/onboarding`, { headers: branchHeaders })).json()).draft
  281 |       .businessName,
  282 |   ).toBe('QA-private-A2');
  283 |   const b = await fixture(request);
  284 |   const otherContext = await context.browser()!.newContext();
  285 |   const other = await otherContext.newPage();
  286 |   await login(other, b);
  287 |   await expect(other.getByRole('main').getByLabel('Название бизнеса')).not.toHaveValue(
  288 |     'QA-private-A',
  289 |   );
  290 |   const before = await snapshot(request);
  291 |   const foreign = {
  292 |     ...headers,
  293 |     'x-wetop-scope': `business=${b.businessId};location=${b.locationId}`,
  294 |   };
  295 |   expect((await request.get(`${qa}/onboarding`, { headers: foreign })).status()).toBe(403);
  296 |   expect(
  297 |     (
  298 |       await request.post(`${qa}/onboarding`, {
  299 |         headers: foreign,
  300 |         data: { action: 'save', draft: {}, updatedAt: null },
  301 |       })
  302 |     ).status(),
  303 |   ).toBe(403);
```