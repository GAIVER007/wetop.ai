# Unified stage, read-only manifest

Observed UTC: 2026-10-07T12:31:59.069024+00:00

Release: e3fadd02bb8dbbae2d20028118819d576c064e30. Main: df0af4b0dd7c05df561ca18bc9cab484256bc4fb. U07: e070da7e1bbddf0eef7203977fae2b3963d4e1b0, CI 37613211275 FAIL.

PR 268/275/276 merged. PR 277 also merged: explicit branch fixture repair. PR 267 head adabb06e3e1bc033a2097d8e2fbfb5ac02cd424e is OPEN/CONFLICTING; previous 37617728287 cancelled, current 37620535836 running. PR 264 head 3af7ac5454b28b6c6536e554af58bebca5a7f4f6 OPEN/CLEAN.

Main now also contains MKT6 generation and migrations 062/063, outside document snapshot. Release to main migration delta: 060,061,062,063. No assumption of permission to release these.

Runtime/production migrations NOT VERIFIED. Configured SSH host hostinger connected but has no WETOP deploy marker, no /root/wetop git repository and no WETOP containers. No further exploration of unrelated services performed. Git release is not runtime proof.

Original iCloud checkout git object read timed out. Durable U07 checkout usable; only own journal/report diagnostics dirty, locks empty. No code edits, test environment started, external messages, merge, deploy or database writes in this stage.

## Proposed plan, awaiting approval

Freeze base 94a2ae33416ece62d2bd18d8f3ef1896ed209702 (main before MKT6, includes PR 268/275/276/277), adapt only current U07 patch onto it. Do not merge latest main wholesale. Verify release delta and migration inventory before choosing release contents.

One executor here owns auth/scope, shared fixtures, finance/UI, BAR and CI integration sequentially. No delegated agents or messages. Preserve historical trees and diagnostics. New separate candidate branch after approval.

Verify existing merged fixes; reproduce Turnstile and calendar token, AVAIL-SUM-01 and FIN-NAV-01. Minimal RED/GREEN fixes preserve financial calculations and access. Review current PR 264/267 diffs; only explicitly selected compatible changes enter candidate, no blanket inclusion.

After separate approval for a local synthetic PostgreSQL 17 contour (new synthetic identities only, no production secrets/data or external dispatch), run U01-U12 and BAR C01-C16 with real API/DB/browser, barriers and exact ledger reconciliation. Record unresolved financial/access policies as NOT RUN; no guessed repair.

Website vertical/roles/scope matrix and A4b ACTIVE/cache policy require decisions before dependent edits. BAR no-return cost, paid/closed folio reversal, voided supplier expense and desk/refunds need decisions before financial changes. Independent read-only checks may continue.

Review one final diff, full CI exact final SHA, actual cleanup and release approval package. No merge/production migration/deploy without explicit later approval. Domain acceptance requires actual WETOP runtime access and permitted synthetic dataset.
