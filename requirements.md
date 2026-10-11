# Requirements: Helper Manager System

## 1. Project Goals
- Provide a centralized, structured database for managing helpers (domestic workers, personal assistants, cleaners, etc.).
- Replace manual tracking with a robust system that handles complex, multi-category data (qualifications, equipment, etc.).
- Ensure data integrity and ease of maintenance for the management team.

## 2. Target Audience
- **Managers/Maintainers:** Users who manage records, audits, and reports for the help force.
- **Administrators:** System managers who handle user permissions and system configurations.
- **Helpers:** Personnel within the system who need to see their own information, training status, and assigned tasks.

## 3. Data Modules (Core Entities)
The system must support the following data categories linked to a unique identifier:

- **Stammdaten (Identity):** Name, Address, Phone, Email, etc.
- **Equipment & Accessories:** Status and assignment of items required for work (e.g., cleaning supplies, specialized tools, etc.). This module should help verify if a helper has the necessary accessories for their assigned tasks.
- **Qualifikationsnummern (Skills):** A large, complex list of specific certifications/skills (e.g., "Senior Care Certified", "Advanced Cleaning", etc.).
- **Validität (Validity):** Expiry dates and valid types for all professional qualifications.

## 4. Core Features (MVP)
- **Searchable Table Reports:** High-performance tables with filtering/sorting for all categories.
- **Detailed Profile View:** A comprehensive record for each helper, divided into the modules above.
- **Dynamic Field Management:** 
    - **Dynamic Schema:** Admins must be able to add/rename fields for "Qualifikationsnummern" and "Equipment & Accessories" via a UI.
    - **Validation:** Dynamic fields must be restricted to specific data types (String, Integer, Date, Boolean) and validated against a whitelist of allowed characters to prevent injection.
- **Analytics & Reporting:** Specialized views for identifying missing qualifications or expiring certs.
- **Data Export:** One-click export of specific reports (e.g., "Valid Skills") formatted to match internal standards.
- **Audit Log:** Comprehensive tracking of:
    - 1. All Account Management actions (User creation, permission changes).
    - 2. All Configuration changes (Dynamic Schema modifications).
    - 3. All "Write" operations on Personal Identity or Qualification records.

## 5. Authentication & Authorization (Security)
The system must be protected by a robust authentication layer.
- **Authentication Methods:** 
    - Primary: Email and Password.
    - **Mandatory MFA:** Multi-Factor Authentication (MFA) via TOTP (Authenticator Apps) is **required** for all Admin and Maintainer accounts.
- **Role-Based Access Control (RBAC):**
    - **Helper:** Can view and edit *only* their own profile, training status, and assigned tasks.
    - **Maintainer:** Can view, edit, and export all data related to helpers. This is the baseline requirement for viewing any data.
    - **Administrator:** 
        - **Access:** Can only see data if they also hold the `Maintainer` role.
        - **Privileges:** Can create/delete Maintainer accounts and manage the dynamic attributes of the system.

## 6. Non-Functional Requirements
- **Desktop-First:** Optimized for large screens and complex data entry.
- **Self-Hosted:** Designed for deployment on Proxmox LXC (Stable, standard Linux stack).
- **Data Integrity:** Strict validation rules for required fields (e.g., phone numbers, valid dates).
- **Scalability:** Performance-optimized for a growing number of records.
- **Privacy & Compliance:**
    - **Data Minimization:** Ensure PII is only accessible to authorized roles.
    - **Data Masking:** PII should be masked in non-production environments and in non-essential reports.
    - **Data Retention:** Implement a policy for the deletion of records for inactive helpers after a set period.

## 7. Technical Requirements
- **Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL (TBD).
- **Deployment:** Proxmox LXC friendly.
- **Database Strategy:** 
    - **Current Plan:** Hybrid approach using fixed schemas for core identity and a JSONB-backed/Dynamic approach for individual qualifications and equipment fields.
    - **Architecture Consideration:** Evaluating MongoDB for its flexible schema capabilities, specifically for handling the dynamic fields of skills and equipment.
