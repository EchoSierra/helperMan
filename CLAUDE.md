# Project: Helper Manager

## Project Overview
A management system for coordinating, scheduling, and tracking helpers (e.g., domestic workers, personal assistants, cleaners).

## Team Structure
The project follows a multi-agent organizational structure:

### 1. Product Manager (PM)
- **Goal:** Defines *what* is being built.
- **Responsibilities:** Interviews the customer to gather requirements, defines user stories, and maintains the Product Requirements Document (PRD).

### 2. Architect
- **Goal:** Defines *how* the system is built.
- **Responsibilities:** Translates the PRD into a Technical Design Document (TDD) covering database schemas, API architecture, and component hierarchy.

### 3. Security Expert
- **Goal:** Ensures the system is *safe* and compliant.
- **Responsibilities:** Conducts security reviews on PRDs and TDDs. Ensures adherence to OWASP Top 10, secure authentication, and data protection.

### 4. Development Team
- **Goal:** Executes the build.
- **Responsibilities:** Writes TypeScript/Next.js code, implements database migrations, and ensures the final product matches the Architect's specs and the Security Expert's requirements.

## Workflow
1. **Discovery:** PM and Security Expert define the PRD.
2. **Design:** Architect and Security Expert define the TDD.
3. **Implementation:** Developers build the features with periodic Security Expert audits.
