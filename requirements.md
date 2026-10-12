# Requirements: Helper Manager System

## 1. Project Goals

- Provide a centralized, structured system for maintaining helper identity and qualification records.
- Replace manual tracking with reliable records and timely qualification-expiry oversight.
- Protect helper personal data through role-based access, mandatory multi-factor authentication for privileged accounts, and auditable access.

## 2. Users and Role Boundaries

- **Helper:** A person whose information is held by the system. Helper self-service is not included in the first delivery; future scope is described below.
- **Maintainer:** Manages helper identity and qualification records and uses the qualification-expiry report.
- **Administrator:** Manages Maintainer accounts and permissions. An Administrator may access helper records or reports only when also assigned the Maintainer role.

Role permissions are additive only where explicitly stated. A user without the Maintainer role must not be able to view helper records or helper reports.

## 3. First Delivery (MVP)

The first delivery is a Maintainer-focused helper registry. It includes secure sign-in, helper identity/profile and qualification record maintenance, a qualification-expiry report with a 90-day warning window, and auditable controls.

### 3.1 User Stories and Acceptance Criteria

#### Secure access and account management

- **As a Maintainer or Administrator, I want to sign in securely so that access to helper information is limited to authorized accounts.**
  - Email and password are the primary sign-in credentials.
  - TOTP multi-factor authentication is mandatory for every Maintainer and Administrator.
  - A privileged account must complete TOTP enrollment before it can access any protected system content or action.
  - Until TOTP enrollment is complete, the account can access only the steps needed to finish enrollment; helper records, reports, and account-management functions remain inaccessible.
  - Protected sessions expire 8 hours after sign-in, regardless of activity; session expiry is absolute and is not sliding-renewed.
  - Every new sign-in by a Maintainer or Administrator requires TOTP verification.
- **As an Administrator, I want to manage Maintainer accounts and permissions so that access can be granted and withdrawn appropriately.**
  - Administrators can create and delete Maintainer accounts and manage their permissions, within the first-delivery scope.
  - An account can be disabled or have its access revoked. Once disabled or revoked, it cannot sign in or continue using an existing authenticated session to access protected content or actions.
  - Administrators and Maintainers can change their own password. The change requires the current password and a valid TOTP code, revokes all of the user's sessions, and is audited.
  - Administrators can delete Maintainer accounts (not Administrator accounts or their own).
  - Password reset changes or replaces the password credential only; it does not satisfy, remove, or disable the mandatory TOTP requirement.
  - A privileged account that has had its TOTP enrollment reset must complete TOTP re-enrollment before regaining access to protected content or actions.
  - TOTP recovery requires assistance from a verified Administrator. A reset does not grant access before re-enrollment is complete.
  - Account creation, deletion, permission changes, disablement/revocation, password reset, and TOTP recovery actions are auditable.

#### Helper and qualification records

- **As a Maintainer, I want to find and view a helper profile so that I can review the helper's identity and qualifications.**
  - A Maintainer can read helper identity/profile and qualification records.
  - Each helper has a unique identifier that links the profile and qualification records.
  - Directory search is a case-insensitive partial match against first or last name; optional email, phone, and address are not searchable in the first delivery.
- **As a Maintainer, I want to create and update helper identity/profile records so that the registry remains current.**
  - A Maintainer can create and update helper identity/profile records.
  - First and last name are required fields on the first-delivery helper profile; email, phone, and address are optional.
  - A helper has an active/inactive status, initially active, which Maintainers can update.
  - A Maintainer can create and update qualification records, including qualification title and valid-through date.
  - The first-delivery interface provides no manual delete action for helper or qualification records.
- **As an Administrator, I want helper-data access to follow the Maintainer role boundary so that administrative privileges alone do not expose personal data.**
  - An Administrator without the Maintainer role cannot read helper profiles, qualification records, or helper reports.
  - An Administrator who also has the Maintainer role can perform the same helper-record and report actions as a Maintainer.

#### Qualification-expiry report

- **As a Maintainer, I want to identify expired and soon-to-expire qualifications so that I can follow up before qualification validity lapses.**
  - The report includes expired qualifications and qualifications whose valid-through date falls within the next 90 calendar days, including the 90th day.
  - A qualification is marked **Expired** when its valid-through date is before the current date; it is marked **Expiring** when its valid-through date is today through the 90th day ahead, inclusive; otherwise it is not included in this report.
  - The organization time zone for date-based report boundaries is UTC.
  - Qualification valid-through is a calendar date, not a timestamp, so time-zone conversion does not shift the date.
  - All persisted timestamps/instants and application time comparisons use UTC.
  - Each report row contains, at minimum, the helper identifier/name, qualification title, valid-through date, and status.
  - The report includes qualifications for active and inactive helpers and visibly identifies inactive helpers.
  - The report excludes helper address, contact details, and unrelated personal information.
  - The report is available only to users with the Maintainer role.

#### Audit and privacy

- **As a Maintainer, I want relevant access and changes to be auditable so that use of helper data can be reviewed.**
  - Each read and write of a helper profile or qualification record is recorded, including record reads resulting from report use.
  - Authentication and MFA events are recorded, including sign-in outcomes, TOTP enrollment/re-enrollment, and recovery actions.
  - Each audit event contains only the minimal metadata needed for accountability: actor, action, target reference, and time.
  - Audit events do not contain passwords, TOTP secrets, personal-data field values, or qualification contents.
  - Audit-log access follows the helper-data role boundary: it is available only to users with the Maintainer role.
  - Audit-log retention follows the organization's separately approved audit-log schedule.

## 4. Privacy, Retention, and Production Readiness

- **Non-production data:** Before data is loaded into any non-production environment, it must be synthetic or irreversibly masked. This applies to database copies, test fixtures, logs, and generated exports. Unmasked production personal data must not be present in non-production environments or artifacts.
- **Inactive helpers:** Inactive-helper records are handled according to the organization's approved retention policy. When the approved retention period expires, helper personal and qualification records are hard-deleted; only minimal audit metadata may remain under the separate approved audit-log policy. No retention duration or legal rule is specified by this requirements document.
- **Operational prerequisite:** The organization must approve the inactive-helper retention policy and schedule and the audit-log retention schedule before production use. Production use must not begin until these schedules are approved.
- **MFA recovery:** Recovery must follow the verified Administrator-assisted reset and mandatory TOTP re-enrollment flow above. No password reset, account recovery, or account-administration action may grant privileged access without completed TOTP enrollment.
- **Privileged-account readiness:** At least two verified Administrator accounts with completed TOTP enrollment must be provisioned before protected production use, so an Administrator can perform the approved recovery flow if another Administrator loses access.
- The absence of a manual helper/qualification delete control in the first-delivery interface does not remove the approved retention and hard-deletion obligation.

## 5. Future Scope (Not in the First Delivery)

The following previously identified requirements remain future scope; they are not commitments for the first delivery:

- **Helper self-service:** Helpers may eventually view and edit only their own profile, training status, and assigned tasks.
- **Tasks:** Assigned-task access and management.
- **Equipment & Accessories:** Tracking the status and assignment of work items and whether helpers have required items for assigned tasks.
- **Broader qualification catalog and validity:** Support the full, potentially large and complex list of specific skills/certifications and qualification validity types/dates beyond the first-delivery title and valid-through date fields.
- **Dynamic Field Management:** Administrators may eventually add or rename qualification and equipment fields through a UI. Field types would be restricted to String, Integer, Date, and Boolean, with validation against an allowed-character whitelist.
- **Searchable Table Reports:** High-performance filtering and sorting across all categories.
- **Broader Analytics and Reporting:** Reports for missing qualifications and other specialized views beyond the first-delivery qualification-expiry report.
- **Data Export:** One-click export of selected reports, formatted to internal standards. When exports are introduced, each export must be audited; export audit events must not include sensitive values.
- **Broader detailed profile:** A comprehensive profile covering identity, qualifications, equipment, and any future modules.
- **Configuration auditing:** Audit tracking for configuration changes, including dynamic-schema changes, when those capabilities are introduced.
- **Broader audit reporting:** Comprehensive review and reporting over account-management, configuration, and record-access/write audit events, subject to the role boundary and approved audit-log schedule.

## 6. Non-Functional Requirements

- **Desktop-first:** The system is optimized for large screens and complex data entry.
- **Self-hosted deployment:** The system is suitable for deployment on Proxmox LXC using a stable, standard Linux stack.
- **Data integrity:** Required fields and values, including phone numbers and dates where applicable, are validated.
- **Scalability:** The system performs adequately as the number of records grows.
- **Privacy and data minimization:** Personal information is accessible only to authorized roles and reports expose only the information needed for their purpose.

## 7. Confirmed Project Constraints

- **Database:** PostgreSQL is confirmed for the MVP.
- **MongoDB evaluation:** Parked; it is not part of the MVP.
- **Application stack:** Next.js (App Router), TypeScript, Tailwind CSS, and Prisma.
- **Deployment:** Proxmox LXC friendly.

## 8. Outstanding Operational Decisions

- The organization must define and approve the retention schedules identified above before production; this document deliberately sets no duration.
- The organization must determine the operational recovery procedure for a privileged account when no other verified Administrator is available. Any such procedure must preserve mandatory TOTP enrollment and must not grant protected access before re-enrollment.
