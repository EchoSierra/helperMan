# Helper Manager — Technical Design (First Delivery)

**Status:** Authentication, helper/qualification management, Administrator account management, audit, retention, integration tests, and browser E2E are implemented. All five repository migrations are applied and current on the dev and test databases. Production migration remains pending target-database inventory, legacy-row mapping approval, review, and release execution.
**Requirements source:** `requirements.md` (including its confirmed project constraints).
**Engineering standards:** `DEVELOPMENT_STANDARDS.md`.
**Repository baseline inspected:** Next.js App Router 16.4, React 19, TypeScript, Tailwind CSS 4, Prisma 6.19, PostgreSQL, Better Auth 1.7.x, Vitest, and Playwright. Authentication, Maintainer helper/profile/qualification routes, the qualification-expiry report, Administrator account management, and the Maintainer-only audit view are implemented and tested.

## 1. Purpose and scope

Deliver a Maintainer-focused registry with secure sign-in, mandatory TOTP for Maintainers and Administrators, helper and qualification profile maintenance, searchable directory/profile, a qualification-expiry report, and minimal audit events for helper-record reads/writes and authentication/MFA events.

Helper self-service, tasks, equipment, dynamic fields, exports, missing-qualification reports, broader analytics, and a broad configurable permission system are not part of this delivery. Do not build routes or schema for those deferred features. A user who is both Administrator and Maintainer receives both explicitly assigned roles; Administrator by itself does not permit helper-data access.

PostgreSQL is the approved MVP database. MongoDB evaluation is parked and is not an implementation alternative for this delivery.

## 2. Current repository evidence and implications

- The App Router includes sign-in, TOTP enrollment/verification, a Maintainer-only helper directory/profile/qualification workflow, the qualification-expiry report, Administrator account management, and the Maintainer-only audit view.
- The unreferenced legacy `actions/identity.ts` and `actions/qualifications.ts` services were removed because they returned or mutated legacy person/qualification rows without authorization, ownership checks, or audit events. New service boundaries are server-only, Maintainer-guarded, strictly validated, and audited.
- `schema/validations.ts` accepts old/new values and IP addresses for audit events, and its event enum omits MFA, enrollment, recovery, account disablement, and account deletion events. This is inconsistent with the approved minimal-audit requirement.
- `prisma/schema.prisma` and the initial migration define a `User` as both a person record and an account (`firstName`, `lastName`, email, phone, address, status, and a single `role`). `Identity` is a separate one-to-one record with unrestricted JSON. This does not cleanly represent helpers without login accounts, privileged accounts without helper profiles, or additive Administrator+Maintainer roles.
- `Qualification.userId` is nullable and has no Prisma relation or database foreign key. The migration likewise creates no helper/qualification referential constraint. Qualification `category`, `issuer`, `validFrom`, `isVerified`, and JSON `metadata` exceed the approved first-delivery record shape.
- Roles are represented twice: a singular `User.role` enum and an implicit `User.roles` many-to-many relation to `Role`. `Permission` is separately connected directly to users and optionally to a role. These overlapping mechanisms have no single clear source of authorization truth.
- `AuditLog` stores `oldValue`, `newValue`, and `ipAddress`, all of which are outside or contrary to the approved minimal event shape. Its actor foreign key uses `ON DELETE SET NULL`, which can erase the actor reference when an account is removed.
- `UserStatus` in `app/types/index.ts` lists three values, while Prisma's shared `Status` enum also contains equipment states. Several TypeScript data types allow dynamic `any` fields.
- The initial migration, `prisma/migrations/20261012054059_init/migration.sql`, creates the legacy schema above. The repository contains five forward migrations; all five are applied and current on the dev and test databases. Integration and browser E2E suites are present. Legacy rows are not classified or transformed by these migrations.
- `docker-compose.yml` supplies PostgreSQL 15 and Redis 7, but no application service. Redis is not used by the inspected application and is not needed by the proposed database-backed session design unless the eventual auth-library choice demonstrates a need.

These are design findings from repository files, not a claim about the contents of any running database. Before migration, inventory actual data and decide how existing `User` rows are classified; do not assume that every current user is a helper or an account.

## 3. Proposed architecture and boundaries

Retain the existing Next.js App Router, TypeScript, Prisma, PostgreSQL, Zod, and Tailwind stack. Use server-rendered App Router pages for protected reads and Server Actions for mutations. No public REST API is needed for this first delivery.

Use a server-only feature/service boundary, aligned with the feature-based direction in `DEVELOPMENT_STANDARDS.md`:

- `app/`: route segments, page composition, and server-rendered views.
- `lib/auth/`: sign-in, TOTP enrollment/verification/re-enrollment, account-auth UI, and session/role guards.
- `features/helpers/`: directory, profile, fixed-field schemas/services, and Server Actions.
- `features/qualifications/`: qualification list/form UI within a helper profile.
- `features/reports/`: expiry report UI.
- `features/admin/`: Maintainer account/role operations.
- `features/audit/`: read-only minimal audit-event view.
- Feature-local `actions.ts`: thin Server Action adapters. Each validates untrusted input, checks the specific capability, calls a guarded service, and returns a safe result.
- `lib/` (or feature-local server-only modules): session/authentication, authorization, audit writer, date-window logic, and Prisma access.
- Feature-local `schemas.ts`: strict Zod input schemas for fixed MVP fields; no open-ended JSON field schemas.

Keep database access and permission decisions on the server. Pages and forms are presentation only; hiding a button or route is not an authorization check. Avoid exposing Prisma models or full records directly to client components. Select only fields required by each view.

### Route and interaction map

Proposed routes (names may be adjusted during implementation without changing product scope):

| Route | Access and purpose |
|---|---|
| `/sign-in` | Public email/password entry; no protected content in the response. |
| `/mfa/enroll` | Authenticated but unverified privileged account may complete TOTP enrollment or re-enrollment after reset. |
| `/mfa/verify` | Complete TOTP challenge for an enrolled privileged account. |
| `/helpers` | Maintainer-only searchable, paginated directory. |
| `/helpers/new` | Maintainer-only fixed-field helper creation. |
| `/helpers/[helperId]` | Maintainer-only profile and associated qualifications. |
| `/helpers/[helperId]/edit` | Maintainer-only profile update. |
| `/reports/qualification-expiry` | Maintainer-only expired/expiring report. |
| `/admin/maintainers` and subordinate create/detail pages | Administrator-only account creation, role assignment/revocation, disablement, password reset initiation, and assisted TOTP reset. These pages must not fetch or reveal helper data unless the actor also has Maintainer. |
| `/audit` | Maintainer-only read-only access to minimal audit events. |

Create/update helper and qualification operations are Server Actions, not client-callable data APIs. Directory name searches use a Server Action with bounded cursor pagination so profile values are not placed in URLs. There is no manual delete route/action for helper or qualification records.

## 4. Data model and migrations

The additive Prisma schema now includes the first-delivery helper models. The helper profile uses required first and last name, optional email/phone/address, and active/inactive status. Directory search is a case-insensitive partial match on first or last name; optional contact/location fields are not searchable. The legacy schema remains untouched until its contents are classified and a mapping is approved.

### Core records

- **Account**: `AuthUser` is used for privileged operator login, password, enabled state, authentication state, sessions, and additive role assignments. Legacy `User` rows remain unclassified and separate from helper records.
- **Role assignment**: many-to-many account-to-role membership for the fixed roles `ADMIN` and `MAINTAINER`. This is the one source of role truth and permits both roles on one account. Admin account-management authorization checks `ADMIN`; every helper or report read/write checks `MAINTAINER` explicitly. Do not implement broad resource/action permissions absent an approved permission matrix.
- **Helper**: independently identified registry entity, with a stable unique ID, active/inactive state, required first/last name, and optional email, phone, and address. A helper does not need an account.
- **Helper qualification**: required `helperId` foreign key, required title, and nullable valid-through date. Model valid-through as a date-only value (`DATE` / Prisma `@db.Date`) to avoid accidental time-zone shifts. Qualification status is derived for the report, not persisted. Exclude JSON metadata and fields not required for this delivery unless separately approved.
- **Credential/MFA state**: password hash; TOTP enrollment state; pending secret during enrollment; encrypted verified TOTP secret; and the last accepted TOTP time-step (to prevent replay). Never expose or log secret material.
- **Session**: database-backed, revocable session with account ID, creation/expiry, and MFA-verification state. Accepted deviation: Better Auth stores the signed session token in plaintext in the database, not as a digest.
- **Audit event**: event ID, actor reference, action, target type/reference, and timestamp only. No before/after values, personal-data values, TOTP/password material, query terms, or IP address.

### Migration direction

The forward migrations follow the existing `init` migration. The authentication migration adds operator authentication/audit tables; `20261013100000_helper_registry` adds isolated helper tables; later migrations add audit immutability and retention policy support. All five are applied and current on the dev and test databases. The helper migration:

1. Create dedicated `helpers` and `helper_qualifications` tables with active status, fixed profile fields, date-only valid-through values, and timezone-aware timestamps.
2. Require and index a qualification-to-helper foreign key; add indexes for directory ordering and valid-through queries.
3. Keep `auth_role_assignments` as the role source for new operator accounts. Legacy `User.role` / `Role` / `Permission` rows remain unmapped until inventory and an approved migration exist.
4. Do not drop dynamic profile/qualification JSON, extra qualification fields, or audit value/IP columns from legacy tables until their contents are inventoried and a reviewed data migration is approved.
5. Separate account and helper lifecycle state. The helper foreign key cascades qualifications on a controlled retention deletion; minimal audit events have no foreign keys and remain.

Before applying these migrations to another target, confirm its identity and migration state, classify any existing `User` rows, and map profile data only with an approved field mapping. Preserve a recoverable backup and rehearse migration/restore against synthetic or irreversibly masked data. These migrations do not transform or delete legacy rows. Never rewrite a migration once it is shared or deployed; use a new forward migration for subsequent changes.

## 5. Authentication, sessions, and MFA

The first authentication increment is implemented. Better Auth provides email/password verification, an encrypted TOTP factor, a database-backed session, per-account MFA failure lockout, and endpoint rate limits. Public signup, alternate sign-in methods, backup-code endpoints, trusted devices, and self-service MFA disable/recovery are not available.

1. After password authentication, an account with TOTP receives Better Auth's pending challenge and no authenticated session until TOTP verifies. A privileged account without an active factor receives only a 15-minute enrollment-only session; all protected server guards deny it.
2. TOTP enrollment requires the current password and a valid authenticator code. The provisioning URI is shown only in the user's browser as a manually entered secret and a locally rendered QR code; it is not sent to an external QR service. The pending encrypted factor remains unusable until verified and can be replaced by restarting enrollment.
3. Sessions are database-backed, have an 8-hour absolute expiry, are not refreshed, and use secure HTTP-only same-site cookies in production. There is no session-data cookie cache. Each protected request re-reads the account's enabled state, current roles, MFA state, and session from PostgreSQL.
4. Password-only sessions expire after 15 minutes and can only complete TOTP enrollment. A TOTP reset by a different Administrator deletes the factor, revokes all target sessions, and requires re-enrollment. A password reset changes only the password and revokes sessions.
5. Admin-assisted reset services require a currently authenticated Administrator session with verified TOTP. They do not accept client-supplied identity-verification claims and cannot target the acting Administrator.
6. Self-service password change (`/account/password`, `lib/auth/account-self.ts`) requires an authenticated session, the current password, and a valid TOTP code (verified server-side against the encrypted factor, sharing the factor's failure counter and 15-minute lock after 5 failures). Success replaces the hash, revokes all of the user's sessions, and records `PASSWORD_CHANGED`. Administrators may delete Maintainer accounts (never Administrators or themselves) from `/admin/maintainers`.
7. Record sign-in outcomes, enrollment/re-enrollment, and reset/recovery actions with minimal audit metadata. Never log passwords, TOTP codes, provisioning URIs, secrets, IP addresses, user agents, or personal/qualification values.

**Implemented increment (resolved):** Better Auth 1.7.x (Prisma adapter, 2FA TOTP plugin) on PostgreSQL, server-side only.

- Code: `lib/auth/` (`policy.ts` pure rules, `auth.ts` configuration/hooks, `client.ts`, `guards.ts` `requireSession`/`requireMaintainer`/`requireAdministrator`, `account-admin.ts` admin-only services, `audit.ts`), `app/api/auth/[...all]/route.ts`, `app/sign-in/`, `app/mfa/`, authenticated `app/page.tsx`, `scripts/bootstrap-admin.ts`, and `scripts/preflight.ts`. Later services must call the guards; proxy/UI hiding is never sufficient.
- Endpoint allowlist (HTTP route and `auth.api`): only `POST /sign-in/email`, `POST /sign-out`, `POST /two-factor/enable` (TOTP only), `POST /two-factor/verify-totp` (no `trustDevice`), `GET /get-session`. Sign-up, backup codes (also generated with `amount: 0`), 2FA disable, OTP, TOTP-URI retrieval, social/magic-link sign-in, password reset/change, account linking and user self-service return 404. Better Auth's per-account MFA failure lockout and endpoint rate limits remain enabled.
- Sessions: DB-backed and revocable, 8 h absolute (`expiresIn=28800`, refresh disabled, cookie cache off). A password-only session is created with `mfaVerified=false` and a 15-minute enrollment window; access requires `session.mfaVerified && user.twoFactorEnabled`. After TOTP verification Better Auth issues a new session, so the 8 h lifetime runs from TOTP completion; the guard also enforces `createdAt + 8 h`. IP address and user agent are not stored on sessions or audit events. Disabled or role-less accounts cannot sign in and are blocked on the next request; admin revocation deletes session rows.
- Roles: `auth_role_assignments` holds only `ADMIN`/`MAINTAINER`, set server-side. Helper data requires `MAINTAINER` (Admin alone is denied); account operations require `ADMIN`. `ADMIN` can only be created by the bootstrap script. Role assignment/revocation is the permission operation; no arbitrary ACL.
- Recovery: a different, authenticated Administrator with a verified TOTP session calls `resetTotp` (deletes the factor, revokes sessions, target must re-enroll) or `resetPassword` (password only, MFA unchanged); neither operation trusts client-supplied verification claims, and both refuse self-targets. If no other verified Administrator exists, an operator runs `npm run auth:recover-admin` (`lib/auth/recovery.ts`, not web-reachable): it resets the password, deletes the TOTP factor, revokes sessions, re-enables the account and writes an actor-less `ADMIN_RECOVERED` event; TOTP re-enrollment is still mandatory before any access.
- Audit: `audit_events` stores actor, action, target type/id and UTC time only.
- Time: all comparisons and persisted timestamps are UTC (`timestamptz`); valid-through stays date-only.
- Bootstrap: `npm run auth:bootstrap-admin -- --email ... --name ... --confirm` with `BOOTSTRAP_ADMIN_PASSWORD` in the environment; the account must enroll TOTP before any access. `npm run auth:preflight` fails until at least two enabled Administrators have verified TOTP and until both retention schedules are recorded in `retention_policies` by an Administrator after organizational approval. The retention job is `npm run retention:run` (dry run by default; `--confirm` deletes; audit-log deletion needs a privileged role via `RETENTION_DATABASE_URL` and the transaction-local `app.audit_retention` opt-in). `helpers.deactivatedAt` starts the inactive-helper clock.
- Schema: new `auth_*`, helper, retention policy, and `audit_events` tables are defined by five migrations, applied and current on the dev and test databases. Legacy `User`/`Role`/`Permission`/`Identity`/`AuditLog` rows are untouched and unmapped pending inventory and approval.
- Accepted deviations/residuals: Better Auth stores the session token in plaintext in the DB (signed cookie), not as a digest; rate limiting is in-memory (single node only); auth operations and their audit writes are not one atomic database transaction, although audit failures fail closed where required; the bootstrap Administrator password is not automatically forced to rotate, but can be changed at `/account/password`. Applying to another target still requires target-specific migration review, backup/restore readiness, and approved handling of legacy rows.

At least two independently verified Administrator accounts with completed TOTP must be provisioned and checked by a production-readiness preflight before protected production use. Bootstrap them through a controlled operator procedure; do not seed a shared password or MFA secret in source, fixtures, or migration SQL.

## 6. Authorization enforcement

Implement centralized server-side guards with distinct capabilities:

- `requireAuthenticatedSession`: valid, non-revoked session; enabled account; TOTP verified for privileged access.
- `requireMaintainer`: the account has the `MAINTAINER` assignment. Required for all helper profiles, directory results, qualifications, reports, and audit-log reads/writes. `ADMIN` alone never satisfies this check.
- `requireAdministrator`: the account has the `ADMIN` assignment. Required for Maintainer account and role management and assisted TOTP reset. This guard does not grant helper-data access.

Apply the guard in every Server Action and every server-side service entry point that can return or mutate protected data. For profile/qualification operations, validate the target helper and qualification relationship on the server and reject a qualification ID that does not belong to the selected helper. Prevent client-supplied actor IDs, roles, ownership IDs, timestamps, status, or audit metadata from being trusted. The service derives actor and role from the verified server session.

Account creation and role changes are administrator-only and audited. Fixed MVP role assignments are the allowed permission changes. If “manage permissions” is intended to mean arbitrary granular permissions rather than assigning/revoking the approved roles, that permission model must be specified before implementing it.

## 7. Validation and expiry semantics

- Use strict Zod schemas at every Server Action boundary. Reject unknown fields, invalid identifiers, empty required names/titles, malformed email, and invalid date values. Keep database constraints as a second integrity boundary.
- Validate profile fields against the approved fixed field list; do not accept arbitrary JSON, user-defined keys, or dynamically configured schemas.
- Validate qualification title and date-only valid-through value. Enforce `validFrom` or other fields only if specifically approved for MVP; they are not part of the first-delivery report contract.
- Store valid-through as a date, and derive the report against the current calendar date in UTC:
  - **Expired:** `validThrough < today`.
  - **Expiring:** `today <= validThrough <= today + 90 calendar days`, inclusive at both ends.
  - Exclude a null valid-through date and all dates later than day 90 unless the product approves a different rule.
- Report rows contain the approved minimum: helper identifier/name, qualification title, valid-through date, and derived status; inactive helpers are included and visibly marked. Do not select or serialize address, phone, email, profile JSON, qualification metadata, or unrelated personal data.
- Directory search is a case-insensitive partial match on first or last name, submitted through a Server Action rather than a URL. Results are server-side, cursor-paginated, and bounded; optional contact/location fields are not searched.

Use UTC for all persisted timestamps/instants and application time comparisons. The report uses the UTC calendar date, never the server's local time zone.

## 8. Auditability and read granularity

Write a minimal event with `actor`, `action`, `target`, and `time`. Use stable action names for profile/qualification reads and writes, report access, account/role changes, account disable/revocation, password reset, sign-in outcomes, TOTP enrollment/re-enrollment, and Administrator-assisted recovery. Target references identify the affected record/account; do not include record values, search terms, query strings, reason text containing personal data, IP address, or secret material.

- **Writes:** perform the data mutation and audit insert in one Prisma transaction. If the audit insert fails, roll back the mutation; do not report a successful write that was not audited.
- **Reads:** audit each helper-profile or qualification record returned to the caller, including records exposed through directory, profile, and report flows. Insert the read events before returning the data; if auditing fails, fail closed and do not disclose the records. A report-use event may additionally identify the report operation without storing filters or output data. Do not collapse multiple record reads into a single event if that would lose the required target references.
- **Authentication/MFA:** record success/failure and action/target/time only. Do not record attempted credential values or codes.
- **Audit UI:** Maintainer-only, read-only view of event metadata. It is not a generalized export, analytics, or configuration-audit interface. Do not expose raw audit table access to clients.

Because the approved event shape excludes IP and values, the audit log is an accountability trail, not a content snapshot or full forensic log. Protect it from ordinary mutation/deletion paths; apply its separately approved retention schedule. Consider rate limits and pagination for the audit view without adding a new reporting feature.

## 9. Privacy, retention, and operational handling

- Non-production databases, fixtures, logs, and generated artifacts contain only synthetic or irreversibly masked personal data. Do not copy production records into development/test environments. Do not use local spreadsheet/CSV material as seed data without establishing that it is synthetic or irreversibly masked and explicitly approved.
- No manual helper/qualification delete UI or action is included. Implement the hard-delete obligation as a controlled retention operation after the organization approves the inactive-helper schedule. The operation selects inactive records whose approved period has elapsed, hard-deletes helper and qualification personal data transactionally, and leaves only minimal audit events under the separate audit policy.
- Do not invent retention durations. Production launch is blocked until both inactive-helper retention and audit-log retention schedules are approved. The retention operation must be testable with synthetic data, access-controlled, observable without logging personal values, and have a documented restore/backup approach.
- Treat password hashes, TOTP secrets, pending enrollment state, and session tokens as sensitive credentials. Encrypt verified TOTP secrets at rest using a key provided from deployment secret management, separate from the database; restrict key access and never put the key in the repository or database. Ensure backups receive equivalent protection.
- Minimize read payloads and server logs. Avoid caching personalized pages or cross-user responses; use private/no-store behavior for protected content. Do not put personal data in URLs or routine request logs.
- Provide a documented operational recovery path for the case where no other verified Administrator is available. Requirements §8 explicitly leaves this procedure unresolved; it must not bypass TOTP or grant protected access before re-enrollment.

## 10. Deployment and rollout

Target a supported stable Linux runtime in the self-hosted Proxmox LXC environment. The current Compose file is useful as a development PostgreSQL service but is not a complete production deployment: it exposes database ports, includes unused Redis, and does not run the Next.js app. Production topology and operator ownership remain deployment decisions.

Minimum deployment plan:

1. Run the Next.js production server on a supported Node.js runtime, behind a TLS-terminating reverse proxy. Restrict PostgreSQL to the private application network; do not expose the database publicly. Keep production credentials, session/TOTP encryption keys, and database secrets outside source control with restrictive file/secret permissions.
2. Use PostgreSQL with authenticated least-privilege application credentials, encrypted backups, and tested restore procedures. Keep app and database clocks synchronized.
3. Apply schema changes through reviewed Prisma migrations (`prisma migrate deploy` in release), not `db push` against production. Back up before migrations and rehearse upgrade/rollback/restore against masked data.
4. Keep non-production datasets synthetic or irreversibly masked. Before release, verify migrations are current, required secrets/configuration exist, both retention schedules are recorded after external approval, and at least two verified Admin+TOTP accounts exist before enabling protected production use. The application preflight checks auth configuration, the two verified Administrators, and the recorded retention schedules; migration review remains a deployment responsibility.
5. Bootstrap the initial Administrators through a controlled, non-reusable credential setup. Require password change and TOTP verification before they can use protected operations. Document Administrator-assisted reset and the no-Admin recovery procedure.
6. Establish operational monitoring for application/database availability and failed migration/auth health without capturing PII, credentials, TOTP values, or record contents. Keep audit-log access Maintainer-gated.

PostgreSQL 15 is specified in the current development Compose file. Confirm and pin the supported production PostgreSQL version as an operations choice; do not let local Compose defaults silently define the production lifecycle. Redis is optional and should be omitted unless the selected auth library or a measured need requires it.

## 11. Decisions and implementation blockers

The following items must be resolved before their dependent implementation or production use. These are not additional product requirements:

| Decision/blocker | Why it matters | Required decision |
|---|---|---|
| Helper and audit retention schedules | Explicit production gate in requirements. | Organization approval before production; an Administrator records each approved schedule (period, decision reference) at `/admin/retention`; the preflight checks that both exist. **Production blocker.** |
| No-other-Admin recovery | The approved assisted reset requires another verified Administrator; there is no fallback if all Administrators are unavailable. | The operator script `auth:recover-admin` implements a procedure that preserves mandatory TOTP re-enrollment; production use stays blocked until the organization approves it (who may run it, identity verification). |
| Two verified Admin+TOTP accounts | Required before protected production use. | Provision via bootstrap; enforced by `npm run auth:preflight`. **Operational blocker.** |
| Existing-row classification/mapping | Legacy schema conflates accounts and people; no data inspected. | Inventory data and approve a lossless map before any migration of legacy rows. |
| Applying migrations to dev/test | All five repository migrations are applied and current on both databases. | Resolved; verified with `prisma migrate status` on each database. |
| Applying migrations to another target | No target database has been identified or inventoried; legacy `User` rows remain unmapped. | Confirm target identity, inventory and approve legacy-row mapping, then review, back up, and apply through the normal deployment process. |

Resolved: fixed helper fields (first/last name required; email/phone/address optional; active by default), directory search (case-insensitive partial first/last-name match), inclusion and visible marking of inactive-helper qualifications in the expiry report, authentication library (Better Auth), organization time zone (UTC), session/credential policy (8 h absolute, 12+ character passwords, in-memory rate limits and TOTP lockout), meaning of "manage permissions" (Maintainer role assignment/revocation), and unit test framework (Vitest; Playwright later).

Until the retention schedules and two verified Admin+TOTP accounts are in place, protected production use is blocked regardless of application readiness. Do not make up a retention duration or emergency access bypass.

## 12. Testing and verification plan

Add tests before or alongside each implementation increment. Vitest currently covers auth policy/configuration, strict helper/qualification inputs, and UTC expiry-window boundaries (61 unit tests at this increment).

- **Pure unit tests (recommended Vitest):** date-only conversion; expiry boundaries for yesterday, today, day 90, day 91, leap/month/year rollover, and organization-time-zone/DST transitions; status derivation; input schemas and unknown-field rejection; authorization matrix (Admin only denied helper data, Maintainer allowed, dual-role allowed).
- **Database integration tests (PostgreSQL):** migrate an empty database; verify unique account email/helper ID, required qualification foreign key, qualification ownership checks, role-assignment uniqueness, valid-through date preservation, and retention hard-delete behavior with retained audit event references.
- **Authentication/MFA integration tests:** password success/failure and generic error handling; TOTP enrollment is not complete until code verification; un-enrolled privileged users cannot access any protected page/action; invalid TOTP is rejected and repeated invalid attempts are locked/rate-limited; reset clears/revokes factor/session and forces re-enrollment; password reset does not remove MFA; disabled account, role revocation, and session revocation take effect on the next protected request; cookie flags and CSRF/origin defenses.
- **Audit integration tests:** every helper/profile and qualification read/write and report-returned record produces the required target event; writes and audit events commit/roll back atomically; read data is not returned when audit persistence fails; event serialization contains only actor/action/target/time; no PII, field values, IP, credentials, query terms, or TOTP material.
- **Component/route tests:** role-gated navigation and pages, fixed-field validation feedback, bounded directory pagination/search, minimal report columns, and absence of delete/export/dynamic-field controls.
- **End-to-end tests (recommended Playwright):** privileged sign-in → mandatory TOTP enrollment/challenge → directory search → profile and qualification create/update → report boundaries → Admin-only account administration without helper-data access → Maintainer+Admin access → disable/revoke immediately blocks existing session → assisted reset requires re-enrollment.
- **Release checks:** lint, TypeScript typecheck, production build, migration rehearsal and restore, masked/synthetic non-production data review, two verified Admin+TOTP preflight, retention approvals, and a security review of the selected auth implementation.

Tests must use synthetic identities, passwords, TOTP secrets, and qualifications. Never place live production personal data or credentials in fixtures, snapshots, CI logs, or test reports.

## 13. Acceptance-criteria mapping

| Approved requirement | Design response / verification |
|---|---|
| Email/password sign-in; mandatory TOTP for every Maintainer/Admin; enrollment-only access before verification | §5 auth state flow; §6 centralized guards; auth integration/E2E tests in §12. |
| Admin manages Maintainer accounts/permissions; disable/revoke blocks existing sessions; password reset does not satisfy MFA | §5 database-backed revocable sessions; §6 separate role guards and audited account actions; auth tests in §12. |
| Verified Admin-assisted TOTP recovery and mandatory re-enrollment | §5 reset/re-enroll state transition; unresolved verification details in §11; regression tests in §12. |
| Stable helper ID; Maintainer profile/qualification create/read/update; no manual delete | §3 routes/actions; §4 independent Helper and required qualification FK; §6 ownership checks; no delete route; database and E2E tests. |
| Searchable helper directory/profile | `/helpers` and `/helpers/[helperId]` in §3; bounded case-insensitive first/last-name search and cursor pagination in §7. |
| Expired and next-90-calendar-day report, day 90 inclusive; minimal columns; include inactive helpers | §7 date-only UTC boundaries and minimized projection; inactive helpers are marked; §12 boundary tests. |
| Each profile/qualification read/write audited, including report record reads; auth/MFA events; minimal audit metadata | §8 record-level granularity and transactional/fail-closed policy; §4 minimal audit event; §12 audit tests. |
| Audit read access Maintainer-only | `/audit` in §3 and `requireMaintainer` in §6. |
| Synthetic/masked non-production; hard-delete inactive helper PII/qualifications per policy; no production until both retention schedules approved | §9 handling and retention operation; §10 production preflight; §11 explicit launch blocker; §12 retention test. |
| Two verified Admin+TOTP accounts before protected production use | §5 provisioning; §10 preflight; §12 release checks. |
| Desktop-first, self-hosted Proxmox LXC-friendly, data minimization | Existing stack retained; §3 server-rendered desktop data-entry surfaces; §7 minimal query/report projections; §10 Linux LXC deployment plan. |
| Deferred scope excluded | §1 and §3 do not provide Helper self-service, tasks, equipment, dynamic fields, exports, or missing-qualification reporting. |
