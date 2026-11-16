# Zana Partner API — foundation

This foundation establishes partner identity, hashed API credentials, scope enforcement,
wallet visibility, and prepaid wallet reservation/settlement/release. Delivery creation
and driver dispatch are not exposed yet; those must be connected to the existing delivery
engine in a later slice.

## Authentication

Send `Authorization: Bearer zana_live_<secret>` (or `zana_test_<secret>` for
sandbox). Only the SHA-256 hash is stored. Secrets must be provisioned through a
trusted admin workflow and displayed once; never log or commit plaintext secrets.

## Endpoints

All endpoints are under the existing global prefix `/api/v1`.

- `GET /partner/account` — requires `account:read`
- `GET /partner/wallet` — requires `wallet:read`
- `GET /partner/wallet/transactions?limit=25` — requires `wallet:read`
- `POST /partner/wallet/topups` — JSON `{ "reference": "invoice-2026-001", "phone": "+2507XXXXXXXX", "amount": 50000 }`, requires `wallet:topup`
- `GET /partner/wallet/topups/{reference}/status` — requires `wallet:read`
- `POST /partner/wallet/reservations` — JSON `{ "reference": "restaurant-order-123", "amount": 2500 }`, requires `wallet:reserve`
- `POST /partner/wallet/reservations/{reference}/settle` — requires `wallet:settle`
- `POST /partner/wallet/reservations/{reference}/release` — optional JSON `{ "reason": "Order cancelled before pickup" }`, requires `wallet:release`

## Wallet safety contract

Amounts are integer RWF. `available` is spendable cash; `reserved` is funds held
against an accepted delivery request. Partner API billing is prepaid-only: credit is
not used to authorize a reservation. A reservation atomically moves funds from
`available` to `reserved`; settlement consumes the reserved amount; release returns
unused reserved funds to `available`. All amounts are positive integer RWF. References
are partner-owned, unique per operation, and replay-safe. Ledger rows are append-only.
Settlement and release remain available when a wallet is suspended so already-held
funds can be resolved.

## Next implementation slice

1. Admin-only partner and credential provisioning (one-time secret display).
2. Admin-only wallet funding through verified Paypack payment confirmations; never trust a client-supplied 'paid' flag.
3. Quote/create delivery endpoints mapped to the existing Delivery model and dispatch
   engine; reject dispatch unless a prepaid reservation is secured.
4. Signed webhooks, tracking authorization, REST/OpenAPI contract and integration tests.

## Provisioning note

No public credential-creation endpoint is exposed in this foundation. Partner records,
wallets and hashed credentials must be created only through a privileged admin workflow.
