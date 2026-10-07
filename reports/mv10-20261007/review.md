# MV10 code review

Scope: approved read-only vertical tools and verified runtime binding. No schema, migration, financial policy, booking domain or production changes.

Correctness: tests inspect both successful projections and absence of domain/provider requests after rejection. Catalog prices use the existing effectiveService helper and integer minor units. Local Food periods are preserved. Hospitality uses the existing registry and handlers, with binding revalidation around execution. Support and instruction generation paths remain separate.

Security: the new public controllers independently require the seller quote key even with AUTH_REQUIRED=0. Extra query selectors fail. The service derives all scope from the active Agent/Location/Business chain and entitlement. Tenant role is used for catalog reads. Python checks every context field and canonical capabilities, revalidates before execution and discards unapproved output fields. UUIDs are not passed to the model in catalog results. Synthetic fixtures only.

Concurrency: selected registries are local variables in generate, with contextvars supplied/reset by the existing engine. Concurrent Beauty/Food runtime calls have independent tool names and outputs. No process-global selected registry is assigned.

Architecture/readability: approved backend doors stay in the ai-seller module. New provider methods were extracted into wetop_vertical.py to preserve the existing 300-line integration module limit. No dependency or lockfile change. Shared agent UI uses the server vertical and retains shared instruction/channel controls. Unknown directions have no Hospitality fallback.

Performance: fixed context reads and one projected catalog read per execution, no per-item database query. Catalog size follows stored active catalog data; no fabricated counts, prices or availability. No new polling or paid call.

Findings resolved: hotel copy shown on Beauty/Food screens; lost server vertical in agent DTO; non-WETOP bound agents receiving legacy Hotel tools; anonymous unknown provider mode fallback; integration module exceeding its existing line limit; exact optional property typing and test fake types. Legacy runner tests now resolve the per-turn registry and still assert all four original Hotel tools. No assertion, threshold or skip was removed.

Final verification results are recorded in README.md. Production behavior is not claimed from sandbox evidence.

Late prompt audit found that the shared instruction generator and base seller role are Hotel-specific. Beauty/Food now use manual editing with a visible generation limitation and real save/reload evidence. A server-selected turn message explicitly replaces that legacy subject; unverified scope receives an honest unavailability message with no tools. Three new Python RED tests and the real Beauty editor RED check precede the fix. Hotel rendering and generation contracts remain unchanged.
