import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
const api = 'http://127.0.0.1:55844';
const evidence = '.onboarding-work/evidence/screenshots';
async function employeeCommands(id:string) {
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});
 try {await client.connect();const rows=await client.query<{action:string,count:number}>("select action,count(*)::int as count from pms_test.audit_logs where entity_id=$1 and (action like $2 or action in ($3,$4)) group by action",[id,'beauty.employee.%','employee_portal.services','employee_portal.profile']);return Object.fromEntries(rows.rows.map(r=>[r.action,r.count]));}
 finally {await client.end();}
}
async function registered(page: Page, vertical: string) {
  const email = `onboarding-compat-${randomUUID()}@example.invalid`;
  const businessName=`Бизнес Проверки ${randomUUID()}`;
  const registered = await page.request.post(`${api}/auth/register`, {data: {
    email, name: 'Тестовый Владелец', businessName, vertical,
    password: 'Onboarding-Test-2026!a', phoneCountry:'KZ', phone:'7000000000', privacyAccepted:true,
  }});
  const failure = registered.ok() ? '' : String((await registered.json()).message);
  expect(registered.ok(), `registration HTTP ${registered.status()}: ${failure}`).toBe(true);
  const mail = await (await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)).json();
  expect(mail.link).toBeTruthy();
  await page.goto(mail.link);
  await page.waitForURL(/55843\/(?:register\/setup|today|onboarding)/);
  await page.goto('/register/setup');
  return { email, link: String(mail.link), businessName };
}
async function checkLayout(page: Page) {
  for (const width of [320,390,768,1024,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect((await new AxeBuilder({page}).include('#main-content').analyze()).violations).toEqual([]);
  }
}

test('O21 Food v1 real registration, saved location and completion', async ({page})=>{
  await registered(page,'FOOD_SERVICE');
  const main=page.getByRole('main');
  await expect(main.getByRole('heading',{level:1})).toHaveText('Настройте Food Service');
  await main.getByLabel('Название бизнеса',{exact:true}).fill('Ресторан Проверки');
  await main.getByRole('button',{name:'Продолжить',exact:true}).click();
  await main.getByLabel('Название филиала',{exact:true}).fill('Филиал Проверки');
  await main.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.reload();
  await expect(main.getByLabel('Название филиала',{exact:true})).toHaveValue('Филиал Проверки');
  await main.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(main.getByText('Филиал Проверки',{exact:true})).toBeVisible();
  await main.getByRole('button',{name:'Завершить настройку',exact:true}).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.reload();await expect(page).toHaveURL(/\/today$/);
});

test('O21 Hospitality v1 real registration, category persistence and provisioning',async ({page})=>{
  await registered(page,'HOSPITALITY');
  const main=page.getByRole('main');
  await expect(main.getByRole('heading',{level:1})).toHaveText('Настройте отель');
  await main.getByLabel('Название категории',{exact:true}).fill('Тестовый номер');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(main.getByRole('status')).toContainText('Сохранено');
  await page.reload();
  await expect(main.getByLabel('Название категории',{exact:true})).toHaveValue('Тестовый номер');
  await main.getByRole('button',{name:'Запустить отель',exact:true}).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.reload();await expect(page).toHaveURL(/\/today$/);
});

test('O22/O23 Beauty extreme widths, reduced motion, keyboard and accessible errors',async ({page})=>{
  await registered(page,'BEAUTY');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Добро пожаловать в WETOP');
  await page.emulateMedia({reducedMotion:'reduce'});
  await checkLayout(page);
  const start=page.getByRole('button',{name:'Настроить салон',exact:true});
  await start.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{level:1})).toBeFocused();
  await checkLayout(page);
  await page.getByLabel('Название салона',{exact:true}).fill('');
  await page.getByRole('button',{name:'Сохранить и продолжить',exact:true}).click();
  // Обязательное поле останавливает отправку самим браузером: экран остаётся на основных сведениях,
  // список шагов не открывается (прежняя строка ждала счётчик шагов, который бывает только после сохранения)
  await expect(page.getByRole('heading',{name:'Основные сведения',exact:true})).toBeVisible();
  await expect(page.getByText(/Выполнено \d из 4 обязательных шагов/)).toHaveCount(0);
  expect(await page.getByLabel('Название салона',{exact:true}).evaluate((n)=>(n as HTMLInputElement).validity.valueMissing)).toBe(true);
  await expect(page.getByLabel('Название салона',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Название салона',{exact:true})).toBeFocused();
  await page.getByLabel('Название салона',{exact:true}).fill('Бизнес Проверки');
  await page.getByRole('button',{name:'Сохранить и продолжить',exact:true}).click();
  await expect(page.getByText('Выполнено 0 из 4 обязательных шагов',{exact:true})).toBeVisible();
  await checkLayout(page);
  await page.setViewportSize({width:320,height:844});
  await page.screenshot({path:`${evidence}/checklist-320-reduced-motion.png`,fullPage:true});
});

// ADR-095 keeps a bounded reuse window after the original successful confirmation.
test('O02/O03 confirmation in fresh browser and repeated link preserve original context',async ({page})=>{
  const {link}=await registered(page,'BEAUTY');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Добро пожаловать в WETOP');
  const cookies=await page.context().cookies('http://127.0.0.1:55843');
  const session=cookies.find(c=>c.name==='wetop_session')?.value;
  expect(session).toBeTruthy();
  const scope=cookies.find(c=>c.name==='wetop_scope')?.value;
  expect(scope).toBeTruthy();
  const headers={'x-wetop-session':session!,'x-wetop-scope':decodeURIComponent(scope!)};
  const before=await (await page.request.get(`${api}/auth/me`,{headers})).json();
  expect(before.context.businessId).toBeTruthy();
  const token=new URL(link).searchParams.get('token');
  const replay=await page.request.post(`${api}/auth/email/verify`,{data:{token}});
  expect(replay.status()).toBe(201);
  const renewed=await replay.json();
  const renewedContext=await (await page.request.get(`${api}/auth/registration-context`,{headers:{'x-wetop-session':renewed.token}})).json();
  expect(renewedContext.businessId).toBe(before.context.businessId);
  expect(renewedContext.locationId).toBe(before.context.locationId);
  expect((await page.request.post(`${api}/__onboarding-test/expire-verification`,{data:{token}})).ok()).toBe(true);
  const expired=await page.request.post(`${api}/auth/email/verify`,{data:{token}});
  expect([401,403]).toContain(expired.status());
  const after=await (await page.request.get(`${api}/auth/me`,{headers})).json();
  expect(after.context).toEqual(before.context);
  await page.reload();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Добро пожаловать в WETOP');
});

test('create then immediate services tab uses one canonical profile without profile rewrites', async ({ page }) => {
 await registered(page, 'BEAUTY');
 await page.getByRole('button', { name: 'Настроить салон', exact: true }).click();
 await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click();
 await expect(page.getByText('Выполнено 0 из 4 обязательных шагов', { exact: true })).toBeVisible();
 const cookies = await page.context().cookies('http://127.0.0.1:55843');
 const headers = { 'x-wetop-session': cookies.find(c => c.name === 'wetop_session')!.value, 'x-wetop-scope': decodeURIComponent(cookies.find(c => c.name === 'wetop_scope')!.value) };
 const service = await page.request.post(`${api}/beauty/services`, { headers, data: { creationId: randomUUID(), name: 'Услуга Диагностики', durationMinutes: '30', priceMinor: '0', currency: 'KZT', active: true } });
 expect(service.ok()).toBe(true);
 const serviceId = (await service.json()).id;
 await page.goto('/employees?onboarding=1');
 await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
 const dialog = page.getByRole('dialog');
 await dialog.getByLabel('Имя мастера', { exact: true }).fill('Мастер Диагностики');
 await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
 await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
 const canonicalUrl = page.url();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const manager = page.getByTestId('employee-manager');
 await expect(manager).toBeVisible();
 await page.screenshot({ path: `${evidence}/create-before-tab.png`, fullPage: true });
 await manager.getByRole('tab', { name: 'Услуги', exact: true }).click();
 await manager.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
 let skills = page.getByTestId('portal-services-form');
 await expect(skills.getByRole('checkbox', { name: /^Услуга Диагностики/ })).toBeVisible();
 await page.screenshot({ path: `${evidence}/create-after-tab.png`, fullPage: true });
 await skills.getByRole('checkbox', { name: /^Услуга Диагностики/ }).check();
 const rowsBefore = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
 expect(rowsBefore.items).toHaveLength(1);
 const employee = rowsBefore.items[0];
 const commandsBefore = await employeeCommands(employee.id);
 const profileBefore = { name: employee.name, phone: employee.phone, email: employee.email, active: employee.active, profileRevision: employee.profileRevision };
 await skills.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
 await expect(skills.getByRole('status')).toContainText('Сохранено на сервере');
 const commandsAfter = await employeeCommands(employee.id);
 expect((commandsAfter['employee_portal.services'] ?? 0) - (commandsBefore['employee_portal.services'] ?? 0)).toBe(1);
 expect(commandsAfter['beauty.employee.created']).toBe(commandsBefore['beauty.employee.created']);
 expect(commandsAfter['beauty.employee.services.set'] ?? 0).toBe(commandsBefore['beauty.employee.services.set'] ?? 0);
 expect(commandsAfter['beauty.employee.updated'] ?? 0).toBe(commandsBefore['beauty.employee.updated'] ?? 0);
 expect(commandsAfter['employee_portal.profile'] ?? 0).toBe(commandsBefore['employee_portal.profile'] ?? 0);
 let saved = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
 expect(saved.items).toHaveLength(1); expect(saved.items[0].id).toBe(employee.id); expect(saved.items[0].serviceIds).toEqual([serviceId]);
 expect({ name: saved.items[0].name, phone: saved.items[0].phone, email: saved.items[0].email, active: saved.items[0].active, profileRevision: saved.items[0].profileRevision }).toEqual(profileBefore);
 await page.reload();
 await expect(page).toHaveURL(`${canonicalUrl}#services`);
 await expect(page.getByTestId('employee-manager').getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute('aria-selected', 'true');
 await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
 skills = page.getByTestId('portal-services-form');
 await expect(skills.getByRole('checkbox', { name: /^Услуга Диагностики/ })).toBeChecked();
 await skills.getByRole('checkbox', { name: /^Услуга Диагностики/ }).uncheck();
 const saveServices = skills.getByRole('button', { name: 'Сохранить услуги', exact: true });
 await saveServices.focus();
 await expect(saveServices).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(skills.getByRole('status')).toContainText('Сохранено на сервере');
 await page.reload();
 await expect(page).toHaveURL(`${canonicalUrl}#services`);
 saved = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
 expect(saved.items).toHaveLength(1); expect(saved.items[0].id).toBe(employee.id); expect(saved.items[0].serviceIds).toEqual([]);
 expect({ name: saved.items[0].name, phone: saved.items[0].phone, email: saved.items[0].email, active: saved.items[0].active, profileRevision: saved.items[0].profileRevision }).toEqual(profileBefore);
 const finalCommands = await employeeCommands(employee.id);
 expect((finalCommands['employee_portal.services'] ?? 0) - (commandsBefore['employee_portal.services'] ?? 0)).toBe(2);
 expect(finalCommands['beauty.employee.created']).toBe(1);
 expect(finalCommands['beauty.employee.services.set'] ?? 0).toBe(commandsBefore['beauty.employee.services.set'] ?? 0);
 expect(finalCommands['beauty.employee.updated'] ?? 0).toBe(0);
 expect(finalCommands['employee_portal.profile'] ?? 0).toBe(0);
});

test('Employee mobile typography, confirmed scope and create cancellation',async ({page})=>{
 const {businessName}=await registered(page,'BEAUTY');
 await page.getByRole('button',{name:'Настроить салон',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить и продолжить',exact:true}).click();
 await expect(page.getByText('Выполнено 0 из 4 обязательных шагов',{exact:true})).toBeVisible();
 await page.goto('/employees?onboarding=1');
 await page.getByRole('button',{name:'Добавить специалиста',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Новый специалист',exact:true});
 for(const width of [320,390,600]){
  await page.setViewportSize({width,height:width===320?568:844});
  expect(await panel.getByLabel('Имя мастера',{exact:true}).evaluate(el=>getComputedStyle(el).fontSize)).toBe('17px');
  // CSS contract: 44px tap target; the centred dialog can render it at 43.99998 (subpixel), so compare whole pixels
  expect(await panel.getByLabel('Имя мастера',{exact:true}).evaluate(el=>getComputedStyle(el).minHeight)).toBe('44px');
  expect(Math.round((await panel.getByLabel('Имя мастера',{exact:true}).boundingBox())!.height)).toBeGreaterThanOrEqual(44);
 }
 await expect(panel.getByRole('region',{name:'Бизнес и филиал',exact:true})).toContainText(businessName);
 await panel.getByLabel('Имя мастера',{exact:true}).fill('Черновик Мастера');
 await panel.getByRole('button',{name:'Отмена',exact:true}).click();
 const confirm=page.getByRole('dialog',{name:'Несохранённые изменения',exact:true});
 await expect(confirm).toBeVisible();
 await confirm.getByRole('button',{name:'Остаться',exact:true}).click();
 await expect(panel.getByLabel('Имя мастера',{exact:true})).toHaveValue('Черновик Мастера');
 await panel.getByRole('button',{name:'Отмена',exact:true}).click();
 await confirm.getByRole('button',{name:'Не сохранять',exact:true}).click();
 await expect(panel).toHaveCount(0);
});
