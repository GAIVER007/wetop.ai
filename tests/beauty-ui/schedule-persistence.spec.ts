import { test, expect } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
for (const mobile of [false, true]) {
  test.describe(mobile ? 'mobile touch' : 'desktop', () => {
    test.use({viewport:mobile ? {width:390,height:844} : {width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
test('owner saves initially empty master week through onboarding schedule and reloads persisted hours', async ({page,request}) => {
  const reset = await request.post(`${api}/__test/reset`);
  expect(reset.ok()).toBe(true);
  const f = await reset.json();
  const scope = `business=${f.business};location=${f.locations[0]}`;
  const headers = {'x-wetop-scope':scope};
  await page.context().addCookies([{name:'wetop_scope',value:encodeURIComponent(scope),domain:'127.0.0.1',path:'/'}]);
  const service = await (await request.post(`${api}/beauty/services`,{headers,data:{name:'Synthetic service',durationMinutes:60,priceMinor:'10000',currency:'KZT'}})).json();
  expect((await request.put(`${api}/beauty/services/${service.id}/location`,{headers,data:{enabled:true}})).ok()).toBe(true);
  const employee = await (await request.post(`${api}/beauty/employees`,{headers,data:{name:'Synthetic schedule master'}})).json();
  expect((await request.put(`${api}/beauty/employees/${employee.id}/services`,{headers,data:{serviceIds:[service.id]}})).ok()).toBe(true);
  const read = async () => (await request.get(`${api}/beauty/schedule?employee=${employee.id}`,{headers})).json();
  const before = await read();
  expect(before.week.flatMap((d:{intervals:unknown[]})=>d.intervals)).toEqual([]);
  await page.goto('/beauty/schedule?onboarding=1');
  await page.getByRole('button',{name:'Synthetic schedule master',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('group',{name:'Понедельник',exact:true}).getByRole('button',{name:'Сделать рабочим',exact:true}).click();
  await dialog.getByLabel('Понедельник: начало').fill('09:00');
  await dialog.getByLabel('Понедельник: конец').fill('18:00');
  await dialog.getByRole('button',{name:'Сохранить график',exact:true}).click();
  await expect(dialog.getByRole('status')).toHaveText('График сохранён');
  const saved=await read();
  expect(saved.week[0].intervals).toEqual([{timeFrom:'09:00',timeTo:'18:00'}]);
  expect(saved.weekRevision).not.toBe(before.weekRevision);
  await page.reload();
  await page.getByRole('button',{name:'Synthetic schedule master',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Понедельник: начало')).toHaveValue('09:00');
  const status=await (await request.get(`${api}/onboarding`,{headers})).json();
  expect(status.readiness.steps.find((s:{id:string})=>s.id==='schedule').done).toBe(true);
  expect((await request.put(`${api}/beauty/employees/${employee.id}/working-hours`,{headers,data:{intervals:[],expectedRevision:before.weekRevision}})).status()).toBe(409);
  // Updating this employee's profile must not strand a pristine weekly editor on its previous source token.
  // правка специалиста живёт на странице профиля (старый адрес ведёт туда же); формы кабинета
  await page.goto(`/employees?employee=${employee.id}#profile`);
  await expect(page).toHaveURL(new RegExp(`/employees/${employee.id}/profile$`));
  const card=page.getByTestId('employee-manager');
  const profile=card.getByTestId('portal-profile-form');
  await profile.getByLabel('Имя в карточке',{exact:true}).fill('Synthetic updated master');
  await profile.getByRole('button',{name:'Сохранить профиль',exact:true}).click();
  await expect(profile.getByRole('status')).toContainText('Сохранено на сервере');
  await card.getByRole('tab',{name:'График',exact:true}).click();
  const week=card.getByTestId('portal-week-form');
  await week.getByLabel('Понедельник: до, интервал 1',{exact:true}).fill('19:00');
  await week.getByRole('button',{name:'Сохранить график',exact:true}).click();
  await expect(week.getByRole('status')).toContainText('Сохранено на сервере');
  const afterProfile=await read();
  expect(afterProfile.week[0].intervals).toEqual([{timeFrom:'09:00',timeTo:'19:00'}]);
  await page.screenshot({path:test.info().outputPath(`schedule-fix-${mobile ? 'mobile' : 'desktop'}.png`),fullPage:true});
  await week.getByLabel('Понедельник: до, интервал 1',{exact:true}).fill('20:00');
  await card.getByRole('tab',{name:'Профиль',exact:true}).click();
  const unsaved=page.getByRole('dialog',{name:'Несохранённые изменения',exact:true});
  await expect(unsaved).toBeVisible();
  await unsaved.getByRole('button',{name:'Остаться',exact:true}).click();
  await expect(week.getByLabel('Понедельник: до, интервал 1',{exact:true})).toHaveValue('20:00');
  const concurrent=await request.put(`${api}/beauty/employees/${employee.id}/working-hours`,{headers,data:{intervals:[{weekday:1,timeFrom:'09:00',timeTo:'21:00'}],expectedRevision:afterProfile.weekRevision}});
  expect(concurrent.ok()).toBe(true);
  await week.getByRole('button',{name:'Сохранить график',exact:true}).click();
  await expect(week.getByRole('alert')).toBeVisible();
  await expect(week.getByLabel('Понедельник: до, интервал 1',{exact:true})).toHaveValue('20:00');
  expect((await read()).week[0].intervals).toEqual([{timeFrom:'09:00',timeTo:'21:00'}]);
});
  });
}
