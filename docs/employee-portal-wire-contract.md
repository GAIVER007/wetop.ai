# Employee portal wire contract, approved contour 16.10.2026

Type boundary: `packages/domain/src/employee-portal/types.ts`, exported type-only from @pms/domain. Do not change it independently across implementation lanes; report gaps to parent.

Authenticated bases:
- manager: `/employee-portal/employees/:id`
- self: `/employee-portal/me`

GET base accepts `date=YYYY-MM-DD` for own appointments and `month=YYYY-MM` for pay. Returns EmployeePortalDto.

Private additive wire field `scheduleConflicts` (spec correction 16.10.2026):
- `{items, checkedFrom: UTC ISO timestamp, checkedCount: number, truncated: boolean}`.
- Each item is `{id,date,startsAt,endsAt,locationId,locationName,timezone,serviceName,reason}`. `date` is local to the appointment branch; `reason` is the existing domain `TIME_OFF` or `OUTSIDE_WORKING_HOURS`. No customer names, contacts, notes, prices or other employees are included in this projection.
- BEAUTY only: check this employee's first 500 upcoming/in-progress busy appointments (`BOOKED`, `CONFIRMED`, `DONE`, `endsAt > checkedFrom`), ordered by `startsAt,id`, across active assigned locations of the resolved business. Fetch at most 501 rows to detect truncation. FOOD_SERVICE returns an empty check. This is independent of the selected day filter.
- Reuse `fitsSchedule` with each appointment branch's timezone and working hours plus this employee's inclusive absence dates. Week changes affect only the selected assigned branch, absences apply to this employee across branches. Read and write responses recompute the projection; this is a current-state warning, not a cancellation or payment command. Existing optimistic week revision checks and client draft guards are unchanged.
- The week tab displays warnings, the affected list, an absence create/list/delete form and explicit empty/incomplete states. If more than 500 appointments exist, it warns that the rest need review with the manager; it must not claim a complete all-clear.

PATCH base + `/profile`: PortalProfileInput, returns DTO.
PUT/DELETE base + `/avatar`: multipart field `file` for PUT, returns DTO.
POST base + `/portfolio`: multipart `file`, `title`, `description`, optional `serviceId`, `publicationConsent`, `published`; returns DTO. Self may upload draft but cannot publish.
PATCH/DELETE base + `/portfolio/:workId`: metadata JSON for PATCH, returns DTO. Work must belong to resolved Employee and business.
PUT base + `/publication`: PortalPublicationInput; manager only, self forbidden, returns DTO.
PUT base + `/services`: `{serviceIds:string[], expectedRevision:string}`; validated current business catalog and expected services revision; returns DTO.
PUT base + `/week`: `{intervals:[{weekday,timeFrom,timeTo}],expectedRevision:string}`; current authorized assigned branch; returns DTO.
POST base + `/time-offs`: `{dateFrom,dateTo,reason}` and DELETE base + `/time-offs/:id`; own employee only, preserve existing appointments; returns DTO.
PUT base + `/account`: `{userId:string}`; manager only, existing verified member authorized for the same business; no account guessing, new passwords or role escalation. DELETE unlinks. Returns DTO. Existing non-null different link conflicts, not silent reassignment.
PUT base + `/pay-settings`: manager only, existing parsePaySettings contract/model (fixedMinor string, percent integer, model, currency checked against business). Returns DTO. Self forbidden.
PUT `/employee-portal/pay-policy`: manager only, `{percentBasis:'COMPLETED_SERVICES'|'PAID_COMPLETED_SERVICES',expectedRevision?:string}`; store per-BEAUTY-business policy with optimistic concurrency. Return `{percentBasis,revision}`. Changes do not reinterpret existing restaurant payroll.

GET `/employee-portal/public/:slug?locationId=...` is explicitly public and returns PublicEmployeeDto only. Validate published profile, employee/business/organization active, publication consent, published/consented work and enabled effective service pricing. Never return private DTO and hide fields in frontend. If multiple branches and no selected location, return location choices without invented default prices; one active branch may be chosen automatically. Nonexistent/draft/archived => 404.

Public service pricing correction (approved Beauty master-price precedence): for the selected assigned branch and specialist resolve MASTER > LOCATION > CATALOG, including inherited duration and branch currency. A master override adds `priceType` (`FIXED`, `FREE`, `RANGE`, `UNFIXED`) and `priceMaxMinor`; old fixed catalog/branch projections may omit them. `priceMinor` is an exact minor-unit string, or null when no final amount exists. FREE is exactly zero, RANGE exposes its two existing endpoints, UNFIXED is displayed as «Цена уточняется», never a fake catalog amount. No private employee/account/payroll fields are added. Publish matching API/web together because old consumers assumed a non-null amount.

The selected-master public slots endpoint uses the same effective FIXED/FREE amount and duration as canonical appointment planning. RANGE/UNFIXED cannot yield a fixed-price online slot without the already-required final amount; keep the canonical409 rather than promising an unfulfillable booking. This correction does not define new automatic pricing or change the existing any-master selection policy.

Frontend routes: `/my-work`, `/employees/[id]/profile`, `/specialists/[slug]`. Do not invent new login: existing OTP/session/invitation, with server-owned self identity and active authorized Employee.userId mapping. Existing membership roles must not be relaxed globally. Explicit private request actor and scope, no use of OWNER impersonation to call restricted services.

Public cache/revocation boundary: public API responses explicitly set `Cache-Control: no-store` before profile resolution, including its validation errors and unpublished 404 responses. Public HTML remains dynamic and its API fetch uses no-store. Unpublishing prevents new anonymous profile reads; it is not immediate media-byte revocation. Portal media URLs are signed for 60 seconds by the existing storage adapter. The existing S3 adapter writes objects with `Cache-Control: private, max-age=86400`, so a browser may retain previously fetched media beyond the signed URL lifetime, and downloaded/copied bytes cannot be recalled. No storage-provider policy is changed by this correction.

Pay: FOOD_SERVICE without a resolved authorized viewing branch returns SELECT_LOCATION: earnedMinor, remainingMinor, paidMinor, bonusMinor and penaltyMinor are null, adjustments is empty. Stored setting terms remain available (currency is the stored setting currency, or an empty string if no setting exists); this is not a calculated salary. The profile remains available. Choose a branch in the global branch selector to calculate. AVAILABLE uses that selected branch's timezone and canonical currency, exactly like existing manager payroll, without adding conversion rules.

Pay: FOOD_SERVICE self view must match existing manager payroll for that employee and month, including bonuses and payouts across business branches, using existing domain payrollTotals and scoped real reads. Never expose all employees to the browser. BEAUTY may show real conditions, adjustments, real payouts and selected basis; do not invent unsupported closed-period/refund formulas. Before a supported calculation is configured, amounts must be null with NOT_CONFIGURED or UNSUPPORTED_POLICY and a clear explanation, not fake zeroes. New payroll mathematics must not be smuggled into this upload/account slice.

Profile/publication changes use revision. Self changes to published public content require manager reapproval; fail closed rather than silently auto-publishing a changed image/biography. Avatar upload must persist in actual configured SiteAssetStorage; localStorage/object URL is preview only. Existing processSiteImage handles binary validation. For isolated acceptance use a disk-backed fixture storage adapter and serving mechanism, not a synthetic successful response or production bucket. No new dependencies/providers. Storage off => truthful 503.

Implementation ownership:
- API lane: new employee-portal API/models/held additive migration with down/README, API registration/access registry, domain validation if needed, integration/unit tests and a local fixture API for parent E2E. Do not edit web or domain types/index.
- Web lane: actual three views, typed server actions/client components, existing master/waiter entry links, services/schedule/finance clarity improvements and CSS/tests. No API/schema/contract edits.
- Parent: contracts, merge of exact changed files after review, own synthetic DB/storage, actual actor-separated API/browser smoke, final tests/build/screenshots and deliverable. No commit/push/deploy anywhere.
