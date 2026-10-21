import { FIXTURE_API, test, expect } from './fixtures';
import { signInForBar } from './bar-auth';
for(const width of [1333,390]) test(`bar reference layout ${width}`,async({page})=>{
 await page.setViewportSize({width,height:973}); await page.goto('/bar');
 const main=page.getByRole('main').filter({visible:true});
 if(width<=600) await main.locator('.bar-analytics-disclosure > summary').click();
 await expect(main.getByRole('heading',{name:'Продажи по дням',exact:true})).toBeVisible();
 if(width<=600) await main.locator('.bar-analytics-disclosure > summary').click();
 await expect(main.locator('.bar-kpi')).toHaveCount(5);
 if(width>600) await expect(main.getByRole('columnheader',{name:'Цена закупки',exact:true})).toBeVisible();

 await expect(main.getByRole('button',{name:'Coca-Cola 0.5',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({fullPage:false,path:`reports/bar-reference-2026-10-14/${width}-after.png`});
});
test('inventory direct entry and existing handler',async({page})=>{
 await page.goto('/bar');await page.getByRole('link',{name:'Инвентаризация',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Инвентаризация',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Зафиксировать пересчёт',exact:true})).toBeVisible();
});

test('inventory uses the existing stock and action',async({page})=>{
 await page.goto('/bar/operations#bar-inventory');
 const panel=page.getByRole('tabpanel',{name:'Инвентаризация',exact:true}).filter({visible:true});
 await panel.getByRole('combobox',{name:'Товар',exact:true}).selectOption({label:'Сок Rich 0.2, по системе 12'});
 await expect(panel.getByLabel('По системе, шт.',{exact:true})).toHaveValue('12');
 await panel.getByLabel('Факт, шт.').fill('10');
 await panel.getByRole('button',{name:'Зафиксировать пересчёт',exact:true}).click();
 await expect(panel.getByRole('status')).toHaveText('Недостача 2 шт. зафиксирована');
});
test('sort stock preserves the loaded quantities',async({page})=>{
 await page.goto('/bar');
 const board=page.getByRole('region',{name:'Товары и остатки бара'});
 await board.getByRole('button',{name:/Остаток/}).click();
 await expect(board.locator('tbody tr').first()).toContainText("Чипсы Lay's 90г");
 await board.getByRole('button',{name:/Остаток/}).click();
 await expect(board.locator('tbody tr').first()).toContainText('Вода BonAqua 0.5');
});
test('mobile quick actions open the existing forms',async({page})=>{
 await page.setViewportSize({width:390,height:973});await page.goto('/bar');
 const actions=page.getByRole('navigation',{name:'Быстрые действия бара'});
 await actions.getByRole('link',{name:'Продажа',exact:true}).click();
 await expect(page.getByRole('button',{name:'Продать',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Разделы склада'}).getByRole('link',{name:'Поставщики',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Склад: поставщики');
});

for(const width of [1333,960,390]) for(const theme of ['light','dark'] as const) test(`clear KPI ${width} ${theme}`,async({page,request})=>{
 await request.post(`${FIXTURE_API}/__test/reset`);
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await page.setViewportSize({width,height:973});await page.goto('/bar');
 const kpis=page.getByRole('region',{name:'Показатели бара'});
 await expect(kpis.locator('.bar-kpi-label')).toHaveText(['Сумма закупок','Выручка бара','Прибыль от продаж','Долг поставщикам','Заканчиваются']);
 await expect(kpis.locator('.bar-kpi-value')).toHaveText(['412 800 ₸','1 245 600 ₸','623 400 ₸','68 400 ₸','2']);
 for(const label of await kpis.locator('.bar-kpi-label').all()){
  await expect(label).toBeVisible();expect(await label.evaluate(e=>e.scrollWidth<=e.clientWidth+1 && e.scrollHeight<=e.clientHeight+1)).toBeTruthy();
 }
 await kpis.locator('summary').click();await expect(kpis.getByRole('link',{name:'Red Bull 0.25',exact:true})).toBeVisible();await expect(kpis.getByRole('link',{name:"Чипсы Lay's 90г",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await kpis.locator('summary').click();
 await page.screenshot({path:`reports/bar-kpi-2026-10-14/${width}-${theme}.png`});
});

for (const width of [1333,390]) test(`direct sale visible labels and journal ${width}`,async({page,request})=>{
 await request.post(`${FIXTURE_API}/__test/reset`);
 await signInForBar(page);
 await page.setViewportSize({width,height:973});await page.goto('/bar');
 await page.getByRole('main').filter({visible:true}).getByRole('link',{name:'Продажа',exact:true}).filter({visible:true}).click();
 const panel=page.getByRole('tabpanel',{name:'Продажа напрямую',exact:true});
 await expect(panel.locator('.bar-retail-label')).toHaveText(['Товар','Количество, шт.','Способ оплаты']);
 await panel.getByLabel('Товар',{exact:true}).selectOption({label:'Coca-Cola 0.5, остаток 24 шт.'});
 await expect(panel.locator('.bar-retail-product-info')).toContainText('Coca-Cola 0.5');
 await panel.getByLabel('Количество, шт.',{exact:true}).fill('3');
 await page.screenshot({path:`reports/bar-direct-sale-2026-10-14/${width}.png`});
 await panel.getByRole('button',{name:'Продать',exact:true}).click();
 await expect(panel.locator('.bar-success[role="status"]')).toContainText('Продажа записана');
 await expect(panel.getByTestId('retail-recovery-panel')).toContainText('подтверждена');
 await panel.getByRole('button', { name: 'Новая продажа', exact: true }).click();
 await expect(panel.locator('.bar-retail-product-info')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 await page.goto('/bar/operations');
 await expect(page.getByRole('region',{name:'Продажи бара'}).locator('tbody tr').first()).toContainText('Coca-Cola 0.5 × 3');
});
