# Simian Order — Backend API

Node.js + Express + PostgreSQL. Stateless API for users, FCFS allocation, task verification, applications, referrals, and mint eligibility.

## Setup

```bash
cd server
cp .env.example .env
# (option A) start postgres with docker
docker compose up -d
# (option B) point DATABASE_URL at any other postgres

npm install
npm run migrate
npm run dev
```

Server defaults to `http://localhost:4000`.

## Env

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | |
| `DATABASE_URL` | — | Required. Standard `postgres://` URL. |
| `FCFS_TOTAL_SPOTS` | `50` | Applied on `npm run migrate`. |
| `REFERRAL_LIMIT` | `5` | Per-user invite cap. |
| `ADMIN_KEY` | (unset) | If set, `approve`/`reject` require `X-Admin-Key` header. |
| `CORS_ORIGIN` | `*` | e.g. `http://localhost:3000`. |

## Endpoints

All routes are prefixed with `/api`. JSON in, JSON out. Errors: `{ error: string, details?: any }`.

### Users
- `POST /users` — `{ wallet, twitter_id?, discord_id? }` → upserts user.
- `GET /users/:wallet` → user record.
- `PATCH /users/:wallet` — `{ twitter_id?, discord_id? }` → patch fields.

### FCFS
- `GET /fcfs/status` → `{ total, taken, remaining }`.
- `POST /fcfs/claim` — `{ wallet }` → atomic claim. Errors: `409 already_allocated`, `409 fcfs_full`, `404 user_not_found`.

### Tasks
- `POST /tasks/verify` — `{ wallet, task, payload? }`. `task` ∈ `follow_twitter | retweet | join_discord | tag_friends | submit_wallet`. Mock verifier; on success records completion (idempotent per task per wallet).
- `GET /tasks/:wallet` → list of completed tasks.

### Applications
- `POST /applications` — `{ wallet, handle, discord?, why, referrer_input? }` → creates application, sets `users.application_status = 'pending'`.
- `GET /applications/:wallet` → status + history.
- `POST /applications/:wallet/approve` (admin) → marks pending app `approved`.
- `POST /applications/:wallet/reject` (admin) → marks pending app `rejected`.

### Referrals
- `POST /referrals/code` — `{ wallet }` → `{ code }` (idempotent: returns existing code if any).
- `POST /referrals/redeem` — `{ wallet, code }` → sets `users.referrer`. Enforces 5-cap per referrer, no self-referral, no double-redeem.
- `GET /referrals/:wallet` → `{ code, count, limit, referred[] }`.

### Eligibility
- `GET /eligibility/:wallet` → `{ canMint, fcfs_allocated, application_status, reasons[] }`.

`canMint` = `fcfs_allocated || application_status === 'approved'`.

### Health
- `GET /health` → `{ ok: true }`.

## Race-safety notes

- **FCFS claim** uses a single-row `fcfs_state` counter and `UPDATE ... WHERE spots_taken < total_spots` to atomically reserve a slot inside a transaction with `SELECT ... FOR UPDATE` on the user row. Over-allocation is impossible.
- **Referral redeem** locks both the redeemer row and the referrer row, then re-counts inside the txn before writing.
- **Referral code generation** retries on unique-violation race up to 6 attempts.

## Schema

See `src/db/schema.sql`. Re-runnable; uses `IF NOT EXISTS` everywhere. `npm run migrate` also seeds `fcfs_state`.

## Quick smoke test

```bash
WALLET=0x0000000000000000000000000000000000000001

curl -X POST localhost:4000/api/users -H 'content-type: application/json' \
  -d "{\"wallet\":\"$WALLET\"}"

curl -X POST localhost:4000/api/applications -H 'content-type: application/json' \
  -d "{\"wallet\":\"$WALLET\",\"handle\":\"@me\",\"why\":\"i belong\"}"

curl -X POST localhost:4000/api/applications/$WALLET/approve

curl localhost:4000/api/eligibility/$WALLET
```
