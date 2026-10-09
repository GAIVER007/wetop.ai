# Fresh main impact before MV2 PR

Fetch during final preparation advanced main from d91c207a to 2d9adf66 (QA merge 1027933b and verification docs). Diff inspected before continuing rebase.

- schema.prisma, Business.vertical, RequestActor/request-context and scope.ts unchanged. MV1 canonical source, capabilities and pilot statuses remain intact.
- Channels changes are Hospitality rules: inactive RatePlan is unavailable to mapping, a transaction locks its category and verifies active plan inside the same property. ARI sold periods use actual allocation end after completed stays. Provider routing, integrationPropertyId, public webhook binding and vertical boundary are unchanged. Additional property filter strengthens the existing local entity check.
- Rates/early checkout capacity and UI fixes do not participate in registration chain or allowlists. No new schema or registration contract from main.
- DECISIONS conflict was two independent append-only ADR additions; both preserved, no decision replaced. Code files merged automatically without conflict.
- Result: compatible with approved multi-vertical architecture. Repeat full unit/integration on combined code, preserve separate site-only browser evidence. No production action follows this report.
