# MV10 runtime scope audit

Server binding: SellerAgent active sales → active Location → active Business → Organization. Business.organizationId must equal SellerAgent.organizationId. Organization must not be SUSPENDED and AI_SELLER entitlement must be active. The agent selector is not authorization. Only SELLER_QUOTE_KEY can read the three approved GET contracts; extra selectors are rejected.

| Entrypoint | Trusted incoming identity | Runtime |
|---|---|---|
| Web widget | Existing channel origin and agent_scope validation | widget_runner.build_runner |
| WhatsApp | Existing per-agent connection, verified webhook and local Agent/Organization | get_whatsapp_runner → build_runner |
| Telegram pilot | Durable event agent and verified local Agent/Organization/connection/tester | telegram_worker → build_runner |
| Support assistant | Separate ROLE_SUPPORT registry | Existing support tools preserved |
| Instruction generation | Existing authenticated agent generation request | use_tools=False, does not resolve domain tools |

Engine._process installs and resets agent_id_var and organization_id_var per turn. CascadeClient resolves a local registry for each generate call. No assignment of a selected registry to the shared client. Unknown, incomplete, foreign, inactive or unavailable bindings expose zero domain tools. Each execution revalidates the original binding; a changed location fails before the handler. Catalog responses repeat their verified context and are checked against the turn binding before their allowlisted items reach the model. Context IDs never enter catalog tool outputs.

| Business.vertical | Tools | Source |
|---|---|---|
| HOSPITALITY | Existing check_availability/get_price and optional existing booking tools | Existing Hotel adapters, wrapped by scope revalidation |
| BEAUTY | get_beauty_services, no arguments | Active enabled services, canonical effectiveService price/duration |
| FOOD_SERVICE | get_food_service_periods, no arguments | Active saved service periods, local TIME values |

Beauty prices are strings of integer minor units. They represent the published catalog, with no payment or booked revenue meaning. Food periods do not prove available tables. Beauty/Food appointment, reservation, guest, finance and mutation tools do not exist in these registries. Browser or model arguments cannot set organization, business, location or vertical. Operator permission APIs are not opened to the seller key.

The shared agent detail screen uses the server-returned business vertical. Instruction and channel controls remain shared. Domain guidance is specific to the verified direction; drafts do not become active merely by saving instructions. No new channel connection or activation semantics were introduced.

The existing org-scoped instruction generator has a Hotel-only prompt. The Beauty/Food interface therefore opens manual instruction editing and disables the story/generation step; it does not call that generator. Manual save and reload are verified against the real API/DB. No generation API contract was extended. The verified per-turn system message explicitly replaces the legacy Hotel subject for Beauty/Food while preserving general privacy/accuracy rules. A failed context provides zero tools and an explicit unavailability instruction rather than a Hotel role fallback.
