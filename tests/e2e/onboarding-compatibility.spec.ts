import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
const api = 'http://127.0.0.1:55844';
const evidence = '.onboarding-work/evidence/screenshots';
async function registered(page: Page, vertical: string) {
  const email = `onboarding-compat-${randomUUID()}@example.invalid`;
  const registered = await page.request.post(`${api}/auth/register`, {data: {
    email, name: 'Тестовый Владелец', businessName: `Бизнес Проверки ${randomUUID()}`, vertical,
    password: 'Onboarding-Test-2026!a', phoneCountry:'KZ', phone:'7000000000', privacyAccepted:true,
  }});
  const failure = registered.ok() ? '' : String((await registered.json()).message);
  expect(registered.ok(), `registration HTTP ${registered.status()}: ${failure}`).toBe(true);
  const mail = await (await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)).json();
  expect(mail.link).toBeTruthy();
  await page.goto(mail.link);
  await page.waitForURL(/55843\/(?:register\/setup|today|onboarding)/);
  await page.goto('/register/setup');
  return { email, link: String(mail.link) };
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
