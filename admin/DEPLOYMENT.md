# Zana Admin Dashboard

## Merchant enquiries

The merchant registration pipeline is available at `/dashboard/merchant-registrations`.

The page uses the authenticated admin API routes:

- `GET /admin/merchant-leads` to search and filter merchant enquiries.
- `PATCH /admin/merchant-leads/:id` to update a lead's follow-up status and internal notes.

The public merchant form submits leads only; it must not create merchant accounts automatically.

## Production deployment

Changes under `admin/` trigger the `Deploy Zana admin dashboard` GitHub Actions workflow, which builds the static export and deploys the `out/` directory to the Cloudflare Pages project `zana-admin`. The production environment must have `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` configured as GitHub Actions secrets. If the Cloudflare Pages project is also connected to the repository for native Git deployments, verify that its production branch and build settings point to `main` and the `admin` app.
