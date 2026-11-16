# Zana Partner API — foundation

The first slice establishes partner identity, hashed API credentials, scope enforcement,
and read-only wallet/ledger visibility. It deliberately does not create deliveries or
charge partners yet: delivery dispatch must be wired to an atomic wallet reservation
and the existing delivery service in the next slice.

## Authentication

Send `Authorization: Bearer zana_live_<secret>` (or `zana_test_<secret>` for
sandbox). Only the SHA-256 hash is stored. Secrets must be provisioned through a
trusted admin workflow and displayed once; never log or commit plaintext secrets.

## Endpoints

All endpoints are under the existing global prefix `/api/v1`.

- `GET /partner/account` — requires `account:read`
- `GET /partner/wallet` — requires `wallet:read`
- `GET /partner/wallet/transactions?limit=25` — requires `wallet:read`

## Wallet safety contract

Amounts are integer RWF. `available` is spendable cash; `reserved` is funds held
against accepted delivery requests; `creditLimit` is separately approved credit.
Wallet transactions are append-only and uniquely referenced. A future delivery
creation transaction must reserve funds atomically before dispatch and must not
reuse the consumer/merchant wallet debit path or double-charge the partner.

## Next implementation slice

1. Admin-only partner and credential provisioning (one-time secret display).
2. Atomic reserve, settle, release and credit-exposure operations with idempotency.
3. Quote/create delivery endpoints mapped to the existing Delivery model and dispatch
   engine; reject dispatch unless a reservation or approved credit is secured.
4. Signed webhooks, tracking authorization, REST/OpenAPI contract and integration tests.

## Provisioning note

No public credential-creation endpoint is exposed in this foundation. Partner records,
wallets and hashed credentials must be created only through a privileged admin workflow.
