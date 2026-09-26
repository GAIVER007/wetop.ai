import {test,expect} from './fixtures';

test('агент из списка: редактирование, сохранение и повторное открытие',async({page,request})=>{
 await request.post('http://127.0.0.1:4311/__test/reset');
 await page.goto('/ai-seller/agents');
 await page.getByRole('link',{name:'Тестовый агент',exact:true}).click();
 await page.getByLabel('Имя ассистента').fill('Обновлённый агент');
 await page.getByLabel('Основная цель').fill('Подобрать размещение');
 await page.getByRole('button',{name:'Сохранить настройки'}).click();
 await expect(page.getByRole('status')).toContainText('Настройки сохранены');
 await page.reload();
 await expect(page.getByLabel('Имя ассистента')).toHaveValue('Обновлённый агент');
 await expect(page.getByLabel('Основная цель')).toHaveValue('Подобрать размещение');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'reports/agent-handoff-2026-09-26/editor-390.png',fullPage:true});
});
