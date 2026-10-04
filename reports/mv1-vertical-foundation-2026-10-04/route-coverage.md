# MV1 route capability coverage

Authenticated Hospitality controllers below enforce capability inside AuthorInterceptor after verified scope. RoleGuard/READ_ONLY remain separate. Invalid explicit scope refuses fallback. Legacy organization/service routes resolve the existing Property chain, no browser vertical.

| Controller | Capability |
|---|---|
| apps/api/src/chessboard/chessboard.controller.ts | hospitality.reservations |
| apps/api/src/reservations/reservations.controller.ts | hospitality.reservations |
| apps/api/src/guests/guests.controller.ts | hospitality.reservations |
| apps/api/src/inventory/inventory.controller.ts | hospitality.inventory |
| apps/api/src/units/units.controller.ts | hospitality.inventory |
| apps/api/src/rates/rates.controller.ts | hospitality.rates |
| apps/api/src/channels/channels.controller.ts | hospitality.channels |

Shared dashboard/analytics/finance/AI/wizard and public webhook/booking bindings require their domain adapters; they are not claimed protected by this foundation. Public inbound Channex remains provider mapping binding. Beauty keeps its existing scope boundary. This manifest is explicit coverage, not a claim that every platform endpoint has been converted.
