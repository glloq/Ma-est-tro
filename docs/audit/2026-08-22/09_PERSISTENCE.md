# 09 — Persistence, migrations, backups, files (plan §X, Y, Z, AA)

**State: PASS (migrations, backups) / PARTIAL (CRUD, concurrency)** · Level 2

---

## X — SQLite persistence

SQLite via `better-sqlite3`. `Database.js` (1 101 lines) delegates to per-table managers
in `src/persistence/tables/`; repositories (`src/repositories/`) wrap it with
business-named methods.

**Verified live** on a freshly created database:

```
tables      33
indexes     80
journal_mode = wal        ✔
foreign_keys = 1          ✔   (enforced, not merely declared)
integrity_check = ok
```

Foreign keys being actually **ON** is worth calling out — SQLite defaults to off, and
declared-but-unenforced FKs are a common silent defect.

### X01 — CRUD — PARTIAL
33 tables. Repository-level tests exist (`repositories/repository-delegations`,
`file-folders-repository`, `hotspot-config-repository`, `transaction-helper`), and
`src/repositories` sits at **72.4 %** coverage. But `src/persistence/tables` — where the
SQL actually lives — is at **30.1 %** across 1 584 statements. No systematic
per-table CRUD matrix exists.

### X02 — Constraints — PARTIAL
FK enforcement verified on. Unique constraints are covered for migrations
(`migrations-uniqueness`). NULL handling and column defaults are not systematically
asserted.

### X03 — Transactions — PARTIAL
A transaction helper exists and is tested (`repositories/transaction-helper`).
`DatabaseLifecycle` wraps migration application in explicit
`BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`. **Not tested:** deliberately failing
mid-operation and asserting no partial state remains, which is what the plan asks for.

### X04 — WAL — PARTIAL
WAL confirmed active. Checkpoint behaviour, crash-during-write and recovery are
**NOT TESTED** (needs process-kill orchestration).

### X05 — Concurrency — NOT TESTED
Reads/writes during playback not exercised. `better-sqlite3` is synchronous, so every
query blocks the event loop — meaning a slow query during playback is a *timing* risk,
not just a throughput one. This is the persistence question most worth answering on a
Pi, and it connects directly to §F03.

---

## Y — Migrations — PASS

34 migration files (`001_baseline.sql` … `034_instrument_pitch_bend.sql`), applied at
startup in numeric order, each in its own transaction. Bookkeeping table:
`schema_version`.

**Idempotency verified directly:**

| Run | Tables | Indexes |
|---|---|---|
| 1st `initialize()` | 33 | 80 |
| 2nd `initialize()` on the same file | 33 | 80 |
| | **identical** | **identical** |

Existing suites cover fresh install (`migrations-fresh-install`), uniqueness
(`migrations-uniqueness`) and legacy reconciliation (`migration-legacy-reconcile`).

The per-file transaction design means a failure at migration *N* leaves 1…N−1
committed and retries from *N* — a sound, resumable strategy.

**Not tested:** upgrading from each historically supported DB version (the plan asks
for this explicitly), interrupting a migration mid-file, and rollback. The last one
deserves a straight answer rather than a test: there is **no down-migration
mechanism**. Recovery from a bad migration is restore-from-backup. Given that backups
are verified working (below) and this is a single-user appliance, that is a defensible
choice — but it should be stated in the docs rather than left implicit.

> ⚠️ Note the interaction with **F-04**: `migrations-fresh-install` is one of the 10
> suites that silently skip when `better-sqlite3` bindings are missing. This project's
> CI installs the toolchain and does run them — but the skip is silent, so if that
> install step ever degrades, migrations become untested with no visible signal.

---

## Z — Backups — PASS

The plan sets the bar correctly: *"Un backup n'est validé que si une restauration
automatique réussit."* So it was tested that way, with a canary row rather than by
inspecting file size:

```
canary before backup : present
backup created       : true, 520 192 bytes
canary after delete  : (gone)
canary after restore : present
RESTORE VERIFIED     : true
integrity_check      : ok
tables after restore : 33
```

`Database.backup()` → `restoreFromBackup()` round-trips real data, and the database is
fully usable afterwards. Existing suites cover atomicity
(`database-backup-atomic`), reopening after restore (`database-restore-reopen`) and the
scheduler's retention floor (`backup-scheduler-gc-floor`).

`BackupScheduler` runs on cron `0 3 * * *`, keep 7 (confirmed in the boot log).

**Not tested:** rotation/retention over time, corrupted backup file, disk full,
permission failure, and shutdown *during* a backup.

---

## AA — FileManager / blobstore — PARTIAL

`FileManager` (1 053 lines) plus a blob store, with derived files (adapted MIDI) linked
to sources.

| Concern | State |
|---|---|
| Upload / rename / duplicate / delete / replace | PARTIAL — command surface exists, `upload-queue` + `upload-queue-timeout` tested |
| Derived files | PARTIAL — `filemanager-adapted-persist` |
| **Path traversal** | **PASS** — `blobstore-path-guard` unit test, and probed live |
| Hostile filenames | PARTIAL — control-character filters present (the 4 `no-control-regex` lint warnings are these) |
| Orphan blobs / missing blobs / DB↔blob divergence | **NOT TESTED** |
| Large files | NOT TESTED |
| Concurrency | NOT TESTED |

**Live traversal probes** (see `scripts/audit/live-probe.mjs`):

| Attempt | Result |
|---|---|
| `/api/files/..%2f..%2f..%2fetc%2fpasswd/blob` | **400**, nothing leaked |
| `/api/waf/..%2f..%2f..%2fetc%2fpasswd` | **400**, nothing leaked |
| `/../../../etc/passwd` | 200 (SPA index) — the HTTP client normalises the path before sending, so this probe never reaches the server as traversal; **inconclusive, not a finding** |

The orphan/missing-blob consistency question is the real gap here: nothing verifies that
every `midi_files` row has a blob and every blob has a row. On an appliance that runs
for months, drift between the two is the failure that eventually shows up as a file
that lists but will not load. A periodic consistency check (or at least a
`file_reanalyze_check`-style audit command that reports orphans) would be cheap.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Fail CI when SQLite suites are skipped (F-04) — otherwise migrations are untested in CI. |
| P2 | DB↔blob consistency check: assert no orphan blobs, no missing blobs; expose as a maintenance command. |
| P2 | X03: force a failure mid-transaction and assert no partial state. |
| P2 | Y: fixture databases for each historically supported version, migrated to head in CI. |
| P3 | Z: test rotation, corrupted backup, disk-full and shutdown-during-backup. |
| P3 | Document explicitly that there is no down-migration and that recovery is restore-from-backup. |
| HW | X05: measure query latency during playback on a Pi — synchronous SQLite blocks the MIDI timing loop. |
