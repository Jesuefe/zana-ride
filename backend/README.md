# Zana API

NestJS + Prisma + PostgreSQL backend for Zana Ride. Serves the customer app,
driver app, admin dashboard, and merchant portal from one API.

## What's built

- **Auth** — phone + OTP (console-logged for now; swap in Africa's Talking or
  Twilio when ready), JWT issuance
- **Users** — profile read/update, trip history
- **Drivers** — registration, online/offline, location updates, admin
  approve/reject/suspend
- **Trips** — fare estimate, ride request, nearest-driver matching, full
  status lifecycle (accept -> arrive -> start -> complete), cancel
- **Wallet** — ledger-style balance (every change is a new row, balance never
  edited directly — makes disputes/audits sane)
- **Merchant** — delivery creation and listing

All routes are versioned under `/api/v1`. Protected routes require a JWT
`Authorization: Bearer <token>` header issued from `/api/v1/auth/verify-otp`.

## Local setup

Requires Node.js 20+ and Docker (for Postgres) or a local PostgreSQL install.

```bash
npm install
cp .env.example .env
# edit .env - set DATABASE_URL, JWT_SECRET

npx prisma generate
npx prisma migrate dev --name init

npm run start:dev
```

API runs at `http://localhost:4000/api/v1`. Health check: `GET /api/v1/health`.

## Deploying to your VPS

These steps assume a fresh Ubuntu 22.04+ Contabo VPS with SSH access.

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group change to apply
```

### 2. Get the code onto the server

Simplest path: zip this folder, scp it up, unzip.

```bash
# from your local machine
scp zana-api.zip your_user@your_vps_ip:~/

# on the VPS
unzip zana-api.zip
cd zana-api
```

(Once you're comfortable with it, pushing this to a private GitHub repo and
git clone-ing on the VPS is cleaner for future updates - git pull instead
of re-zipping every time.)

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Set real values:
- `DB_PASSWORD` - a strong password, not the dev default
- `JWT_SECRET` - generate one with `openssl rand -hex 32`
- Leave `DATABASE_URL` as-is if using the bundled Docker Postgres (it's
  templated from `DB_PASSWORD` automatically in docker-compose.yml)

### 4. Start everything

```bash
docker compose up -d --build
```

This starts Postgres, Redis (ready for when you add real-time features), and
the API, in that order, with the API waiting for Postgres to be healthy first.

### 5. Run migrations against the live database

```bash
docker compose exec api npx prisma migrate deploy
```

### 6. Verify it's running

```bash
curl http://localhost:4000/api/v1/health
```

### 7. Put Nginx in front (HTTPS + real domain)

Install Nginx and Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

Point a subdomain (e.g. api.zana.rw) at your VPS's IP in your DNS provider,
then:

```nginx
# /etc/nginx/sites-available/zana-api
server {
    listen 80;
    server_name api.zana.rw;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zana-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.zana.rw
```

Certbot handles the HTTPS certificate and Nginx config update automatically.

### 8. Point the frontends at it

- **Customer/driver apps**: replace the mock data calls with real fetch
  calls to https://api.zana.rw/api/v1/...
- **Admin/merchant dashboards**: same - swap the imports from lib/mockData
  for real API calls (a small API client wrapper is the next thing worth
  building once this is live)

## Updating the deployed API after code changes

```bash
# on the VPS, inside the zana-api folder
git pull                      # or re-upload + unzip
docker compose up -d --build  # rebuilds and restarts the api container
docker compose exec api npx prisma migrate deploy   # if the schema changed
```
