# Zana Food Delivery Partner API

External restaurant and food-ordering platforms keep their own customer apps and checkout. They call Zana only when they need a courier. All amounts are integer RWF.

## Authentication
Send the partner's secret key in `X-Zana-API-Key`. Keys are shown once when an administrator creates a partner; Zana stores only a SHA-256 hash. Never place the key in browser code or mobile apps. Call this API from the partner's server.

Base path: `/api/v1`

## Endpoints
- `POST /food-partners/quote` — quote a motorcycle food delivery.
- `POST /food-partners/deliveries` — create and pay for a delivery from prepaid balance.
- `GET /food-partners/deliveries/:id` — retrieve status and tracking information.
- `POST /food-partners/deliveries/:id/cancel` — cancel only while still REQUESTED and not assigned; fee is refunded.
- `GET /food-partners/wallet` — current prepaid balance.
- `GET /food-partners/wallet/transactions` — latest 100 wallet ledger entries.

## Quote request
```json
{
  "pickupLat": -1.9441,
  "pickupLng": 30.0619,
  "dropoffLat": -1.9536,
  "dropoffLng": 30.0606
}
```

## Create delivery request
```json
{
  "partnerOrderRef": "ORDER-100045",
  "itemDescription": "Restaurant order",
  "pickupAddress": "Restaurant, Kigali",
  "pickupLat": -1.9441,
  "pickupLng": 30.0619,
  "dropoffAddress": "Customer address, Kigali",
  "dropoffLat": -1.9536,
  "dropoffLng": 30.0606,
  "receiverName": "Customer",
  "receiverPhone": "+2507XXXXXXXX"
}
```

The delivery fee is recalculated by Zana on the server; a partner cannot submit its own price. The wallet debit, delivery creation and ledger entry happen in one database transaction. Insufficient balance blocks dispatch. Repeating the same `partnerOrderRef` returns the original delivery without charging twice. Created jobs enter the existing Zana driver delivery pool as prepaid, confirmed deliveries.

## Administrator operations
JWT-authenticated ADMIN endpoints:
- `POST /admin/food-delivery-partners` — create partner; raw API key is returned once.
- `GET /admin/food-delivery-partners` — list partners.
- `POST /admin/food-delivery-partners/:id/top-ups` — credit prepaid RWF balance.
- `POST /admin/food-delivery-partners/:id/rotate-key` — rotate and return a new key once.
- `PATCH /admin/food-delivery-partners/:id/status` — set ACTIVE or SUSPENDED.

Partner wallet top-ups in this first version are credited by an authorized Zana administrator after the payment is reconciled. Automated Paypack/Eversend top-up webhooks and outbound delivery-status webhooks are a separate integration phase; partners can poll the authenticated status endpoint meanwhile.
