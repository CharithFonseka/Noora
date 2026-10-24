# NOORA

NOORA is a Sri Lankan clothing storefront for women, men and children. This monorepo contains the customer website, a TypeScript API, MySQL data model and deployment assets.

## Technology

- **Storefront and staff workspace:** Next.js 16 App Router, React 19, TypeScript
- **Commerce API:** Express 5, TypeScript, Zod validation
- **Database:** MySQL 8.4, Prisma ORM 7 with the MariaDB driver adapter
- **Local development:** Node.js 24 LTS, npm workspaces, Docker Compose
- **Production target:** DigitalOcean App Platform with a managed MySQL cluster

## Repository layout

```text
apps/api/                     Express API and initial-admin command
apps/storefront/              Customer storefront and staff workspace
packages/database/prisma/     MySQL schema and migrations
deployment/digitalocean/      Staging and production App Platform specs
deployment/Dockerfile.migrate Pre-deploy database migration job
Dockerfile.api                API image
Dockerfile.web                Storefront image
```

## Local setup

Requirements: Node.js 24, npm 10 or newer, and Docker Desktop or Docker Engine.

1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`.
3. Start MySQL: `docker compose up -d mysql`.
4. Apply the initial schema: `npm run db:migrate:dev`.
5. Start the API with `npm run dev:api` and the website with `npm run dev:web` in separate terminals.

The storefront is available at `http://localhost:3000`, the API at `http://localhost:4000`, and API health at `/health` and `/ready`.

The `FLAT_SHIPPING_LKR` value is deliberately empty in `.env.example`. Checkout returns a configuration error until the business supplies the agreed delivery charge. Set a non-negative whole-number LKR amount in `.env` to enable COD checkout locally.

## Store features

- Product catalogue with category and text search, product variants, photos, LKR prices and stock levels.
- Customer registration and sign-in with server-managed opaque sessions stored as hashes.
- Signed-in shopping bag, address-at-checkout, stock reservation, order history and COD orders.
- Staff workspace for categories, products, stock, order processing and shipping status.
- Staff-only tools require authenticator-based multi-factor sign-in. The first admin enrolls an authenticator before the admin workspace unlocks.
- API rate limiting, input validation, security headers, origin checks and readiness health checks.

## First administrator

Set `MFA_ENCRYPTION_KEY` before creating staff accounts. Generate a private 32-byte key and save it in `.env` (or the production secret store):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (14 or more characters), `BOOTSTRAP_ADMIN_FIRST_NAME`, and `BOOTSTRAP_ADMIN_LAST_NAME` in the environment and run:

```sh
npm run admin:create
```

Bootstrap refuses to run after an admin exists. Remove the four bootstrap values from the environment after the initial account is created. The admin signs in at `/account`, opens `/admin`, and enrolls an authenticator app with the setup key shown there. Keep `MFA_ENCRYPTION_KEY` backed up and stable; changing it requires staff to enroll again.

## API overview

Public: `GET /api/categories`, `GET /api/products`, `GET /api/products/:slug`.

Accounts: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`. Staff MFA: `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/enable`.

Signed-in: `GET /api/cart`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:id`, `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`.

Staff with MFA: `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`, `GET /api/admin/products`, `POST /api/admin/products`, `PUT /api/admin/products/:id`, `PATCH /api/admin/variants/:id/stock`, and `POST /api/admin/categories`.

## Branch and release flow

Each capability has a named `feature/*` branch. Open and merge its pull request into `main` in dependency order: `feature/database-foundation` → `feature/commerce-api` → `feature/storefront` → `feature/staff-mfa` → `feature/deployment`. Before merging, run `npm ci`, `npm run db:validate`, and `npm run build`. A GitHub Actions workflow is not installed yet because the GitHub token used for pushing this branch cannot write workflow files; add the build workflow after granting the token the `workflow` scope.

After the reviewed features reach `main`, create `staging` from that commit. Merge release candidates from `main` into `staging` for stakeholder review, then promote the approved release from `staging` to `main` according to the team’s release decision. Keep production deploys attached to `main` and staging deploys attached to `staging`.

## Deployment

The DigitalOcean deployment files are in `deployment/digitalocean/`. They define independent staging and production apps, each with separate MySQL data, a pre-deploy migration job, API/storefront containers, same-origin `/api` routing, health checks and deployment/domain failure alerts. See [deployment/runbook.md](deployment/runbook.md) for the account setup and launch steps.

Before accepting real orders, the business must set delivery charges (and any district-specific rules), decide whether to connect a card gateway, supply production domain/DNS, provide real product content and images, and approve customer-facing privacy, returns and tax rules. Card payments and guest checkout remain unavailable. The current checkout supports authenticated customers using cash on delivery only.

## Build and schema checks

```sh
npm run db:validate
npm run build
```

`npm run build` generates Prisma Client and builds the database package, API and storefront. There is not yet an automated CI workflow or a business-approved automated test suite.
