# U09 correlated reproduction, 2026-10-07

Run 16-23-18Z-e2e-617a: 23/24 passing, U09 FAIL at acceptance.spec.ts:203 after reopening completed hotel setup. Onboarding had completed and units/rates assertions passed before this navigation.

Next request qa-10859-178 finishes at 16:25:29.827. Next requests 179 (auth/me) and 180 (other) start at 16:25:34.890 and 34.928, fail at 35.298 and 35.272 with ECONNRESET. Neither appears in proxy-start nor api-start. The API remains alive on the same PID and health responds 200. Server trace records idle socket closes at 16:25:32.389 through 33.554. This is a front-to-proxy transport failure before HTTP dispatch, not an API application 503 or confirmed invalid session. It happened in U09, separately from intentional U07 fault variants.

Observed runtime: Node v24.15.0. HTTP server keepAliveTimeout 5000ms, keepAliveTimeoutBuffer 1000ms. Node documents that reusing a socket near server close can cause ECONNRESET: https://nodejs.org/download/release/latest-v25.x/docs/api/http.html .

Hypothesis: idle keep-alive reuse under dev runtime load. Correlation supports this hypothesis but does not yet prove it as the cause of the earlier uncorrelated failures. Next experiment: use a deterministic separate-thread HTTP server to close an idle connection while the client has not processed its close event; compare reusable and explicit-close transports. Do not add a command retry, increase request timeout, relax session checks or change financial effects. Only after reproducing this mechanism consider a test-proxy transport fix, then repeat the original full sequence.

The temporary backend diagnostic introduced a production env-allowlist failure. Its block was removed without weakening that test; opt-in test preload still records errors.

## Deterministic transport experiment

A separate worker-thread HTTP server closes the first connection while the client cannot yet process the close event. The next request is issued without retry. Baseline keep-alive: one pooled socket, reusedSocket=true, ECONNRESET. Explicit Connection: close: zero pooled sockets, reusedSocket=false, status 200. The experiment uses no application, database, authentication or external events. Source will accompany the regression test. This proves the mechanism, but the earlier failures without correlation still cannot be attributed conclusively.

Minimal proposed test-stand change: normal proxy responses explicitly close their client connection, avoiding unrelated idle-pool races in a fault-injection adapter. Preserve deliberate post-commit socket destruction, timeout, before-save 503, SessionGuard, all UI assertions and request timeout values. Production transport is not changed. Add a deterministic RED/GREEN test against the actual response-header helper, then repeat the complete original master and BAR sequences.
