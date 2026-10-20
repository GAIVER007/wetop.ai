import { FIXTURE_API, expect, test } from './fixtures';

for (const width of [320, 390]) {
  test(`действия брони ${width}: гости из сохранённого проживания и границы полей`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/reset`);
    const response = await request.get(`${FIXTURE_API}/reservations/20260913-TESTAA`, { headers: { 'x-wetop-test-client': '1' } });
    expect(response.ok()).toBe(true);
    const card = await response.json();
    const item = card.items[0];
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/reservations/20260913-TESTAA#booking-actions');
    const actions = page.getByTestId('reservation-actions');
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Заселить', exact: true })).toBeVisible();
    const form = page.getByTestId(`guests-form-${item.id}`);
    await expect(form).toBeVisible();
    await expect(form.locator('[name="adults"]')).toHaveValue(String(item.adults));
    await expect(form.locator('[name="children"]')).toHaveValue(String(item.children));
    await expect(form.locator('[name="adults"]')).toHaveAttribute('min', '1');
    await expect(form.locator('[name="children"]')).toHaveAttribute('min', '0');
    for (const field of await form.locator('input[name="adults"], input[name="children"]').all()) {
      await expect(field).toHaveAttribute('step', '1');
      const box = (await field.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    // Failure-only, geometry-only: never serialize text, values or identifying attributes.
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) {
      const geometry = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const indices = new Map(elements.map((element, index) => [element, index]));
        const staticClasses = new Set([
          'panel', 'row', 'field', 'stack', 'stack--mt', 'stay-guests-form',
          'stay-guests-form__row', 'booking-head', 'table-wrap', 'table-scroll',
          'input', 'select', 'button', 'btn',
        ]);
        const describe = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            index: indices.get(element), tag: element.tagName.toLowerCase(),
            classes: Array.from(element.classList).filter((token) => staticClasses.has(token)),
            rect: { x: rect.x, y: rect.y, left: rect.left, right: rect.right, top: rect.top,
              bottom: rect.bottom, width: rect.width, height: rect.height },
            clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
            style: { display: style.display, minWidth: style.minWidth, width: style.width,
              maxWidth: style.maxWidth, overflowX: style.overflowX,
              gridTemplateColumns: style.gridTemplateColumns, flexWrap: style.flexWrap,
              whiteSpace: style.whiteSpace, position: style.position },
            intentionalScrollWrapper: /^(auto|scroll)$/.test(style.overflowX),
            // No pseudo content: only layout properties that could explain outward overflow.
            pseudo: ['::before', '::after'].map((pseudo) => {
              const computed = getComputedStyle(element, pseudo);
              return { pseudo, display: computed.display, width: computed.width,
                minWidth: computed.minWidth, maxWidth: computed.maxWidth,
                position: computed.position, left: computed.left, right: computed.right };
            }),
          };
        };
        const offenders = elements.filter((element) => {
          if (!element.getClientRects().length || getComputedStyle(element).display === 'none') return false;
          const rect = element.getBoundingClientRect();
          return rect.right > innerWidth + 1 || rect.left < 0 || element.scrollWidth > element.clientWidth + 1;
        }).map((element) => {
          const ancestors = [];
          let parent = element.parentElement;
          while (parent) {
            ancestors.push(describe(parent));
            if (parent.tagName === 'MAIN') break;
            parent = parent.parentElement;
          }
          return { element: describe(element), ancestors,
            insideIntentionalScrollWrapper: ancestors.some((ancestor) => ancestor.intentionalScrollWrapper) };
        });
        return { viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
          document: { clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth }, offenders };
      });
      await test.info().attach('booking-overflow-geometry', {
        body: JSON.stringify(geometry, null, 2), contentType: 'application/json',
      });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
