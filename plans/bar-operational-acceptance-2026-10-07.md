# BAR operational acceptance

Owner approved the plan and isolated local environment on 2026-10-07.

Base: e0089a230d8bd0b03751721d6e219faa628b904e. Branch: codex/bar-operational-acceptance-20261007.

The primary checkout is untouched. Own filtered clone, Node 24, PostgreSQL 16 on 127.0.0.1:55893, dedicated PGDATA and synthetic data only. External delivery is absent from the test module. No production, merge or deployment authorization.

1. Record current API, role, replay and financial contracts. Prepare independent fixtures and C01-C16 matrix.
2. Prove the main calculation through real BAR controllers/services/repository, PostgreSQL and browser reload.
3. Prove cancellation copies, negative input, replay, role boundaries, ownership and controlled database races.
4. For confirmed contract defects, record RED, minimal fix, GREEN and adjacent regression. Financial policy, permissions, schema and migrations require separate approval.
5. Run final regression through test:record, verify fingerprints, commit/push evidence and report. No merge/deploy.

Expected main-cycle minor units: purchases 280000, supplier paid 60000, debt 220000, revenue 480000, sales cost 180000, gross margin 300000, write-off 16000, shortage 16000, stock value 68000, cash delta 324000, unpaid Folio charge 96000.

## Open policy gates

- C10: valuation of goods not returned after cancellation. Current disappearance from COGS/WRITE_OFF is an observation, not an approved policy.
- C12: BAR reversal of closed/partly paid/fully paid Folio; paid allocations and refund behavior.
- C04: supplier debt after Finance void of linked expense.
- C14: desk versus refunds permission for BAR reversal and approved role matrix.
- C13: payment/write-off replay contracts and stable UI intent key if existing endpoints have no such contract.

These variants remain NOT RUN for policy acceptance until decided; factual behavior can be recorded without changing policy. They prevent an unconditional operational-readiness claim.
