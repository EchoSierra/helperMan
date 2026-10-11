# Development Standards

This document defines the engineering standards for the **Helper Manager** project. All team members (Agents) must adhere to these principles to ensure a maintainable, scalable, and high-quality codebase.

## 1. Core Principles
- **Clean Code:** Prioritize readability. Code is read much more often than it is written.
- **DRY (Don't Repeat Yourself):** Abstract repeated logic into reusable functions or components.
- **KISS (Keep It Simple, Stupid):** Avoid over-engineering. Prefer the simplest solution that meets the requirements.
- **Explicit over Implicit:** Prefer explicit variable names and function signatures. Avoid "magic" numbers or configurations.
- **Type Safety:** TypeScript is the source of truth. Avoid `any` at all costs; use `unknown` and type guards instead.

## 2. Project Structure & Modularization
We follow a **Feature-Based Architecture**. Instead of grouping files by *type* (e.g., all components in one folder), group them by *feature* (e.g., all "Login" related files in a `login` folder).

- **`app/`**: Application-level routing and pages.
- **`components/`**: Shared, reusable UI components (buttons, inputs, modals).
- **`features/`**: Feature-specific components, hooks, and logic (e.g., `features/auth`, `features/qualifications`).
- **`lib/`**: Shared utilities (formatting, math, API wrappers).
- **`types/`**: Global TypeScript definitions.
- **`schema/`**: Zod validation schemas and Prisma schemas.
- **`actions/`**: Server Actions for database mutations and server-side logic.

## 3. Component Design
- **Functional Components:** Use the standard React Functional Component pattern.
- **Hooks:** Extract logic from components into custom hooks (e.g., `useAuth`, `useQualifications`).
- **Atomic Design:** Break down complex components into smaller, testable sub-components.
- **Stateless Components:** Keep components as pure as possible; only accept props and manage internal state where necessary.

## 4. State Management
- **Zustand:** Use for global application state (e.g., User Session, Theme, Notifications).
- **React Context:** Use for state that is local to a specific tree (e.g., a complex multi-step form).
- **Server State:** Use **TanStack Query (React Query)** or **Server Actions** for data fetching and caching.

## 5. Testing & Quality Assurance
- **Testing Strategy:**
  - **Unit Tests:** Test small, pure functions and complex logic (e.g., price calculations, regex validations).
  - **Integration Tests:** Test component interactions and API flows.
  - **E2E Tests:** Test critical paths (e.g., Login, Booking a helper).
- **Tools:** Use `Vitest` for unit tests and `Playwright` or `Cypress` for E2E tests.
- **TDD (Test-Driven Development):** Where possible, write a test to define the expected output before implementing the logic.

## 6. Error Handling & Logging
- **Graceful Degradation:** Ensure the UI remains usable even if a component fails.
- **Error Boundaries:** Wrap complex features or interactive widgets in Error Boundaries.
- **Validation:** Use **Zod** for all input validation (Form fields, Query parameters, JSON bodies).
- **Custom Errors:** Create a standardized Error hierarchy (e.g., `ValidationError`, `UnauthorizedError`).

## 7. Performance & Scalability
- **Image Optimization:** Use Next.js `<Image />` component for all images.
- **Code Splitting:** Use `next/dynamic` for heavy components that are not immediately visible.
- **Database Efficiency:** Use `select` queries to fetch only the columns needed. Avoid N+1 queries by using Prisma's `include` and `select`.
- **Debouncing/Throttling:** Always use for search inputs and scroll listeners.
