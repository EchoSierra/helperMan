# Helper Manager

Helper Manager is a Next.js application for managing helper profiles and qualifications. It uses PostgreSQL and Prisma. Authentication is email/password with mandatory TOTP for privileged accounts.

## Requirements

- Node.js 20.9 or later (required by the current Next.js version)
- npm
- Docker with the Compose plugin, for the local PostgreSQL container

## Development

### 1. Install dependencies and configure the environment

```sh
npm ci
cp .env.example .env
```

Edit `.env` and set:

- `POSTGRES_PASSWORD` to a local development password. Compose requires it.
- `DATABASE_URL` to the matching local PostgreSQL connection string, for example:
  `postgresql://admin:YOUR_LOCAL_PASSWORD@localhost:5432/helper_manager?schema=public`
- `BETTER_AUTH_SECRET` to at least 32 random characters. Generate one with:
  `openssl rand -base64 48`
- `BETTER_AUTH_URL` to `http://localhost:3000`

Use a URL-encoded password in `DATABASE_URL` if it contains characters reserved in a URL. `.env` is ignored by Git; do not commit real credentials.

### 2. Start PostgreSQL

The Compose file is for local development. It also defines Redis, which this application does not currently use.

```sh
docker compose up -d db
docker compose ps
```

To stop the containers later:

```sh
docker compose down
```

The database volume is retained. To stop and remove that local data volume, use `docker compose down --volumes` only when you intend to discard the development database.

### 3. Apply migrations and generate Prisma Client

```sh
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` applies the repository's existing migrations to the database configured by `DATABASE_URL` without prompting. Do not use `npx prisma migrate dev` for setup: it detects a harmless cosmetic difference on two legacy join tables (`_PermissionToUser`, `_RoleToUser`) and asks for a new migration name. If you see that prompt, press Ctrl+C; do not create a migration. Do not point these commands at a production database. If you are connecting to an existing database, first verify its identity and migration state.

### 4. Create a local Administrator and run the app

Set a temporary development password in the environment for the bootstrap command; do not pass it as a command-line argument or commit it:

```sh
set -a
. ./.env
set +a
export BOOTSTRAP_ADMIN_PASSWORD='my12CaracterPasswordForAdmin'
npm run auth:bootstrap-admin -- --email admin@example.test --name "Local Administrator" --confirm
unset BOOTSTRAP_ADMIN_PASSWORD
unset DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL POSTGRES_PASSWORD
npm run dev
```

Open <http://localhost:3000>, sign in, and complete TOTP enrollment with an authenticator app. Do not reuse a production password or authenticator secret in development.

The bootstrap and preflight scripts read configuration from the process environment; unlike Next.js and the Prisma CLI, they do not automatically load `.env`. When running either script locally, load the file into the environment first as shown above.

The bootstrap script creates an Administrator, not a Maintainer. Administrators without the Maintainer role are intentionally denied helper-data access. The Maintainer account/role-management UI is not implemented yet, so this repository does not currently provide a complete self-service way to provision a development Maintainer account.

### 5. Test and check changes

Run the project checks from the repository root:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

### Database UI

`docker compose up -d adminer` starts Adminer at <http://localhost:8081> (bound to localhost only; dev use only). Log in with System `PostgreSQL`, Server `db`, and the `POSTGRES_USER` / `POSTGRES_PASSWORD` from `.env`.

PostgreSQL integration tests run against a separate, disposable database (the name must contain `test`; the runner refuses anything else and applies migrations to it). Create it once, set `TEST_DATABASE_URL` in `.env` (see `.env.example`), and run:

```sh
docker compose exec -T db psql -U admin -d postgres -c "CREATE DATABASE helper_manager_test"
npm run test:integration
```

For a local production-mode smoke test after a successful build:

```sh
npm run start
```

This starts Next.js on port 3000 using the production build. It does not configure TLS or a reverse proxy.

## Production deployment

**Production is not ready to launch yet.** The Administrator account-management page (the read-only audit-log page exists), an operational no-other-Administrator recovery procedure, and the organization-approved helper and audit retention schedules remain outstanding. The production preflight deliberately fails until its account and retention requirements are met. Review [the living implementation plan](./docs/IMPLEMENTATION_PLAN.md), [docs/TDD.md](./docs/TDD.md), and [requirements.md](./requirements.md) before deployment.

The repository does not include a production Compose/Kubernetes configuration. Use an operator-managed supported Linux host or container runtime and a separately managed PostgreSQL service. Do not use the development Compose file for production: it publishes database ports, includes unused Redis, and does not run the application.

### Deployment procedure

1. Prepare a supported Node.js 20.9+ runtime and PostgreSQL instance. Restrict PostgreSQL to the application's private network, use a least-privilege database account, synchronize host/database clocks, and configure encrypted backups with a tested restore procedure.
2. Put the application behind a TLS-terminating reverse proxy. Configure the public HTTPS origin in `BETTER_AUTH_URL`; do not expose the application over plain HTTP to users.
3. Set production environment variables through the platform's secret manager or protected environment configuration:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET` (at least 32 random characters; protect it as a credential)
   - `BETTER_AUTH_URL` (the public `https://` origin)
   - `HELPER_RETENTION_POLICY_APPROVED=true` and `AUDIT_RETENTION_POLICY_APPROVED=true` only after the organization has formally approved both schedules.
4. Deploy the reviewed application revision and install locked dependencies:

   ```sh
   npm ci
   npx prisma generate
   npm run build
   ```

5. Back up the target database, confirm its identity and migration state, then apply migrations as a controlled release step:

   ```sh
   npx prisma migrate deploy
   ```

   Never use `prisma migrate dev` or `prisma db push` against production.
6. Bootstrap Administrators using the controlled script and a password supplied only through the protected environment. Run it once per Administrator, using unique credentials:

   ```sh
   export BOOTSTRAP_ADMIN_PASSWORD='provide-through-your-secret-manager'
   npm run auth:bootstrap-admin -- --email admin@example.org --name "Administrator" --confirm
   unset BOOTSTRAP_ADMIN_PASSWORD
   ```

   Each Administrator must sign in and complete TOTP enrollment. Provision and verify at least two enabled Administrators with verified TOTP before protected production use.
7. Once the approved retention flags are set and the two verified Administrators are in place, run the readiness preflight:

   ```sh
   npm run auth:preflight
   ```

   A non-zero exit indicates that a production blocker remains. Do not bypass or suppress it.
8. Start the built application under a process supervisor/container runtime that restarts it on failure, and direct the reverse proxy to the configured application port (Next.js defaults to 3000):

   ```sh
   npm run start
   ```

   Configure health monitoring, log access, backups, and updates operationally. Do not place credentials, TOTP secrets, helper data, or personal information in routine logs.

The preflight currently checks authentication configuration, the two verified Administrators, and the two retention approval flags. It does not replace migration review, database backup/restore testing, network/TLS hardening, policy approval, or the still-required no-Administrator recovery procedure.
