import {test,expect} from './fixtures';
for(const width of [1333,390]) test(`bar reference layout ${width}`,async({page})=>{
 await page.setViewportSize({width,height:973}); await page.goto('/bar');
 const main=page.getByRole('main').filter({visible:true});
 if(width<=600) await main.locator('.bar-analytics-disclosure > summary').click();
 await expect(main.getByRole('heading',{name:'Продажи по дням',exact:true})).toBeVisible();
 if(width<=600) await main.locator('.bar-analytics-disclosure > summary').click();
 await expect(main.locator('.bar-kpi')).toHaveCount(6);
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
 await actions.getByRole('button',{name:'Разделы бара',exact:true}).click();
 await page.getByRole('menuitem',{name:'Поставщики',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Бар: поставщики');
});
