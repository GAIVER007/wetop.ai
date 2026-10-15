import type { Page } from '@playwright/test';

/** UI5 (plans/ui5-fullpass-2026-10-14.md): общий замер страницы для обходчиков трёх стендов. */
export const UI5_VIEWS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
] as const;

export async function ui5Facts(page: Page, isPhone: boolean) {
  return page.evaluate((phone) => {
    const main = document.querySelector('main');
    const below: string[] = [];
    let minFont = 99;
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const cs = getComputedStyle(el);
      if (el.textContent?.trim() && cs.display !== 'none' && cs.visibility !== 'hidden') {
        const fs = parseFloat(cs.fontSize);
        if (
          fs &&
          fs < minFont &&
          el.children.length === 0 &&
          (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })
        )
          minFont = fs;
      }
      if (
        phone &&
        (el.matches('button, a[href], input, select, [role="tab"]') as boolean) &&
        (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })
      ) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && (b.height < 43.5 || b.width < 24)) {
          const key = `${el.tagName}:${(el.textContent || (el as HTMLElement).ariaLabel || '').trim().slice(0, 30)}`;
          if (!seen.has(key)) {
            seen.add(key);
            below.push(`${key} ${Math.round(b.width)}x${Math.round(b.height)}`);
          }
        }
      }
    }
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      minFont: minFont === 99 ? null : minFont,
      h1: document.querySelector('main h1')?.textContent?.trim() ?? null,
      mainEmpty: !main || main.innerText.trim().length < 3,
      smallTargets: below.slice(0, 12),
    };
  }, isPhone);
}
