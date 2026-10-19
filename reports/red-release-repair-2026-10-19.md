# Consolidated red-release repair register

Owner instructed 2026-10-19 to fix all red findings and publish through the real gate. Working draft679 is the consolidation branch; no production delivery claimed.

## Included, awaiting current combined full CI

- FIN-01: real RED3/3 -> focusedGREEN4/4; see finance-outflow-label-2026-10-19.md. No financial semantics change.
- Mobile salon followup from draft673 exact head a48f54bb62bf4b07a22378cf48aecaa8ab604515: retain selected specialist name on mobile; readable week navigation at <=600px. Only the two scoped CSS hunks and unchanged synthetic regression suite are integrated, not the entire old branch. Real original RED2/2 journal2026-10-18T16-11-56Z-e2e-79a6 and GREEN17/17 journal2026-10-18T16-13-04Z-e2e-22d6 retained byte-for-byte. These earlier tests do not replace combined-candidate CI. No original branch/history is deleted.

## Under investigation

Baseline fullmain39156107469 fails schema parity, several main UI shards, vertical fixture/onboarding sets. Read-only investigation lanes compare existing draft678 fixes before duplication. All skips, timeouts, financial/auth/tenant guards retained; no arbitrary snapshot regeneration.

## Deployment gate

Historical production source29fd2fda differs from currentmain2a8f7aab. Currentmain added ordinary customer-import migration132 and references separately held Beauty tables. Schema preparation and exact production migration approval remain distinct. No automatic production migration or blind merge of preparation-only678. Full candidate and resulting-main CI, immutable image/runtime/health and authenticated cloud proofs required before declaring published.
