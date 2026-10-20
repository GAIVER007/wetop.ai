/* global document, localStorage, window */
import {test,expect} from '@playwright/test';
import {mkdirSync,appendFileSync} from 'node:fs';
import {fileURLToPath,URL} from 'node:url';
import process from 'node:process';
const API=process.env.PORTAL_API_URL || 'http://127.0.0.1:26831', WEB=process.env.PORTAL_WEB_URL || 'http://127.0.0.1:27036';
const OUT=process.env.PORTAL_EVIDENCE_DIR || fileURLToPath(new URL('../../test-results/employee-portal-evidence',import.meta.url));
const avatar=fileURLToPath(new URL('./fixtures/avatar.png',import.meta.url)),workImage=fileURLToPath(new URL('./fixtures/work.png',import.meta.url));
function scope(f,actor='staffA') {const a=f.actors[actor];return `business=${a.businessId}${actor==='ownerB'?'':`;location=${f.locationA}`}`;}
function headers(f,actor='staffA') {return {'x-wetop-session':actor,'x-wetop-scope':scope(f,actor)};}
async function call(request,f,path,{actor='staffA',method='get',data}={}) {
 const r=await request[method](API+path,{headers:headers(f,actor),...(data===undefined?{}:{data})});
 expect(r.ok(),`${method} ${path}: ${await r.text()}`).toBeTruthy();return r.json();
}
async function reset(request,vertical='BEAUTY') {const r=await request.post(API+'/__test/reset',{data:{vertical}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
async function context(browser,f,actor) {
 const c=await browser.newContext({baseURL:WEB,locale:'ru-RU',timezoneId:'Asia/Almaty',viewport:{width:1440,height:1000}});
 await c.addCookies([{name:'wetop_scope',value:encodeURIComponent(scope(f,actor)),domain:new URL(WEB).hostname,path:'/'},{name:'wetop_session',value:actor,domain:new URL(WEB).hostname,path:'/',httpOnly:true}]);return c;
}
async function select(page,name) {await page.getByRole('tab',{name,exact:true}).click();}
async function capture(page,key) {
 if(process.env.PORTAL_CAPTURE!=='1')return;
 mkdirSync(OUT+'/images',{recursive:true});
 for(const width of [1440,390])for(const theme of ['light','dark']) {
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  await page.evaluate(async t=>{document.documentElement.dataset.theme=t;localStorage.setItem('theme',t);await document.fonts.ready;},theme);
  await page.evaluate(()=>{window.scrollTo(0,0);for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;});
  const m=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  appendFileSync(OUT+'/measurements.ndjson',JSON.stringify({section:key,stage:'after',width,theme,...m})+'\n');
  await page.screenshot({path:`${OUT}/images/${key}-after-${width}-${theme}.png`,fullPage:true,caret:'initial',animations:'disabled',timeout:20000});
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
 }
}
async function seedProfessional(request,f) {
 let d=await call(request,f,`/employee-portal/employees/${f.employeeA}`,{actor:'ownerA'});
 d=await call(request,f,`/employee-portal/employees/${f.employeeA}/profile`,{actor:'ownerA',method:'patch',data:{name:'Анна Демонстрационная',headline:'Парикмахер-стилист',biography:'Демонстрационный профиль. Стрижки и укладки. На снимках тестовые иллюстрации, не работы реальных клиентов.',practiceSinceYear:2018,expectedRevision:d.profile.revision,expectedProfileRevision:d.employee.profileRevision}});
 await call(request,f,`/employee-portal/employees/${f.employeeA}/week`,{actor:'ownerA',method:'put',data:{intervals:Array.from({length:7},(_,weekday)=>({weekday,timeFrom:'09:00',timeTo:'18:00'})),expectedRevision:d.weekRevision}});
 // Weekly setup advances source revisions; later mutations need the post-setup snapshot.
 return call(request,f,`/employee-portal/employees/${f.employeeA}`,{actor:'ownerA'});
}
test('HTTP actor boundaries and public whitelist',async({request})=>{
 const f=await reset(request);let d=await seedProfessional(request,f);
 const mine=await call(request,f,'/employee-portal/me');expect(mine.employee.id).toBe(f.employeeA);
 for(const [actor,path] of [['staffA',`/employee-portal/employees/${f.employeeB}`],['ownerB',`/employee-portal/employees/${f.employeeA}`]]) {
  const r=await request.get(API+path,{headers:headers(f,actor)});expect([403,404]).toContain(r.status());
 }
 const noActor=await request.get(API+'/employee-portal/me');expect(noActor.status()).toBe(401);
 const missingProfileVersion=await request.patch(API+'/employee-portal/me/profile',{headers:headers(f),data:{headline:mine.profile.headline,expectedRevision:mine.profile.revision}});expect(missingProfileVersion.status()).toBe(400);expect((await missingProfileVersion.json()).message).toContain('expectedProfileRevision');
 const attack=await request.patch(API+'/employee-portal/me/profile',{headers:headers(f),data:{expectedRevision:mine.profile.revision,expectedProfileRevision:mine.employee.profileRevision,userId:f.actors.staffB.id}});expect(attack.status()).toBe(400);
 const payAttack=await request.put(API+'/employee-portal/me/pay-settings',{headers:headers(f),data:{model:'FIXED',fixedMinor:'999999',percent:0}});expect([403,404]).toContain(payAttack.status());
 d=await call(request,f,`/employee-portal/employees/${f.employeeA}/publication`,{actor:'ownerA',method:'put',data:{published:true,publicationConsent:true,expectedRevision:d.profile.revision}});
 const pub=await request.get(API+`/employee-portal/public/${d.profile.slug}`);expect(pub.status()).toBe(200);const p=await pub.json();
 expect(Object.keys(p).sort()).toEqual(['name','headline','biography','practiceSinceYear','slug','businessName','avatar','portfolio','locations','locationId','services','bookingUrl'].sort());
 expect(p.locationId).toBeNull();expect(p.services).toEqual([]);expect(p.locations).toHaveLength(2);
 expect(JSON.stringify(p)).not.toContain('private@example.invalid');
 const branch=await request.get(API+`/employee-portal/public/${d.profile.slug}?locationId=${f.locationA}`);expect(branch.ok()).toBeTruthy();expect((await branch.json()).services[0].priceMinor).toBe(mine.services.find(s=>s.id===f.serviceId).priceMinor);
});
test('both original profile versions reject stale writes without rereading tokens',async({request})=>{
 const f=await reset(request);const path=`/employee-portal/employees/${f.employeeA}`;
 const original=await call(request,f,path,{actor:'ownerA'});
 const winner=await call(request,f,path+'/profile',{actor:'ownerA',method:'patch',data:{name:'Synthetic winning specialist',headline:'Winning profile',expectedRevision:original.profile.revision,expectedProfileRevision:original.employee.profileRevision}});
 expect(winner.profile.revision).not.toBe(original.profile.revision);expect(winner.employee.profileRevision).not.toBe(original.employee.profileRevision);
 // Each request isolates one stale token; no fresh GET substitutes a token before either conflict.
 const staleEmployee=await request.patch(API+path+'/profile',{headers:headers(f,'ownerA'),data:{headline:'Stale employee overwrite',expectedRevision:winner.profile.revision,expectedProfileRevision:original.employee.profileRevision}});expect(staleEmployee.status()).toBe(409);
 const staleProfile=await request.patch(API+path+'/profile',{headers:headers(f,'ownerA'),data:{headline:'Stale profile overwrite',expectedRevision:original.profile.revision,expectedProfileRevision:winner.employee.profileRevision}});expect(staleProfile.status()).toBe(409);
 const saved=await call(request,f,path,{actor:'ownerA'});expect(saved.profile.headline).toBe('Winning profile');expect(saved.employee.name).toBe('Synthetic winning specialist');expect(saved.profile.revision).toBe(winner.profile.revision);expect(saved.employee.profileRevision).toBe(winner.employee.profileRevision);
});
test('real browser avatar/profile persistence, work approval and three views',async({browser,request})=>{
 // The functional gate stays short. The separate gallery pass also takes 32 full-page captures.
 test.setTimeout(process.env.PORTAL_CAPTURE==='1'?420000:90000);
 const f=await reset(request);await seedProfessional(request,f);
 const staff=await context(browser,f,'staffA');const page=await staff.newPage();
 await page.goto('/my-work');await expect(page.getByTestId('employee-self-master')).toBeVisible();
 await select(page,'Фото и работы');const photo=page.getByTestId('portal-avatar-form');
 await photo.getByLabel('Новое фото').setInputFiles(avatar);await photo.getByRole('button',{name:'Загрузить фото',exact:true}).click();await expect(photo.getByRole('status')).toContainText('Сохранено на сервере');
 const uploaded=await call(request,f,'/employee-portal/me');expect(uploaded.avatar).not.toBeNull();
 await expect.poll(()=>page.getByTestId('portal-avatar').getByRole('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 const binary=await request.get(uploaded.avatar.url);expect(binary.status()).toBe(200);expect((await binary.body()).subarray(0,4).toString()).toBe('RIFF');
 // An untouched sibling draft must adopt its new revision after the avatar save; edited drafts must not.
 await select(page,'Профиль');const profile=page.getByTestId('portal-profile-form');await profile.getByLabel('Специализация').fill('Парикмахер-стилист, обновлено в кабинете');
 await profile.getByRole('button',{name:'Сохранить профиль',exact:true}).click();await expect(profile.getByRole('status')).toContainText('Сохранено на сервере');
 await page.reload();await expect(page.getByLabel('Специализация')).toHaveValue('Парикмахер-стилист, обновлено в кабинете');
 await capture(page,'master-profile');
 await select(page,'Фото и работы');await page.locator('.portal-add-work > summary').click();const add=page.getByTestId('portal-add-work-form');
 await add.getByLabel('Фото работы').setInputFiles(workImage);await add.getByLabel('Название работы',{exact:true}).fill('Пример портфолио: тестовая иллюстрация');await add.getByLabel('Описание работы',{exact:true}).fill('Демонстрационные данные. Это не фото клиента и не реальная выполненная работа.');
 await add.getByLabel('Есть согласие на публичный показ этой работы').check();await add.getByRole('button',{name:'Добавить работу',exact:true}).click();await expect(add.getByRole('status')).toContainText('Сохранено на сервере');
 const draft=await call(request,f,'/employee-portal/me');expect(draft.portfolio).toHaveLength(1);expect(draft.portfolio[0].published).toBe(false);expect(draft.avatar.id).toBe(uploaded.avatar.id);
 await capture(page,'master-portfolio');await select(page,'Услуги');await capture(page,'master-services');await select(page,'График');await capture(page,'master-week');await expect(page.getByTestId('portal-nonworking')).toHaveCount(0);await select(page,'Оплата труда');await capture(page,'master-pay');
 const manager=await context(browser,f,'ownerA');const head=await manager.newPage();await head.goto(`/employees/${f.employeeA}/profile`);await expect(head.getByTestId('employee-manager')).toBeVisible();await capture(head,'manager-profile');
 const latest=await call(request,f,`/employee-portal/employees/${f.employeeA}`,{actor:'ownerA'});
 await call(request,f,`/employee-portal/employees/${f.employeeA}/portfolio/${latest.portfolio[0].id}`,{actor:'ownerA',method:'patch',data:{title:latest.portfolio[0].title,description:latest.portfolio[0].description,publicationConsent:true,published:true}});
 const version=await call(request,f,`/employee-portal/employees/${f.employeeA}`,{actor:'ownerA'});
 const published=await call(request,f,`/employee-portal/employees/${f.employeeA}/publication`,{actor:'ownerA',method:'put',data:{published:true,publicationConsent:true,expectedRevision:version.profile.revision}});
 const anonymous=await browser.newContext({baseURL:WEB,locale:'ru-RU',viewport:{width:1440,height:1000}});const client=await anonymous.newPage();await client.goto(`/specialists/${published.profile.slug}?locationId=${f.locationA}`);await expect(client.getByRole('heading',{name:'Анна Демонстрационная',exact:true})).toBeVisible();// ролью, а не текстом: пока поток не вставлен, копия страницы лежит в скрытом <div hidden id="S:0">
 await expect(client.getByRole('heading',{name:'Пример портфолио: тестовая иллюстрация',exact:true})).toBeVisible();await expect(client.getByTestId('portal-pay')).toHaveCount(0);await expect(client.locator('body')).not.toContainText('private@example.invalid');await capture(client,'public-specialist');
 await anonymous.close();await manager.close();await staff.close();
});
test('specialist list opens one canonical profile and creation lands on the same screen',async({browser,request})=>{
 const f=await reset(request);const manager=await context(browser,f,'ownerA');const page=await manager.newPage();
 await page.goto('/employees');const card=page.getByTestId('staff-row').filter({hasText:'Synthetic specialist A'});
 const open=card.getByRole('link',{name:'Открыть: Synthetic specialist A',exact:true});await expect(open).toHaveAttribute('href',`/employees/${f.employeeA}/profile`);await open.click();
 await expect(page).toHaveURL(new RegExp(`/employees/${f.employeeA}/profile$`));await expect(page.getByRole('heading',{name:'Карточка сотрудника',exact:true})).toBeVisible();await expect(page.getByTestId('employee-manager')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.goto(`/employees?employee=${f.employeeA}#profile`);await expect(page).toHaveURL(new RegExp(`/employees/${f.employeeA}/profile$`));await expect(page.getByTestId('employee-manager')).toBeVisible();
 await page.goto(`/beauty/masters?employee=${f.employeeA}#profile`);await expect(page).toHaveURL(new RegExp(`/employees/${f.employeeA}/profile$`));await expect(page.getByTestId('employee-manager')).toBeVisible();
 await page.goto('/employees');await page.getByRole('button',{name:'Добавить специалиста',exact:true}).click();const create=page.getByRole('dialog',{name:'Новый специалист',exact:true});await create.getByLabel('Имя мастера',{exact:true}).fill('Synthetic created specialist');await create.getByRole('button',{name:'Создать мастера',exact:true}).click();
 await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);await expect(page.getByRole('heading',{name:'Карточка сотрудника',exact:true})).toBeVisible();await expect(page.getByTestId('employee-manager')).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await manager.close();
});
test('waiter owns orders and existing payroll without salon controls',async({browser,request})=>{
 const f=await reset(request,'FOOD_SERVICE');const d=await call(request,f,'/employee-portal/me');
 expect(d.business.vertical).toBe('FOOD_SERVICE');expect(d.pay.status).toBe('AVAILABLE');expect(d.pay.earnedMinor).not.toBeNull();expect(d.orders.length).toBeGreaterThan(0);expect(d.orders.every(o=>typeof o.totalMinor==='string')).toBe(true);
 const c=await context(browser,f,'staffA');const page=await c.newPage();await page.goto('/my-work');await expect(page.getByTestId('employee-self-waiter')).toBeVisible();await expect(page.getByRole('tab',{name:'Услуги',exact:true})).toHaveCount(0);
 await select(page,'Заказы');await capture(page,'waiter-orders');await select(page,'Оплата труда');await expect(page.getByTestId('portal-pay')).toContainText('Бонусы');await capture(page,'waiter-pay');await c.close();
});

test('own schedule is read-only for the employee; the manager sets it',async({browser,request})=>{
 const f=await reset(request);await seedProfessional(request,f);
 const before=await call(request,f,'/employee-portal/me');
 // владелец 17.10.2026: сотрудник свой график только видит
 const denied=await request.put(API+'/employee-portal/me/week',{headers:headers(f),data:{intervals:[],expectedRevision:before.weekRevision}});expect(denied.status()).toBe(403);
 const off=await request.post(API+'/employee-portal/me/time-offs',{headers:headers(f),data:{dateFrom:'2035-02-01',dateTo:'2035-02-02'}});expect(off.status()).toBe(403);
 const c=await context(browser,f,'staffA');const page=await c.newPage();await page.goto('/my-work');await select(page,'График');
 await expect(page.getByTestId('portal-week-view')).toContainText('График меняет руководитель');
 await expect(page.getByRole('button',{name:'Сохранить график',exact:true})).toHaveCount(0);
 await expect(page.getByTestId('portal-time-offs')).toHaveCount(0);
 await call(request,f,`/employee-portal/employees/${f.employeeA}/week`,{actor:'ownerA',method:'put',data:{intervals:[{weekday:1,timeFrom:'10:00',timeTo:'19:00'}],expectedRevision:before.weekRevision}});
 await page.reload();await select(page,'График');await expect(page.getByTestId('portal-week-view')).toContainText('10:00–19:00');
 await c.close();
});

test('compact schedule fits one screen without dated-exceptions block',async({browser,request})=>{
 const f=await reset(request);await seedProfessional(request,f);
 const c=await context(browser,f,'staffA');const page=await c.newPage();await page.goto('/my-work');
 await select(page,'Фото и работы');const av=page.getByTestId('portal-avatar-form');await av.getByLabel('Новое фото').setInputFiles(avatar);await av.getByRole('button',{name:'Загрузить фото',exact:true}).click();await expect(av.getByRole('status')).toContainText('Сохранено на сервере');
 await page.locator('.portal-add-work > summary').click();const draft=page.getByTestId('portal-add-work-form');await draft.getByLabel('Фото работы').setInputFiles(workImage);await draft.getByLabel('Название работы',{exact:true}).fill('Тестовая работа');await draft.getByLabel('Описание работы',{exact:true}).fill('Вымышленная иллюстрация для проверки интерфейса.');await draft.getByRole('button',{name:'Добавить работу',exact:true}).click();await expect(draft.getByRole('status')).toContainText('Сохранено на сервере');await page.locator('.portal-add-work > summary').click();
 await select(page,'График');
 await expect(page.getByTestId('portal-nonworking')).toHaveCount(0);
 const dir=OUT+'/compact-v2';mkdirSync(dir,{recursive:true});
 // Requested one-screen desktop; mobile remains responsive, without hiding rows to force a fit.
 for(const [width,height] of [[1440,900],[1366,768]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);
  const view=await page.getByTestId('portal-week-view').boundingBox();
  expect(view.y+view.height,'own week fits screen').toBeLessThanOrEqual(height-(width<600?64:0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:`${dir}/schedule-${width}-${theme}.png`,fullPage:false,animations:'disabled',timeout:20000});
 }
 for(const [width,height] of [[1440,900],[1366,768]]){
 await page.setViewportSize({width,height});
 for(const [tab,key] of [['Профиль','profile'],['Записи','appointments'],['Услуги','services'],['Оплата труда','pay'],['Фото и работы','media']]){
  await select(page,tab);
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);
   const box=await page.locator('.portal-tabs .tabs__panel:not([hidden])').boundingBox();expect(box.y+box.height,`${tab} fits ${height}px desktop`).toBeLessThanOrEqual(height);
   await page.screenshot({path:`${dir}/${key}-${width}-${theme}.png`,fullPage:false,animations:'disabled',timeout:20000});
  }
 }
 }
 await c.close();
});

test('schedule add-time action stays next to hours and persists a split day',async({browser,request})=>{
 const f=await reset(request);await seedProfessional(request,f);const c=await context(browser,f,'ownerA');const page=await c.newPage();await page.setViewportSize({width:1366,height:768});await page.goto(`/employees/${f.employeeA}/profile`);await select(page,'График');
 const monday=page.getByRole('group',{name:'Понедельник',exact:true});const add=monday.getByRole('button',{name:'Понедельник: добавить интервал',exact:true});
 const last=await monday.getByRole('button',{name:'Понедельник: убрать интервал 1',exact:true}).boundingBox();const plus=await add.boundingBox();expect(plus.x-(last.x+last.width)).toBeLessThanOrEqual(16);await expect(add).toContainText('Ещё время');
 await monday.getByLabel('Понедельник: до, интервал 1',{exact:true}).fill('13:00');await add.click();await monday.getByLabel('Понедельник: начало',{exact:true}).nth(1).fill('14:00');await monday.getByLabel('Понедельник: до, интервал 2',{exact:true}).fill('18:00');await page.getByRole('button',{name:'Сохранить график',exact:true}).click();await expect(page.getByTestId('portal-week-form').getByRole('status')).toContainText('Сохранено на сервере');await page.reload();await select(page,'График');
 const d=await call(request,f,`/employee-portal/employees/${f.employeeA}`,{actor:'ownerA'});expect(d.week.find(x=>x.weekday===1).intervals).toEqual([{timeFrom:'09:00',timeTo:'13:00'},{timeFrom:'14:00',timeTo:'18:00'}]);
 const dir=OUT+'/compact-v3';mkdirSync(dir,{recursive:true});for(const theme of ['light','dark']){await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);await page.screenshot({path:`${dir}/schedule-split-${theme}.png`,fullPage:false,animations:'disabled',timeout:20000});}
 await c.close();
});

test('my services add button opens catalog and persists selection',async({browser,request})=>{
 const f=await reset(request);await seedProfessional(request,f);const initial=await call(request,f,'/employee-portal/me');await call(request,f,'/employee-portal/me/services',{method:'put',data:{serviceIds:[],expectedRevision:initial.servicesRevision}});
 const c=await context(browser,f,'staffA');const page=await c.newPage();await page.goto('/my-work');await select(page,'Услуги');
 await expect(page.getByRole('button',{name:'Добавить услугу',exact:true})).toBeVisible({timeout:3000});await page.getByRole('button',{name:'Добавить услугу',exact:true}).click();const form=page.getByTestId('portal-services-form');await expect(form).toBeVisible();await form.locator(`input[value="${f.serviceId}"]`).check();await form.getByRole('button',{name:'Сохранить услуги',exact:true}).click();await expect(form.getByRole('status')).toContainText('Сохранено на сервере');await page.reload();await select(page,'Услуги');
 const data=await call(request,f,'/employee-portal/me');expect(data.services.find(s=>s.id===f.serviceId).assigned).toBe(true);await expect(page.getByTestId('portal-assigned-services')).toContainText(data.services.find(s=>s.id===f.serviceId).name);
 const dir=OUT+'/compact-v3';mkdirSync(dir,{recursive:true});for(const theme of ['light','dark']){await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);await page.screenshot({path:`${dir}/services-${theme}.png`,fullPage:false,animations:'disabled',timeout:20000});}await c.close();
});

test('manager sets exact service price and duration while employee sees read-only services',async({browser,request})=>{
 const f=await reset(request);const manager=await context(browser,f,'ownerA');const page=await manager.newPage();await page.goto(`/employees/${f.employeeA}/profile`);await select(page,'Услуги');
 const editor=page.getByTestId('portal-service-prices');await expect(editor).toBeVisible();await expect(editor.locator('form')).toHaveCount(1);const form=editor.locator('form');
 await form.getByRole('combobox',{name:'Тип цены',exact:true}).selectOption('FIXED',{timeout:10000});await form.getByLabel('Цена, KZT',{exact:true}).fill('1234.56');await form.getByLabel('Длительность, минут',{exact:true}).fill('75');await form.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(editor.getByRole('status')).toContainText('Сохранено');
 const saved=await call(request,f,`/beauty/employees/${f.employeeA}/service-prices`,{actor:'ownerA'});const row=saved.find(item=>item.serviceId===f.serviceId);expect(row).toMatchObject({priceType:'FIXED',priceMinMinor:'123456',priceMaxMinor:'123456',durationMinutes:75,source:'MASTER'});
 await page.reload();await select(page,'Услуги');const persistedEditor=page.getByTestId('portal-service-prices');await expect(persistedEditor.locator('form')).toHaveCount(1);const persisted=persistedEditor.locator('form');await expect(persisted.getByLabel('Цена, KZT',{exact:true})).toHaveValue('1234.56');await expect(persisted.getByLabel('Длительность, минут',{exact:true})).toHaveValue('75');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth),`service price editor fits ${width}px`).toBeLessThanOrEqual(width);}
 await capture(page,'manager-service-price');
 const staff=await context(browser,f,'staffA');const own=await staff.newPage();await own.goto('/my-work');await select(own,'Услуги');await expect(own.getByTestId('portal-service-prices')).toHaveCount(0);await staff.close();await manager.close();
});

test('master sees own reviews and manager sees reviews of the selected master',async({browser,request})=>{
 test.setTimeout(process.env.PORTAL_CAPTURE==='1'?180000:90000);
 const f=await reset(request);
 const ownData=await call(request,f,'/employee-portal/me');
 expect(ownData.reviews).toMatchObject({averageStars:5,count:1,hasMore:false});
 expect(ownData.reviews.items).toEqual([expect.objectContaining({stars:5,comment:'Synthetic own review'})]);
 const selectedData=await call(request,f,`/employee-portal/employees/${f.employeeB}`,{actor:'ownerA'});
 expect(selectedData.reviews).toMatchObject({averageStars:4,count:1,hasMore:false});
 expect(selectedData.reviews.items).toEqual([expect.objectContaining({stars:4,comment:'Synthetic selected master review'})]);

 const staff=await context(browser,f,'staffA');const own=await staff.newPage();await own.goto('/my-work');await select(own,'Отзывы');
 const ownReviews=own.getByTestId('portal-reviews');await expect(ownReviews).toContainText('Synthetic own review');await expect(ownReviews).toContainText('5 из 5');await expect(ownReviews).not.toContainText('Synthetic selected master review');await expect(ownReviews).not.toContainText('Клиент:');await capture(own,'master-reviews');

 const manager=await context(browser,f,'ownerA');const selected=await manager.newPage();await selected.goto(`/employees/${f.employeeB}/profile`);await select(selected,'Отзывы');
 const selectedReviews=selected.getByTestId('portal-reviews');await expect(selectedReviews).toContainText('Synthetic selected master review');await expect(selectedReviews).toContainText('4 из 5');await expect(selectedReviews).not.toContainText('Synthetic own review');await expect(selectedReviews).not.toContainText('Клиент:');await capture(selected,'manager-selected-master-reviews');
 await manager.close();await staff.close();
});

test('manager saves an exact service material norm and sees server-calculated cost',async({browser,request})=>{
 test.setTimeout(process.env.PORTAL_CAPTURE==='1'?180000:90000);
 const f=await reset(request);const manager=await context(browser,f,'ownerA');const page=await manager.newPage();await page.goto('/beauty/services');
 await page.getByRole('button',{name:'Техкарта услуги: Synthetic haircut',exact:true}).click();const materials=page.getByTestId('beauty-service-materials');await expect(materials).toBeVisible();await expect(materials).toContainText('Материалы не добавлены');
 await materials.getByRole('button',{name:'Добавить материал',exact:true}).click();await expect(materials.getByLabel('Материал 1',{exact:true})).toHaveValue(/.+/);await materials.getByLabel('Норма, мл, материал 1',{exact:true}).fill('125.5');await materials.getByRole('button',{name:'Сохранить техкарту',exact:true}).click();await expect(materials.getByRole('status')).toContainText('Техкарта сохранена');
 const saved=await call(request,f,`/beauty/services/${f.serviceId}/materials`,{actor:'ownerA'});expect(saved).toMatchObject({revision:1,totalCostMinor:'15060',missingCost:false});expect(saved.items).toEqual([expect.objectContaining({productName:'Synthetic salon shampoo',unit:'мл',normQty:'125.5',costMinor:'15060'})]);
 await page.reload();await page.getByRole('button',{name:'Техкарта услуги: Synthetic haircut',exact:true}).click();const persisted=page.getByTestId('beauty-service-materials');await expect(persisted.getByLabel('Норма, мл, материал 1',{exact:true})).toHaveValue('125.5');await expect(persisted).toContainText('150,60');await capture(page,'service-materials');await manager.close();
});

test('personal finance shows real server amounts and never invents unavailable earnings',async({browser,request})=>{
 const dir=OUT+'/compact-v3';mkdirSync(dir,{recursive:true});
 for(const vertical of ['BEAUTY','FOOD_SERVICE']){
  const f=await reset(request,vertical);const data=await call(request,f,'/employee-portal/me');const c=await context(browser,f,'staffA');const page=await c.newPage();await page.goto('/my-work');await select(page,'Оплата труда');
  await expect(page.getByTestId('personal-finance')).toBeVisible({timeout:3000});await expect(page.getByLabel('Месяц расчёта',{exact:true})).toHaveValue(data.pay.month);
  const earned=page.getByTestId('finance-earned');if(data.pay.status==='AVAILABLE'){await expect(earned).toHaveAttribute('data-amount',data.pay.earnedMinor);}else{await expect(earned).toContainText('Нет расчёта');await expect(earned).not.toHaveAttribute('data-amount');}
  if(data.pay.paidMinor===null)await expect(page.getByTestId('finance-paid')).not.toHaveAttribute('data-amount');else await expect(page.getByTestId('finance-paid')).toHaveAttribute('data-amount',data.pay.paidMinor);await expect(page.getByTestId('portal-pay').locator('input[name="fixedMinor"],input[name="percent"]')).toHaveCount(0);
  for(const theme of ['light','dark']){await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);await page.screenshot({path:`${dir}/finance-${vertical.toLowerCase()}-${theme}.png`,fullPage:false,animations:'disabled',timeout:20000});}
  await page.getByLabel('Месяц расчёта',{exact:true}).fill('2026-09');await page.getByTestId('portal-pay').getByRole('button',{name:'Показать',exact:true}).click();await expect(page.getByTestId('personal-finance')).toHaveAttribute('data-month','2026-09');await expect(page.getByRole('tab',{name:'Оплата труда',exact:true})).toHaveAttribute('aria-selected','true');
  for(const width of [320,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth),'finance month form fits narrow mobile').toBeLessThanOrEqual(width);await expect(page.getByLabel('Месяц расчёта',{exact:true})).toBeVisible();await expect(page.getByTestId('portal-pay').getByRole('button',{name:'Показать',exact:true})).toBeVisible();}
  await c.close();
 }
});

test('public missing profile uses not-found handling',async({page,request})=>{
 const api=await request.get(API+'/employee-portal/public/nonexistent-slug');expect(api.status()).toBe(404);
 const response=await page.goto('/specialists/nonexistent-slug');
 // Installed Next docs: streamed notFound responses keep 200; non-streamed responses use 404.
 // Require the real not-found boundary and noindex, never merely accept a 200 warning page.
 expect([200,404]).toContain(response.status());
 await expect(page.getByRole('heading',{name:'Страница не найдена',exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('meta[name="robots"]').evaluateAll(nodes=>nodes.some(n=>(n.getAttribute('content')||'').split(',').map(v=>v.trim()).includes('noindex')))).toBe(true);
 await expect(page.getByTestId('employee-public')).toHaveCount(0);
});
