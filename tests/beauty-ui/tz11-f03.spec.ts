import { test, expect } from '../ui/fixtures';
import { date, evidence, seed , nextDate } from './tz11-helpers';
for (const width of [1440,390]) for (const theme of ['light','dark'] as const) {
 test(`F03 list context reload history card and privacy ${width} ${theme}`,async({page,request})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  const f=await seed(page,request);const id=(await f.book('10:00',0,0,'Тест Искомый')).appointments[0].id;
  await f.book('12:00',1,1,'Тест Другой');await page.goto(`/appointments?date=${date}`);
  await page.getByRole('combobox',{name:'Специалист',exact:true}).selectOption(f.employees[0].id);
  await page.getByRole('combobox',{name:'Услуга',exact:true}).selectOption(f.services[0].id);
  await page.getByRole('combobox',{name:'Статус',exact:true}).selectOption('BOOKED');
  await page.getByRole('searchbox',{name:'Поиск клиента',exact:true}).fill('Искомый');
  expect(new URL(page.url()).searchParams.get('master')).toBe(f.employees[0].id);
  expect(new URL(page.url()).searchParams.get('service')).toBe(f.services[0].id);
  expect(new URL(page.url()).searchParams.get('status')).toBe('BOOKED');
  const snapshot=await page.evaluate(()=>JSON.stringify({url:location.href,state:history.state,session:{...sessionStorage},local:{...localStorage}}));
  expect(snapshot).not.toContain('Искомый');
  await page.getByRole('button',{name:'Тест Искомый',exact:true}).click();
  expect(new URL(page.url()).searchParams.get('appointment')).toBe(id);
  await page.getByRole('button',{name:'Закрыть: Запись',exact:true}).click();
  await expect(page.getByRole('searchbox',{name:'Поиск клиента',exact:true})).toHaveValue('Искомый');
  await page.reload();
  await expect(page.getByRole('combobox',{name:'Специалист',exact:true})).toHaveValue(f.employees[0].id);
  await expect(page.getByRole('combobox',{name:'Услуга',exact:true})).toHaveValue(f.services[0].id);
  await expect(page.getByRole('combobox',{name:'Статус',exact:true})).toHaveValue('BOOKED');
  // Policy boundary: no new PII persistence is approved. Reload intentionally clears only search.
  await expect(page.getByRole('searchbox',{name:'Поиск клиента',exact:true})).toHaveValue('');
  await page.screenshot({path:`${evidence}/screenshots/f03-list-${width}-${theme}.png`,fullPage:true});
  await page.getByRole('combobox',{name:'Статус',exact:true}).selectOption('DONE');
  await expect(page.getByText('Записей не найдено',{exact:true})).toBeVisible();
  await page.goBack();await expect(page.getByRole('combobox',{name:'Статус',exact:true})).toHaveValue('BOOKED');
  await page.goForward();await expect(page.getByRole('combobox',{name:'Статус',exact:true})).toHaveValue('DONE');
  await page.goBack();await page.getByRole('button',{name:'Тест Искомый',exact:true}).click();
  await page.reload();await expect(page.getByRole('dialog',{name:'Запись',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Закрыть: Запись',exact:true}).click();
  await page.getByTestId('beauty-day-date').fill(nextDate);
  await expect(page.getByTestId('beauty-day-date')).toHaveValue(nextDate);
  await expect(page.getByRole('combobox',{name:'Специалист',exact:true})).toHaveValue(f.employees[0].id);
  await page.goto(`/appointments?date=${date}&master=foreign&service=${f.services[0].id}&appointment=foreign`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Фильтр или запись недоступны');
  await expect(page.getByRole('dialog',{name:'Запись',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Тест Искомый',exact:true})).toHaveCount(0);
  await page.goto(`/appointments?date=${date}&master=${f.employees[0].id}&master=${f.employees[1].id}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Фильтр или запись недоступны');
 });
}
