import { test, expect } from '../ui/fixtures';
import { api, date, evidence, seed } from './tz11-helpers';
import { mkdirSync } from 'node:fs';
for (const entry of ['calendar', 'appointments']) {
  test(`F02 ${entry} dirty close preserves draft and explicit discard`, async ({ page, request }) => {
    test.setTimeout(180000);
    await seed(page, request);
    await page.goto(`/${entry}?date=${date}`);
    const open = () => page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Новая запись', exact: true });
    await open();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await open();
    await panel.getByLabel('Имя клиента', { exact: true }).fill('Тест несохранённый');
    await panel.getByLabel('Телефон', { exact: true }).fill('+77000000001');
    await panel.getByLabel('Заметка', { exact: true }).fill('Только вымышленные данные');
    await panel.getByLabel('Услуга', { exact: true }).selectOption({ index: 1 });
    await panel.getByLabel('Время', { exact: true }).fill('11:00');
    const confirm = page.getByRole('dialog', { name: 'Закрыть без сохранения?', exact: true });
    for (const way of ['escape', 'x', 'backdrop']) {
      if (way === 'escape') await page.keyboard.press('Escape');
      if (way === 'x') await panel.getByRole('button', { name: 'Закрыть: Новая запись', exact: true }).click();
      if (way === 'backdrop') await page.mouse.click(5, 5);
      await expect(confirm).toBeVisible();
      if (way === 'escape') await page.keyboard.press('Escape');
      else await confirm.getByRole('button', { name: 'Продолжить заполнение' }).click();
      await expect(panel.getByLabel('Имя клиента', { exact: true })).toHaveValue('Тест несохранённый');
      await expect(panel.getByLabel('Время', { exact: true })).toHaveValue('11:00');
    }
    mkdirSync(evidence + '/screenshots', { recursive: true });
    for (const width of [1440,390]) for (const theme of ['light','dark'] as const) {
      await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
      await panel.getByRole('button', { name: 'Закрыть: Новая запись', exact: true }).click();
      await expect(confirm).toBeVisible();
      await page.screenshot({ path: `${evidence}/screenshots/f02-${entry}-${width}-${theme}.png`, fullPage: true });
      await confirm.getByRole('button', { name: 'Продолжить заполнение' }).click();
    }
    await panel.getByRole('button', { name: 'Закрыть: Новая запись', exact: true }).click();
    await confirm.getByRole('button', { name: 'Закрыть без сохранения', exact: true }).click();
    await expect(panel).toBeHidden(); await open();
    await expect(panel.getByLabel('Имя клиента', { exact: true })).toHaveValue('');
  });
  test(`F02 ${entry} validation conflict success and double click`, async ({ page, request }) => {
    const f = await seed(page, request); await f.book('10:00');
    await page.goto(`/${entry}?date=${date}`);
    await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
    const p = page.getByRole('dialog', { name:'Новая запись',exact:true });
    // пустую форму отправить нельзя: «Записать» неактивна, пока не выбрана услуга (работа «Запись», f8a912681)
    await expect(p.getByRole('button', {name:'Записать',exact:true})).toBeDisabled();
    await expect(p).toBeVisible();
    await p.getByLabel('Имя клиента',{exact:true}).fill('Тест новый');
    await p.getByLabel('Услуга',{exact:true}).selectOption(f.services[0].id);
    await p.getByLabel('Время',{exact:true}).fill('10:00');
    await p.getByRole('button',{name:'Записать',exact:true}).click();
    await expect(p.getByRole('alert')).toBeVisible();
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест новый');
    await p.getByLabel('Время',{exact:true}).fill('11:00');
    await p.getByRole('button',{name:'Записать',exact:true}).dblclick();
    await expect(p).toBeHidden();
    const d=await (await request.get(api+`/beauty/appointments?date=${date}`,{headers:f.headers})).json();
    expect(d.appointments).toHaveLength(2);
  });
  test(`F02 ${entry} cross tab scope switch rejects stale form without POST`, async ({page,request})=>{
    const f=await seed(page,request);await page.goto(`/${entry}?date=${date}`);
    await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
    const p=page.getByRole('dialog',{name:'Новая запись',exact:true});
    await p.getByLabel('Имя клиента',{exact:true}).fill('Тест старый филиал');
    await p.getByLabel('Услуга',{exact:true}).selectOption(f.services[0].id);
    await page.context().addCookies([{name:'wetop_scope',value:encodeURIComponent(`business=${f.business};location=${f.locations[1]}`),domain:'127.0.0.1',path:'/'}]);
    const before=await (await request.get(api+'/__test/calls')).json();
    await p.getByRole('button',{name:'Записать',exact:true}).click();
    await expect(p.getByRole('alert')).toContainText('Контекст изменён');
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест старый филиал');
    const after=await (await request.get(api+'/__test/calls')).json();
    expect(after.slice(before.length).filter((path:string)=>path==='/beauty/appointments')).toHaveLength(0);
  });
}
