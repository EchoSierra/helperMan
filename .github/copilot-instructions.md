# Helper Manager project instructions

- Read `requirements.md` for the current product requirements and `DEVELOPMENT_STANDARDS.md` before planning or changing the application.
- The project uses Next.js App Router, TypeScript, Tailwind CSS, and Prisma. Keep TypeScript strict and avoid `any`.
- The database choice is unresolved in `requirements.md` (PostgreSQL is listed as TBD and MongoDB is under consideration). Do not make or encode that decision without explicit approval.
- Keep personal information private: minimize data access, enforce authorization at the server boundary, and do not expose secrets or real helper data in examples, logs, or tests.
- Validate external input with the project's established validation patterns; inspect existing code before introducing new dependencies or architecture.
- Preserve the feature-based organization described in `DEVELOPMENT_STANDARDS.md` while respecting the existing repository structure.
- Keep product requirements, technical design, security review, and implementation work distinct. Call out gaps and conflicts rather than silently inventing requirements.
