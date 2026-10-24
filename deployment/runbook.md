# Deployment runbook

## Target architecture

The store is deployed to DigitalOcean App Platform as two container services on one app hostname: the storefront at `/` and the Express API at `/api`. App Platform terminates HTTPS; the API service is not routed directly to shoppers. Each environment has its own MySQL 8.4 database and one pre-deploy job applies checked-in Prisma migrations before traffic switches to the new app version.

The checked-in specs default to the Singapore region, suitable as a starting point for a Sri Lankan customer base. Confirm database/app region availability and expected latency in the DigitalOcean account before creating paid resources.

## Staging

1. Merge the reviewed feature branches into `main` in the order in the repository README.
2. Create and push `staging` from the approved `main` commit.
3. In the DigitalOcean account, create an App Platform app from the GitHub repo and use `deployment/digitalocean/staging.yaml`, or use `doctl apps create --spec deployment/digitalocean/staging.yaml` after installing and authenticating `doctl`.
4. Confirm the spec creates a separate MySQL 8.4 database and grants the app access. The migration job must complete before storefront/API components become live.
5. Set `MFA_ENCRYPTION_KEY` as an encrypted runtime secret on the API component before creating an administrator. Generate a new 32-byte hex value for the environment; never reuse the development key.
6. Confirm `/`, `/api/products`, `/health` (inside the API component), and `/ready` health checks behave correctly. Add the agreed `FLAT_SHIPPING_LKR` value to the API environment before testing order placement.
7. Create the first administrator from the API container console by setting the four `BOOTSTRAP_ADMIN_*` values temporarily and running `node apps/api/dist/bootstrap-admin.js`. Remove those values immediately afterward. Enroll the admin’s authenticator at `/admin`.
8. Load approved categories, real product data, HTTPS product image URLs, prices and stock using the staff workspace.

`NEXT_PUBLIC_API_URL` uses `${APP_URL}`, and API CORS uses the same bindable app URL. Ingress keeps the `/api` prefix when forwarding to the API, so browser requests and the session cookie remain same-origin. When adding a custom domain, make it the app’s primary domain and verify the new value of `APP_URL` on both service components after deployment.

## Production

1. Create a production MySQL 8.4 managed cluster in a region supported by App Platform and name it `noora-production-mysql`, or change `cluster_name` in the spec to the actual cluster name. Confirm backup retention and trusted-source rules before connecting it.
2. Review `deployment/digitalocean/production.yaml`, especially the GitHub repo and `main` branch, region, service instance sizes, database plan and cluster name. The spec references the pre-existing managed cluster and creates the app database/user as `noora` / `noora_app`.
3. Add the production domain in App Platform and configure its suggested DNS records. Set it as primary so `${APP_URL}` resolves to the customer domain.
4. Set encrypted secrets/configuration on the API: `MFA_ENCRYPTION_KEY`, production database connection (bound from `noora-mysql.DATABASE_URL`), `DATABASE_SSL=true`, and the approved shipping price/rules. Keep card-gateway credentials out of the repo and out of the web service.
5. Keep guest checkout disabled until the business decision is made. Card payments are not implemented; only COD is accepted by the API.
6. Run the migration job against production, then provision the initial admin and MFA as in staging. Check health, browse approved products, place a controlled COD order, verify order/stock state and cancel it to verify stock restoration before launch.
7. Confirm production backups and restoration steps, custom domain/TLS, alert delivery, staff MFA, product images, privacy/returns/tax content, and a named operator for order fulfillment.

The production app spec targets the `main` branch and enables deploy-on-push. Keep `main` protected with reviewed pull requests. Add a required build check after the repository’s GitHub token has workflow-write permission. Do not point production at a feature branch.

## Environment values

| Variable | Where | Use |
| --- | --- | --- |
| `DATABASE_URL` | API and migration job | Bound to that environment’s MySQL database URL. |
| `DATABASE_SSL` | API and migration job | `true` for managed MySQL TLS; `false` only for local Docker MySQL. |
| `WEB_ORIGIN` | API | `${APP_URL}`; the API checks browser write origins and allows credentialed CORS. |
| `NEXT_PUBLIC_API_URL` | Storefront, build and runtime | `${APP_URL}` for same-domain `/api` requests. |
| `MFA_ENCRYPTION_KEY` | API secret | 64 hex characters used to encrypt authenticator secrets at rest. |
| `FLAT_SHIPPING_LKR` | API runtime | Non-negative whole-number LKR delivery amount. No business value is assumed in the spec. |
| `SESSION_TTL_DAYS` | API runtime | Session validity, currently 14 days by default. |
| `DATABASE_CONNECTION_LIMIT` | API runtime | Per-process MySQL connection pool size; size this with the selected plan and number of instances. |

## Rollback and database changes

App Platform can roll back the application deployment, but schema changes are not automatically reversed. Keep migrations forward-compatible where possible, back up production before destructive data migrations, and use a separate corrective migration to roll data/schema forward. Do not assume rolling back the app will roll back MySQL data.

## Current go-live gates

- No cloud resources have been provisioned by this repo change.
- Business must provide final shipping amounts/regions and approve customer-facing return, privacy, tax and fulfillment policy.
- A card processor and verified webhook secret must be selected before enabling online card payments; there is no card-payment endpoint today.
- Email delivery and password-reset flows require a chosen email provider and verified sending domain; they are not enabled.
- Real catalog data, image hosting URLs, and a custom domain are not present yet.
- Automated test coverage, MFA recovery codes and audit-event reporting still need product/security decisions before higher-risk launch scenarios.
