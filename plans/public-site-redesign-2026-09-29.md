# WETOP public homepage: content, design and interaction plan

Status: approved by owner 29.09.2026; implemented. Deployment evidence in reports/public-site-redesign-2026-09-29/README.md. Scope: www.wetop.ai, apps/site. No PMS business logic, schema or integration changes.

## Findings from live homepage and source

Repeated room-board, channels and payments descriptions across Audience, Showcase, Features and Toolkit. Technical metrics (minor-unit calculations, reconciliation tolerance) dominate customer-facing explanations. Hospitality demonstration is visually large and separated from its explanation. Generic platform positioning needs a clear distinction between the available hospitality product and future directions.

## Proposed reading sequence

1. Header: product, capabilities, industries, getting started; theme switch, login, single primary start action. Mobile menu with working anchors and focus return.
2. Hero: keep WETOP as a service-business management platform. One concrete promise, a short explanation and clearly labelled product demo. Primary start CTA plus secondary product tour. Show current Hospitality availability without implying future verticals are ready.
3. Connected workflow: request → reservation/appointment → customer → payment → report. Explain how information moves between existing modules. A selected step changes explanatory text and demo; demo actions do not write production data.
4. Capability explorer: guests and bookings; rooms and availability; channels and prices; money and reporting; AI sellers. Each selection has a user problem, existing actions, practical outcome and relevant preview. AI claims must be checked against current code and enabled product flow. Avoid fake sales/revenue claims.
5. Hospitality: concise introduction for hostels, mini-hotels and aparthotels, adjacent board preview and three concrete use cases. Different unit types explained in plain Russian. Future industries shown separately with an explicit development label.
6. Integrations and control: one compact visual showing PMS, website and supported channel manager connections. Explain what is exchanged and what the user must configure. Distinguish recorded payment methods from payment acquiring integrations. Remove duplicated logo walls and unsupported timing/accuracy guarantees.
7. Getting started: create account → configure property and team → start operations/connect channels. Explain each output and next action. Trial terms only if verified in current product configuration/documentation; no invented price or activation promises.
8. FAQ: fit for hostels, room vs bed sales, migration, channel setup, staff access, browser/mobile use and trial. Keyboard-accessible accordions; answers grounded in implemented product.
9. Final CTA and footer: one next action with verified destination, alternative contact, privacy and navigation. Blog only if useful published content exists; no empty showcase blocks.

## Visual direction

Premium restrained interface, consistent spacing and typography, balanced text/preview columns and fewer oversized empty panels. Dark and light themes. Clear distinction between real actions and illustrative demo UI; synthetic data labelled as examples. Effects: short section reveals, restrained hover highlights, active-tab transitions and a step highlight in workflow. No autoplay loop or effects required to read content. prefers-reduced-motion disables movement; content remains visible without JS. No heavy animation dependency, background video or generated image mockups.

## Implementation map

- apps/site/src/app/page.tsx: section order and composition.
- apps/site/src/components/landing/*: consolidated sections and interactive product exploration.
- apps/site/src/i18n/{ru,types}.ts: benefit-led copy and data contracts.
- apps/site/src/components/{site-header,site-footer,screen,...}: navigation and reused demo presentation where needed.
- Existing site styles: shared spacing, type scale, responsive layouts, dark/light tokens and reduced-motion rules.
- Relevant site/UI tests: navigation, CTAs, interactive previews, keyboard operation, FAQ, mobile menu and responsive overflow.

## Acceptance and release

Check actual product docs before publishing any capability, availability, trial or integration claim. Verify all anchors and CTA destinations; do not create real accounts or bookings for landing-page QA. Browser evidence at 390, 768 and 1440 widths, both themes, keyboard and reduced motion. Appropriate unit/UI tests, lint, typecheck and production build. Review diff; commit/push to main, deploy apps/site through its documented Cloudflare Pages workflow (separate from app.wetop.ai). Verify www and apex domains serve the expected release; never call repository push a deployment.

Implementation note: connections and payment-control explanations are consolidated into the capability explorer to avoid adding another repetitive panel. FAQ appears before the final start CTA.
