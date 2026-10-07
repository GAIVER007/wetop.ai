# CI RED: mobile layout regressions

Run: https://github.com/GAIVER007/wetop.ai/actions/runs/37646528370

Candidate: d1461ddc3d757a76d36905af55614483083b34e2

```text

  1) tests/ui/chessboard-focus.spec.ts:64:1 › free panel outside click leaves focus on the selected control 
2026-10-07T16:18:28.7283617Z 
2026-10-07T16:18:28.7283883Z     Test timeout of 45000ms exceeded.
2026-10-07T16:18:28.7284398Z 
2026-10-07T16:18:28.7284720Z     Error: locator.click: Test timeout of 45000ms exceeded.
2026-10-07T16:18:28.7285174Z     Call log:
2026-10-07T16:18:28.7285651Z       - waiting for getByLabel('Поиск в календаре')
2026-10-07T16:18:28.7286971Z         - locator resolved to <input class="inp" value="R07" type="search" data-page-search="" aria-label="Поиск в календаре" placeholder="Гость, телефон, бронь, номер, койка"/>
2026-10-07T16:18:28.7287930Z       - attempting click action
2026-10-07T16:18:28.7288527Z         2 × waiting for element to be visible, enabled and stable
2026-10-07T16:18:28.7289082Z           - element is visible, enabled and stable
2026-10-07T16:18:28.7289701Z           - scrolling into view if needed
2026-10-07T16:18:28.7290135Z           - done scrolling
2026-10-07T16:18:28.7291422Z           - <div role="dialog" tabindex="-1" popover="manual" data-testid="free-menu" aria-label="Номер R07: 5 окт." class="stay-preview free-menu">…</div> intercepts pointer events
2026-10-07T16:18:28.7294750Z         - retrying click action
2026-10-07T16:18:28.7295106Z         - waiting 20ms
2026-10-07T16:18:28.7295537Z         2 × waiting for element to be visible, enabled and stable
2026-10-07T16:18:28.7295912Z           - element is visible, enabled and stable
2026-10-07T16:18:28.7296236Z           - scrolling into view if needed
2026-10-07T16:18:28.7296524Z           - done scrolling
2026-10-07T16:18:28.7297321Z           - <div role="dialog" tabindex="-1" popover="manual" data-testid="free-menu" aria-label="Номер R07: 5 окт." class="stay-preview free-menu">…</div> intercepts pointer events
2026-10-07T16:18:28.7297941Z         - retrying click action
2026-10-07T16:18:28.7298199Z           - waiting 100ms
2026-10-07T16:18:28.7298609Z         84 × waiting for element to be visible, enabled and stable
2026-10-07T16:18:28.7299095Z            - element is visible, enabled and stable
2026-10-07T16:18:28.7304246Z            - scrolling into view if needed
2026-10-07T16:18:28.7304554Z            - done scrolling
2026-10-07T16:18:28.7305369Z            - <div role="dialog" tabindex="-1" popover="manual" data-testid="free-menu" aria-label="Номер R07: 5 окт." class="stay-preview free-menu">…</div> intercepts pointer events
2026-10-07T16:18:28.7306008Z          - retrying click action
2026-10-07T16:18:28.7306266Z            - waiting 500ms
2026-10-07T16:18:28.7306417Z 
2026-10-07T16:18:28.7306424Z 
2026-10-07T16:18:28.7306543Z       70 |   await cell.click();
2026-10-07T16:18:28.7306921Z       71 |   await expect(page.getByTestId('free-menu')).toBeVisible();
2026-10-07T16:18:28.7307289Z     > 72 |   await search.click();
2026-10-07T16:18:28.7307545Z          |                ^
2026-10-07T16:18:28.7308085Z       73 |   await expect(page.getByTestId('free-menu')).toBeHidden();
2026-10-07T16:18:28.7308622Z       74 |   await expect(search).toBeFocused();
2026-10-07T16:18:28.7309083Z       75 | });
2026-10-07T16:18:28.7310783Z         at /home/runner/work/wetop.ai/wetop.ai/tests/ui/chessboard-focus.spec.ts:72:16
2026-10-07T16:18:28.7311335Z 
2026-10-07T16:18:28.7311893Z 

```

```text

  1) tests/ui/dashboard-design.spec.ts:68:1 › показатели: на телефоне таблица категорий складывается, а не обрезается прокруткой 
2026-10-07T16:16:14.0762965Z 
2026-10-07T16:16:14.0763127Z     Test timeout of 45000ms exceeded.
2026-10-07T16:16:14.0763387Z 
2026-10-07T16:16:14.0763753Z     Error: locator.click: Test timeout of 45000ms exceeded.
2026-10-07T16:16:14.0764273Z     Call log:
2026-10-07T16:16:14.0764887Z       - waiting for getByRole('main').locator('.pa-details > summary')
2026-10-07T16:16:14.0766009Z         - locator resolved to <summary>Подробности: ночи, средний чек, категории и источ…</summary>
2026-10-07T16:16:14.0766439Z       - attempting click action
2026-10-07T16:16:14.0766791Z         - waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0767164Z         - element is visible, enabled and stable
2026-10-07T16:16:14.0767485Z         - scrolling into view if needed
2026-10-07T16:16:14.0767763Z         - done scrolling
2026-10-07T16:16:14.0769546Z         - <a class="" href="/reservations">…</a> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0770164Z       - retrying click action
2026-10-07T16:16:14.0770513Z         - waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0770874Z         - element is visible, enabled and stable
2026-10-07T16:16:14.0771196Z         - scrolling into view if needed
2026-10-07T16:16:14.0771482Z         - done scrolling
2026-10-07T16:16:14.0772409Z         - <span>Брони</span> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0772954Z       - retrying click action
2026-10-07T16:16:14.0773227Z         - waiting 20ms
2026-10-07T16:16:14.0773618Z         2 × waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0773986Z           - element is visible, enabled and stable
2026-10-07T16:16:14.0774417Z           - scrolling into view if needed
2026-10-07T16:16:14.0774877Z           - done scrolling
2026-10-07T16:16:14.0776012Z           - <a class="" href="/reservations">…</a> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0777003Z         - retrying click action
2026-10-07T16:16:14.0777415Z           - waiting 100ms
2026-10-07T16:16:14.0778102Z         21 × waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0778782Z            - element is visible, enabled and stable
2026-10-07T16:16:14.0779351Z            - scrolling into view if needed
2026-10-07T16:16:14.0779732Z            - done scrolling
2026-10-07T16:16:14.0780455Z            - <a class="" href="/reservations">…</a> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0781036Z          - retrying click action
2026-10-07T16:16:14.0781289Z            - waiting 500ms
2026-10-07T16:16:14.0782149Z            - waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0782619Z            - element is visible, enabled and stable
2026-10-07T16:16:14.0782938Z            - scrolling into view if needed
2026-10-07T16:16:14.0783210Z            - done scrolling
2026-10-07T16:16:14.0783860Z            - <span>Брони</span> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0784640Z          - retrying click action
2026-10-07T16:16:14.0785084Z            - waiting 500ms
2026-10-07T16:16:14.0785594Z            - waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0786245Z            - element is visible, enabled and stable
2026-10-07T16:16:14.0786841Z            - scrolling into view if needed
2026-10-07T16:16:14.0787322Z            - done scrolling
2026-10-07T16:16:14.0788641Z            - <a class="" href="/reservations">…</a> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0789266Z          - retrying click action
2026-10-07T16:16:14.0789516Z            - waiting 500ms
2026-10-07T16:16:14.0790031Z            - waiting for element to be visible, enabled and stable
2026-10-07T16:16:14.0790572Z            - element is visible, enabled and stable
2026-10-07T16:16:14.0790887Z            - scrolling into view if needed
2026-10-07T16:16:14.0791157Z            - done scrolling
2026-10-07T16:16:14.0791872Z            - <a class="" href="/reservations">…</a> from <nav class="bottom-navigation" aria-label="Основная навигация">…</nav> subtree intercepts pointer events
2026-10-07T16:16:14.0792676Z          - retrying click action
2026-10-07T16:16:14.0792928Z            - waiting 500ms
2026-10-07T16:16:14.0793081Z 
2026-10-07T16:16:14.0793088Z 
2026-10-07T16:16:14.0793324Z       22 | async function details(main: import('@playwright/test').Locator) {
2026-10-07T16:16:14.0793930Z       23 |   const summary = main.locator('.pa-details > summary');
2026-10-07T16:16:14.0794479Z     > 24 |   await summary.click();
2026-10-07T16:16:14.0794748Z          |                 ^
2026-10-07T16:16:14.0795156Z       25 |   await expect(main.locator('.pa-details')).toHaveAttribute('open', '');
2026-10-07T16:16:14.0795520Z       26 | }
2026-10-07T16:16:14.0795726Z       27 |
2026-10-07T16:16:14.0796132Z         at details (/home/runner/work/wetop.ai/wetop.ai/tests/ui/dashboard-design.spec.ts:24:17)
2026-10-07T16:16:14.0796718Z         at /home/runner/work/wetop.ai/wetop.ai/tests/ui/dashboard-design.spec.ts:74:9
2026-10-07T16:16:14.0797045Z 
2026-10-07T16:16:14.0797763Z 

```

```text

  4) tests/ui/mobile-adaptation.spec.ts:25:1 › телефон: низ страницы не прячется под нижней навигацией 
2026-10-07T16:16:14.1404825Z 
2026-10-07T16:16:14.1405081Z     Error: /management/analytics: padding-bottom 16 < панель 69.5
2026-10-07T16:16:14.1405101Z 
2026-10-07T16:16:14.1405265Z     expect(received).toBeGreaterThanOrEqual(expected)
2026-10-07T16:16:14.1405273Z 
2026-10-07T16:16:14.1405370Z     Expected: >= 69.5
2026-10-07T16:16:14.1405474Z     Received:    16
2026-10-07T16:16:14.1405481Z 
2026-10-07T16:16:14.1405571Z       49 |       .first()
2026-10-07T16:16:14.1405815Z       50 |       .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
2026-10-07T16:16:14.1406311Z     > 51 |     expect(padBottom, `${route}: padding-bottom ${padBottom} < панель ${navHeight}`).toBeGreaterThanOrEqual(navHeight);
2026-10-07T16:16:14.1406591Z          |                                                                                      ^
2026-10-07T16:16:14.1406788Z       52 |     // и страница не едет вбок
2026-10-07T16:16:14.1406947Z       53 |     const overflow = await page.evaluate(
2026-10-07T16:16:14.1407185Z       54 |       () => document.documentElement.scrollWidth - window.innerWidth,
2026-10-07T16:16:14.1407461Z         at /home/runner/work/wetop.ai/wetop.ai/tests/ui/mobile-adaptation.spec.ts:51:86
2026-10-07T16:16:14.1407468Z 
2026-10-07T16:16:14.1407893Z 

```
