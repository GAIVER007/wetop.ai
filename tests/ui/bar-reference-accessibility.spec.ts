import {test,expect} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
for(const theme of ['light','dark'] as const) test(`bar pages readable and accessible ${theme}`,async({page})=>{
 test.setTimeout(180000); await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 for(const route of ['/bar','/bar/products','/bar/receipts','/bar/receipts/new','/bar/suppliers','/bar/operations','/bar/operations#bar-inventory','/bar/operations#bar-writeoff']){
  await page.setViewportSize({width:1333,height:973}); await page.goto(route);
  await expect(page.getByRole('main').filter({visible:true}).getByRole('heading',{level:1})).toBeVisible();
  const audit=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations,`${route} ${theme}`).toEqual([]);
  await page.screenshot({path:`reports/bar-reference-2026-10-14/${route.replace(/[^a-z]/g,'-')}-${theme}.png`});
  await page.setViewportSize({width:390,height:973});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} ${theme}`).toBeTruthy();
  if(route==='/bar') await page.screenshot({path:`reports/bar-reference-2026-10-14/mobile-${theme}.png`});
 }
});
