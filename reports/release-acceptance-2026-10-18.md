# Release acceptance repair, 2026-10-18

## Authority and scope

Current owner instruction explicitly requests plan, repair, push, main merge and deploy until site publication. Full green release gates remain required; no production migration approval bypass. Existing owned worktree only, base latest main228ecdf7f including author's PR667 scroll fix. No code from unrelated draft PR656/648 imported.

## Root causes and minimal changes

- NO_SHOW rule approved in salons M6-A already forbids no-show before startsAt. Old beauty browser test expected button for future appointment. It now requires absence before start and still actually starts/completes appointment, payments/refund and IN_PROGRESS no-show exclusion unchanged.
- Integration payment test previously attempted future NO_SHOW and therefore never reached its asserted cash guard. Test now asserts temporal rejection, then changes Date only (real I/O/timers) to12:01 and asserts original paid-cash rejection plus unchanged persisted appointment; restores clock in finally. No product service, cash/formula/status policy edits.
- Author's reference layout uses generic dl rows and short refund label Возвраты. Existing real API cash/card/refund test still asserts300000/700000/200000 minor-derived displayed amounts and excludes all-booking-price misleading total; selectors follow exact row labels inside report dialog, not obsolete .quick-report-finance.
- CI loading-performance trace contains one visible attention region and React hidden streamed copy during held hotel response. Visible-filter selector retains strictness for multiple visible regions, no first/nth and no added wait/time budget. API-hit equalities, settings held state and deadline checks retained. Local original case alone passed, so no claim deterministic local RED; actual CI trace is RED evidence.
- Real customer reflow defect: new Add Customer button white-space nowrap/min-width auto expands document to331px at320 viewport and200%text. New regression in both themes reproduced exact331. Scoped mobile controls min-width0 and button normal wrapping fix root, no overflow hiding/font shrinking. Existing all-screen reflow tests untouched.

## Real local evidence

- Own PostgreSQL16 loopback55419: verified data_directory release-pg/pgdata, cluster_name release_repair_20261018, port.135canonical migrations and pms_test fixture applied only to that cluster. Original first startup rejected overlong Unix socket path, fixed by disabling Unix sockets; no external cluster used.
- Stale generated Prisma client initially caused6validation failures, environment-only run integration656e not acceptance. Own generated client updated, then actual regression integration042d reproduced1/6 same CI assertion. GREEN integration92c4:6/6 including both time and cash guards, sourceStable.
- Actual local original beauty four-test run4b3d7620 reproduced all4CI failures. Red outputs/traces preserved control/release-ui-results. New dedicated reflow regression RED2/2 failures,331width both themes, control/reflow-red.
- Reflow-green run:7PASS/3FAIL. Passed new double-text light/dark and existing320both and768dark/1440both. Failures from overloaded machine (load53): two earlier action/readiness failures and768light timeout, not declared overallGREEN. Concurrent lint/type attempts timed out and are not PASS.
- Sequential types record2026-10-18T10-36-54Z-typecheck-b527:root/API/webPASS.
- Sequential real beauty acceptance run:future-no-show start/complete/pay/refund entire flowPASS. Report test initially revealed second stale refund label after fixing selector; current exact-label report run PASS,24.2seconds (control/refund-green).
- Loading tests3/3PASS,38.2seconds (control/loading-green), including heldsettings and desk/chessboard hit budgets and delayed-settings performance samples.
- Final full unit2026-10-18T10-42-34Z-unit-7f3b:5831PASS7SKIP0FAIL; final full lint2026-10-18T10-46-32Z-lint-24ba:PASS. Types b527PASS. All entries sourceStable verified before publication.
- Final real API/own-PG browser set2026-10-18T10-49-59Z-e2e-5f92:**10/10PASS**, explicitly workers1: complete visit/payment/refund flow, cash/card/refund exact displays, doubletext customercontrols both themes and all existing reflow320/768/1440 both themes. Earlier recorded5ee2 ran default2 workers (CLI overrides config) and produced shared-fixture noise despite10PASS; not used as isolation proof, rerun one worker above.
- Single-worker screenshots light/dark copied into reports/release-acceptance-2026-10-18; actual inspected320 doubletext screenshot contains wrapped full button label, no page overflow.
- Exact candidate/main GitHub and live deployment remain separate gates, not claimed done here.

## Evidence retention and live acceptance

Control root `/srv/hermes/workspace/workspace-cleanup-control/owner-home-source-check/repair-20261018/`. Preserve original RED live captures; new verify-deployed-period.cjs writes timestamped sanitized summaries only. Before deployment current site still links plain/finance and month loses dates. Health was200; markers not full image provenance. Actual resulting release/source/image health and read-only live today/week/month plus desktop/mobile themes required.
