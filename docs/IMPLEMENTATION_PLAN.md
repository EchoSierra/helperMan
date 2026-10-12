# Helper Manager Implementation Plan

**Last reconciled:** 2026-10-12  
**Source of truth:** `requirements.md` defines approved scope; `docs/TDD.md` records the technical design and current repository findings.

This is the living implementation-status record for the project. Update it whenever implementation work starts, completes, or becomes blocked. Keep the three status sections current, and do not move external policy or operational prerequisites to **Done** until they are verified. Scope explicitly deferred by `requirements.md` is not an open MVP task.

Statuses describe repository/launch readiness, not whether a person is actively working on a task at this moment.

## In progress

- **Prepare and apply the database migrations.** The authentication migration is generated and the helper-registry migration is authored, but neither has been applied. Inventory any target-database rows, approve a lossless classification/mapping for legacy `User` data, review the migrations, then apply them through the appropriate deployment process. Do not assume legacy people rows are accounts or vice versa.
- **Complete Administrator account management.** An Administrator page at `/admin/maintainers` now lists accounts and supports creating a Maintainer, disable/enable, session revocation, authenticator reset, and password reset. Maintainer deletion is in the UI, and users change their own password at `/account/password` (requires current password and a TOTP code; revokes all sessions). Maintainer role grant/revoke for Administrators is in the UI. Administrators can promote an enabled Maintainer to Administrator ("Grant Administrator role") and demote one back ("Revoke Administrator role", which ends their sessions and never leaves fewer than two verified Administrators); both are audited and integration-tested, awaiting browser confirmation. Still open: tests for the actions, and end-to-end verification of authorization and session revocation.
- **Complete the audit feature.** (Verified by integration tests: read events and fail-closed reads, helper-write rollback on audit failure, sign-in/blocked/session audit events through the real auth API, failed password-change attempts now audited as `PASSWORD_CHANGE_FAILED`, audit view paging/shape/role denial. Also done: auth hooks fail closed (a session is deleted if its audit event cannot be stored) and `audit_events` is append-only via a DB trigger (UPDATE always rejected; DELETE only in a transaction with `SET LOCAL app.audit_retention = 'on'`, reserved for the approved retention job). TOTP enrollment start, failed and successful verification events are covered by `totp-audit.itest.ts`. Report-access auditing (incl. fail-closed), real-session role boundaries (`role-boundaries.itest.ts`) and a least-privilege runtime DB role (`scripts/sql/app-role.sql`, verified by `db-role.itest.ts`, documented in the README deployment steps) are done. Remaining: the retention job under its own privileged role, once schedules are approved.) A Maintainer-only, paginated `/audit` view now displays minimal actor/action/target/time metadata. Audit storage/writer code and helper-service auditing exist, but full event coverage and assurance remain incomplete: cover required authentication/MFA/account/report events, provide transactional writes and fail-closed reads, and verify them with database tests.

## Open

- **Verify audit acceptance criteria.** Align persisted audit events with the approved minimal actor/action/target/time shape; cover authentication, MFA, account/role, report, helper, and qualification activity. Make writes and their audit events atomic, fail closed for reads if audit persistence fails, and ensure events contain no field values, PII, IP addresses, credentials, or secrets.
- **Implement inactive-helper retention.** After the organization approves a retention schedule, implement and test the controlled hard-delete operation for eligible inactive-helper records and their qualifications while retaining only permitted minimal audit metadata. Do not invent or encode a retention duration before approval.
- **Extend PostgreSQL integration coverage.** `npm run test:integration` (separate `*_test` database) (safety: `setup-env.ts` pins `DATABASE_URL` to `TEST_DATABASE_URL` before any import and refuses names without `test`) now covers the account-administration services: creation, rollback on audit failure, disable/last-admin guard, deletion, role revoke, password and TOTP reset. Helper and qualification services are now covered too (CRUD, validation, role denial, cursor pagination, cascade). Self-service password change (TOTP check, 5-failure lockout, session revocation) is covered as well. Still to cover: audit view, migrations/constraints, retention. Test migrations and database constraints, role boundaries, qualification ownership/date handling, audited reads and writes, rollback/fail-closed behavior, and retention deletion using synthetic data only.
- **Add browser end-to-end coverage.** Exercise sign-in and mandatory TOTP, Maintainer helper/qualification workflows, expiry-report boundaries, Administrator separation and management, account revocation, and assisted recovery/re-enrollment.
- **Resolve and document no-other-Administrator recovery.** Obtain an organization-approved operational procedure that preserves mandatory TOTP re-enrollment and does not grant protected access before re-enrollment.
- **Complete production operational readiness.** Obtain formal approval for both helper and audit retention schedules; provision at least two verified Administrators with completed TOTP; verify the production preflight; and complete production migration review, encrypted backup/restore testing, TLS/private database configuration, monitoring, and deployment ownership. Production use remains blocked until the required approvals and account readiness are verified.
- **Perform the release security review.** Review the completed authentication, account-management, recovery, authorization, and audit implementation against the approved requirements before production use.

## Done

- **Requirements/design updated** for Maintainer deletion and self-service password change (requires current password + TOTP).

- **TOTP enrollment QR code:** the enrollment page shows a QR code in addition to the manual key (some authenticator apps reject the long manual key).
- **Manually verified in the browser:** sign-in with TOTP, password change with TOTP, and an Administrator granting themselves the Maintainer role.

- **Authentication foundation:** Email/password sign-in, mandatory TOTP enrollment and verification, protected-route access controls, Administrator bootstrap, and production preflight are implemented.
- **Maintainer registry slice:** Maintainer-protected helper directory, profile create/update, qualification create/update, and the qualification-expiry report are implemented. The report uses the approved UTC date-window semantics and includes inactive helpers.
- **Initial validation and unit tests:** Strict helper/qualification validation, authentication policy/configuration coverage, and qualification-expiry boundary tests are present.
- **Read-only audit-log view:** Added Maintainer-protected access at `/audit`, displaying paginated actor, action, target reference, and UTC event time without fetching linked account or helper details.
- **MVP scope and key design decisions:** PostgreSQL, fixed helper profile fields, name-only directory search, UTC report boundaries, additive explicit roles, and deferred future features are recorded in `requirements.md` and `docs/TDD.md`.

## Explicitly out of this implementation plan

Helper self-service, tasks, equipment, dynamic fields, data export, missing-qualification reports, broader analytics, and a general-purpose configurable permission system are future scope, not first-delivery tasks.
