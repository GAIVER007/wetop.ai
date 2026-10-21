# CI RED: hidden streamed duplicate

Run: https://github.com/GAIVER007/wetop.ai/actions/runs/37653177214

```text
  1) tests/branches-ui/today.spec.ts:371:3 › MV8: «Сегодня» салона и ресторана на настоящем API › только чтение и администратор смены: экран дня открыт, числа те же
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9440605Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9440795Z     Error: {"role":"STAFF"}
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9440989Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9441158Z     expect(locator).toBeVisible() failed
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9441338Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9441485Z     Locator: getByTestId('food-today')
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9443255Z     Expected: visible
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9443709Z     Error: strict mode violation: getByTestId('food-today') resolved to 2 elements:
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9444517Z         1) <div class="vertical-today" data-testid="food-today">…</div> aka getByRole('main').getByTestId('food-today')
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9445035Z         2) <div class="vertical-today" data-testid="food-today">…</div> aka getByTestId('food-today').nth(1)
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9445241Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9445297Z     Call log:
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9445503Z       - {"role":"STAFF"} getByTestId('food-today') with timeout 5000ms
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9445732Z       - waiting for getByTestId('food-today')
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446058Z         3 × locator resolved to <div class="vertical-today" data-testid="food-today">…</div>
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446311Z           - unexpected value "hidden"
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446415Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446419Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446504Z       382 |         await setScope(page, scope);
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446696Z       383 |         await page.goto('/today');
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9446975Z     > 384 |         await expect(page.getByTestId(testId), JSON.stringify(control)).toBeVisible();
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9447278Z           |                                                                         ^
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9447532Z       385 |         await expect(page.getByTestId('today-error')).toHaveCount(0);
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9448048Z       386 |       }
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9448248Z       387 |     }
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9448653Z         at /home/runner/work/wetop.ai/wetop.ai/tests/branches-ui/today.spec.ts:384:73
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9448881Z
UI · branches-ui	Браузерный набор на подставном API и настоящей схеме	2026-10-07T16:41:31.9449297Z
```

Trace ancestor for the temporary copy: DIV hidden id=S:0 > MAIN > DIV data-testid=food-today. The other copy is inside the visible workspace main.
