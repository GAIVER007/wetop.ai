import { test, expect } from '../ui/fixtures';
import { date, seed } from './tz11-helpers';
for (const mode of ['same-date', 'different-date']) {
 test(`F02 accepted Back discards appointment draft ${mode}`,async({page,request})=>{
  await seed(page,request);
  await page.goto(`/appointments?date=${date}`);
  if(mode==='different-date') {
   // Use the real period navigation of the list for this history setup (the list has no day arrows).
   await page.getByLabel('Период с',{exact:true}).fill('2026-10-20');
   await page.getByLabel('Период по',{exact:true}).fill('2026-10-20');
   await page.getByRole('button',{name:'Показать период',exact:true}).click();
   await expect(page).toHaveURL(/from=2026-10-20&to=2026-10-20/);
  } else {
   await page.evaluate(()=>history.pushState({...history.state},'',location.href+'&reviewstep=1'));
  }
  await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Новая запись',exact:true});
  await panel.getByLabel('Имя клиента',{exact:true}).fill('Тест отбросить при переходе');
  await page.evaluate(()=>history.back());
  const confirm=page.getByRole('dialog',{name:'Закрыть без сохранения?',exact:true});
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button',{name:'Закрыть без сохранения',exact:true}).click();
  await expect(panel,'accepted departure must actually destroy the discarded editor').toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/appointments\\?date=${date}$`));
  await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
  await expect(panel.getByLabel('Имя клиента',{exact:true})).toHaveValue('');
  await expect(panel.getByLabel('Дата',{exact:true})).toHaveValue(date);
 });
}
