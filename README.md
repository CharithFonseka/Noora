# NOORA

NOORA is a Sri Lankan clothing e-commerce project. This repository is the initial application foundation for the storefront, admin experience, API, and database.

## Stack

- Storefront and admin: Next.js App Router, React, TypeScript
- API: Express 5 and TypeScript
- Database: MySQL 8.4 with Prisma ORM 7
- Local database: Docker Compose

Prisma is constrained to major version 7 because this project uses MySQL. Prisma's current v8 release candidate does not yet include its MySQL connector.

## Repository layout

```text
apps/
  api/                 Express API
  storefront/          Next.js storefront and admin UI
packages/
  database/            Prisma schema and database client
docker-compose.yml     Local MySQL service
```

## Local setup

Requirements: Node.js 24 LTS, npm 10+, and Docker Desktop or Docker Engine.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and adjust local values if needed.
3. Start MySQL with `docker compose up -d mysql`.
4. Start the storefront with `npm run dev:web`.
5. In another terminal, start the API with `npm run dev:api`.

The storefront runs at `http://localhost:3000`. The API health endpoint is `http://localhost:4000/health`.

## Branch and release flow

- Keep `main` deployable and protect it.
- Create one `feature/<short-name>` branch per feature from the latest integration branch.
- Open a pull request for review and required checks.
- Merge accepted features into `staging` for integration and stakeholder review.
- Promote an approved release from `staging` to `main`.

Feature branches with dependencies should be integrated in dependency order. Avoid implementing checkout against unfinished catalogue or inventory interfaces.

## Environment configuration

Use `.env.example` as the local template. Never commit `.env` files, payment credentials, production database URLs, or other secrets. Production and staging must use separate credentials and databases.

## Project status

This first commit contains service scaffolding and local database configuration. Customer accounts, product catalogue workflows, cart, checkout, payments, shipping, and inventory behavior are not implemented yet.

