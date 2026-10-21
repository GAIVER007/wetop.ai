# MV8 upstream impact, 07.10.2026

Live GitHub verification: PR #259, title MV8: Vertical Today, MERGED at 2026-10-07T06:27:01Z.
URL: https://github.com/GAIVER007/wetop.ai/pull/259
Fresh origin/main: c7e63d76a2687fdec387d89b1c718c3387a009e3.
Own branch HEAD before synchronization: 7c4059b963d770c33cf789469d9111d7e2b8ca5f.
Last synchronized main: ab5d2f2262a9421a80b44c70fc2a5a6b9afdb47e.

## Impact

Main independently implements shared /today, separate Beauty/Food loaders and builders, Hospitality extraction, landing changes, real API matrix and screenshots. The same feature now overlaps our approved branch. Main also contains later scope, marketing and calendar changes in apps/packages. The initial assumption that upstream changes only regression evidence no longer applies.

Observed differences require reconciliation with the current owner decisions rather than silently overwriting main:

- Main Beauty upcoming excludes appointments with endMinutes <= current minute; our approved original plan groups those after active rows.
- Main Food deduplicates by newest updatedAt; our original builder uses ID-map insertion order.
- Main has an explicitly documented anonymous Hospitality exception for non-production open stands. Our original scope requirement fails closed for signed-out identity.
- Main unresolved scope uses the current shared scope resolver; our branch provides LoadError plus existing branch selection recovery.
- Main and our branch introduce different component/module names and browser harnesses for the same route.

No merge, push, duplicate PR or production action was performed in response to this discovery. Own code and evidence remain preserved in the isolated clone. A clarification was sent offering either an audit of merged MV8 with a focused follow-up for confirmed gaps or an alternative draft PR of the old branch. No dependent implementation proceeds until the answer.

## Own branch verification completed after discovery

Full unit: 381 files passed, 1 file skipped; 3421 tests passed, 4 existing conditional skips, exit 0. Recorded log: tests/runs/logs/2026-10-07T06-27-33Z-unit-b66e.log. This proves the preserved old branch, not fresh main or a merged tree. Full remaining DoD was not claimed complete.
