# Vercel deployment guide

NOORA uses two Vercel projects connected to the same GitHub repository:

| Vercel project | Root directory | Production domain | Purpose |
| --- | --- | --- | --- |
| `noora-storefront` | `apps/storefront` | `pathum.gay` and `www.pathum.gay` | Next.js storefront and staff workspace |
| `noora-api` | `apps/api` | `api.pathum.gay` | Express API function |

Use the `main` branch for production. Preview deployments are useful for review, but must use a separate non-production database and environment values before accepting test orders.

## 1. Create a MySQL database

Provision a managed MySQL 8.4 database with TLS, automated backups, and enough connections for the API's serverless scale. The database provider must allow secure connections from Vercel functions. If the provider offers connection pooling, use its recommended configuration and connection string. Do not put database credentials in Git or in `NEXT_PUBLIC_*` variables.

Set up two databases (or isolated clusters): production and preview/staging. Never point Vercel preview deployments at production data. Keep `DATABASE_CONNECTION_LIMIT` low at first and verify the provider's connection limit against expected Vercel function concurrency.

## 2. Create the API Vercel project

1. Import `CharithFonseka/Noora` as a Vercel project.
2. Set **Root Directory** to `apps/api` and enable **Include source files outside of the Root Directory** so the `packages/database` workspace is available.
3. Select the Express framework if Vercel does not detect it automatically. `apps/api/vercel.json` installs from the npm workspace root, generates Prisma Client, and builds the API/database packages.
4. Set production environment variables:

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Production MySQL URL, including username, password, host, port, and database |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_CONNECTION_LIMIT` | Start with `2`; adjust only after checking database connection limits |
   | `WEB_ORIGIN` | `https://pathum.gay,https://www.pathum.gay` |
   | `MFA_ENCRYPTION_KEY` | Private 32-byte key encoded as 64 hexadecimal characters |
   | `FLAT_SHIPPING_LKR` | Business-approved shipping amount in whole LKR |
   | `SESSION_TTL_DAYS` | `14` |

5. Set the API function region to Singapore (`sin1`) or the region closest to the database. Vercel recommends placing functions near their data source.
6. Deploy and note the generated `*.vercel.app` URL. Add `api.pathum.gay` under **Settings → Domains** after the first successful deployment.

## 3. Create the storefront Vercel project

1. Import the same GitHub repository again as a second Vercel project.
2. Set **Root Directory** to `apps/storefront`. Keep the Next.js framework and default Next.js build command.
3. Set these production environment variables before building:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://api.pathum.gay` |
   | `API_URL` | `https://api.pathum.gay` |

4. Deploy, then add `pathum.gay` and `www.pathum.gay` under **Settings → Domains**. Choose one as primary and redirect the other to it.

The storefront makes credentialed API requests to `api.pathum.gay`. The domains share the same site, and the API's `WEB_ORIGIN` setting limits browser access to the storefront domains.

## 4. Configure Porkbun DNS

In Porkbun, open **Domain Management → DNS** for `pathum.gay`. Add the records Vercel displays on each project's Domains page:

- `pathum.gay`: the A record Vercel shows for the storefront; Porkbun's Host field is blank for the root domain.
- `www.pathum.gay`: the CNAME Vercel shows for the storefront; Host is `www`.
- `api.pathum.gay`: the CNAME Vercel shows for the API project; Host is `api`.
- Add any Vercel ownership-verification TXT record if Vercel requests one.

Use the exact values shown in Vercel, since its recommended targets can be project-specific. Remove only conflicting web records for the same hosts. Keep email MX/TXT records and leave Porkbun's nameservers in place if Porkbun will continue to manage DNS. Vercel verifies the records and provisions HTTPS after DNS resolves.

## 5. Apply the production schema and create the first administrator

Run the checked-in migration once against the production database from the repository root, using the same production `DATABASE_URL` and `DATABASE_SSL=true` values:

```sh
npm ci
npm run db:migrate:deploy
```

Then create the first administrator with the documented `BOOTSTRAP_ADMIN_*` environment values and `npm run admin:create`. Remove the bootstrap credentials immediately afterward and enroll the administrator's authenticator at `/admin`.

## 6. Launch checks

- Confirm `/`, `https://api.pathum.gay/health`, and `https://api.pathum.gay/ready` return successfully.
- Register a customer, sign in, add an item to the bag, and place a controlled COD order.
- Confirm the session survives page refresh and sign-out clears it.
- Check stock updates, order workflow, MFA enrollment, and email/phone support contact details.
- Confirm shipping charge, catalog/images, domain redirect, backups, and privacy/returns/tax content before accepting real orders.

## Plan and operational notes

Vercel Hobby is limited to personal, non-commercial use. A live NOORA shop requires a Vercel Pro or Enterprise plan. Vercel runs the Express app as a function, so its API must not depend on a continuously running process or local persistent files. Monitor function/database connections and configure production and preview secrets separately.
