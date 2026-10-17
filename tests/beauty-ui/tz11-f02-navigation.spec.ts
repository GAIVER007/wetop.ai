import { test, expect } from '../ui/fixtures';
import { api, date, seed } from './tz11-helpers';
for (const entry of ['calendar','appointments']) {
  test(`F02 ${entry} unknown response stays open and cannot repeat command`, async ({page,request})=>{
    test.setTimeout(120000);
    const f=await seed(page,request);await page.goto(`/${entry}?date=${date}`);
    await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
    const p=page.getByRole('dialog',{name:'Новая запись',exact:true});
    await p.getByLabel('Имя клиента',{exact:true}).fill('Тест потерянный ответ');
    await p.getByLabel('Услуга',{exact:true}).selectOption(f.services[0].id);
    await p.getByLabel('Время',{exact:true}).fill('11:00');
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    let reached!:()=>void;const arrived=new Promise<void>(resolve=>{reached=resolve;});
    let commands=0;
    await page.route(url=>url.pathname===`/${entry}`,async route=>{
      if (route.request().method()!=='POST'||!route.request().headers()['next-action']) return route.continue();
      commands++;await route.fetch();reached();await gate;await route.abort('failed');
    });
    await p.getByRole('button',{name:'Записать',exact:true}).click(); await arrived;
    await expect(p.getByRole('button',{name:'Записываем…',exact:true})).toBeDisabled();
    await page.keyboard.press('Escape');await expect(p).toBeVisible();
    release();
    await expect(p.getByRole('alert')).toContainText('Результат не подтверждён');
    await expect(p.getByRole('button',{name:'Записать',exact:true})).toBeDisabled();
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест потерянный ответ');
    expect(commands).toBe(1);
    const d=await (await request.get(api+`/beauty/appointments?date=${date}`,{headers:f.headers})).json();
    expect(d.appointments).toHaveLength(1);
    const storage=await page.evaluate(()=>JSON.stringify({url:location.href,state:history.state,local:{...localStorage},session:{...sessionStorage}}));
    expect(storage).not.toContain('Тест потерянный ответ');
  });
  test(`F02 ${entry} navigation routes are individually exercised`,async({page,request})=>{
    test.setTimeout(120000);
    await seed(page,request);await page.goto(`/${entry}?date=${date}`);
    await page.evaluate(()=>history.pushState({...history.state},'',location.href+'&step=1'));
    await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
    const p=page.getByRole('dialog',{name:'Новая запись',exact:true});
    await p.getByLabel('Имя клиента',{exact:true}).fill('Тест переход');
    const confirm=page.getByRole('dialog',{name:'Закрыть без сохранения?',exact:true});
    // The modal makes background navigation inert to pointer clicks; capture also guards programmatic application links.
    await page.evaluate(()=>document.querySelector<HTMLAnchorElement>('a[href="/customers"]')?.click());
    await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Продолжить заполнение'}).click();
    await page.evaluate(()=>history.back());
    await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'Продолжить заполнение'}).click();
    // Back cancellation restores history asynchronously; assert the same final address, not an intermediate tick.
    await expect(page).toHaveURL(/step=1/);
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест переход');
    const cdp=await page.context().newCDPSession(page);
    const dialog=page.waitForEvent('dialog');const reload=cdp.send('Page.reload');
    const native=await dialog;expect(native.type()).toBe('beforeunload');await native.dismiss();await reload;
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест переход');
    await p.getByRole('button',{name:'Закрыть: Новая запись',exact:true}).click();
    await confirm.getByRole('button',{name:'Закрыть без сохранения',exact:true}).click();
    await page.evaluate(()=>history.back());await expect(page).not.toHaveURL(/step=1/);
    await page.getByRole('button',{name:'+ Новая запись',exact:true}).click();
    await p.getByLabel('Имя клиента',{exact:true}).fill('Тест вперёд');
    await page.evaluate(()=>history.forward());await expect(confirm).toBeVisible();
    await confirm.getByRole('button',{name:'Продолжить заполнение'}).click();
    await expect(p.getByLabel('Имя клиента',{exact:true})).toHaveValue('Тест вперёд');
  });
}
