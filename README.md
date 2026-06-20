# 💳 Transaction Ledger & Balance Management System

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)

A full-stack financial transaction system built with Node.js, PostgreSQL, and React. Handles atomic money transfers, double-entry bookkeeping, idempotency, and automated reconciliation — the core concepts behind real fintech infrastructure.

---

## 📑 Table of Contents

- [Live Demo](#-live-demo)
- [Screenshots](#-screenshots)
- [The Problem It Solves](#-the-problem-it-solves)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Key Technical Decisions](#-key-technical-decisions)
- [Reconciliation](#-reconciliation)
- [Integration Tests](#-integration-tests)
- [Load Test Results](#-load-test-results)
- [Local Setup](#-local-setup)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Known Limitations](#️-known-limitations)
- [What I Learned Building This](#-what-i-learned-building-this)

---

## 🌐 Live Demo

| Service | Link |
|---|---|
| **Frontend** | [Live App](https://transactional-ledger-system.vercel.app) |
| **Backend API** | [API Endpoint](https://strong-essence-production-0575.up.railway.app) |
| **Health Check** | [Health Status](https://strong-essence-production-0575.up.railway.app/health) |

---

## 📸 Screenshots

**Register Page**  
<img width="761" height="680" alt="Register Page" src="https://github.com/user-attachments/assets/b7c79728-19c8-4aec-9273-a69099ab2e25" />

**Dashboard**  
<img width="1280" height="837" alt="Dashboard" src="https://github.com/user-attachments/assets/43763b1f-ad56-40a8-9549-40ee44acd9d3" />

**Transaction History**  
<img width="1280" height="577" alt="Transaction History" src="https://github.com/user-attachments/assets/4221fe79-9815-42bf-a70a-da59a503c3db" />

**Ledger History**  
<img width="1280" height="838" alt="Ledger History" src="https://github.com/user-attachments/assets/26892918-9078-49b1-b2df-de1ed5b2fc2f" />

---

## 🎯 The Problem It Solves

In any system that moves money, three things must be guaranteed:

1. **You cannot lose money:** If a transfer deducts from the sender but crashes before crediting the receiver, money disappears. *Solved with database transactions — all balance updates are atomic or none happen.*
2. **You cannot duplicate money:** If a user clicks Send twice or the network retries a request, the same transfer cannot process twice. *Solved with idempotency keys stored as a `UNIQUE` constraint in PostgreSQL.*
3. **You cannot corrupt balances:** If two transfers hit the same account at the same millisecond, both might read the same balance and overdraft. *Solved with `SELECT FOR UPDATE` — rows are locked before reading so concurrent transfers queue safely.*

---

## ✨ Features

### Phase 1 — Core System

- JWT authentication (register, login, protected routes)
- Auto-create default account on registration
- Deposit money into accounts
- Atomic money transfers using `db.transaction()`
- Paginated transaction history
- Consistent error responses with machine-readable error codes
- Input validation with Zod on every endpoint
- Global error handler mapping error codes to HTTP status codes

### Phase 2 — Production Grade

- **`SELECT FOR UPDATE`** with deadlock-safe row ordering (`ORDER BY id`)
- **Idempotency keys** in PostgreSQL — duplicate requests replay original response without reprocessing
- **Double‑entry ledger** — every transfer creates `DEBIT` + `CREDIT` entries with `balance_after` snapshots
- **Reconciliation engine** — 3 SQL integrity checks verify no money was created or destroyed
- **Integration tests** — 3 critical tests covering atomic transfer, rollback, and idempotency using Jest
- **Helmet** — 11 HTTP security headers in one line
- **Rate limiting** — 20 auth requests / 100 general requests per 15 minutes per IP
- **Load tested** — 20 concurrent transfers verified correct under concurrency

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server and REST API |
| PostgreSQL | ACID-compliant database for financial data |
| Knex.js | SQL query builder + migration management |
| bcryptjs | Password hashing with 10 salt rounds |
| jsonwebtoken | JWT signing and verification |
| Zod | Runtime request body schema validation |
| Helmet | 11 HTTP security headers |
| express-rate-limit | Brute force and DDoS protection |
| Jest + Supertest | Integration testing |

### Frontend

| Technology | Purpose |
|---|---|
| React + Vite | Component-based UI with fast dev server |
| React Router | Client-side page navigation |
| Tailwind CSS | Utility-first styling |
| Context API | Global auth state management |

### Deployment

| Service | What runs there |
|---|---|
| Railway | Node.js backend + managed PostgreSQL |
| Vercel | React frontend (static build) |

---

## 🗄 Database Schema

### `users`

| Column        | Type                    | Description                |
|---------------|-------------------------|----------------------------|
| `id`          | UUID (PK)               | Primary key                |
| `email`       | VARCHAR (unique)        | User email                 |
| `password_hash`| VARCHAR                | Hashed password            |
| `role`        | ENUM (`USER`, `ADMIN`)  | User role                  |
| `created_at`  | TIMESTAMP               | Creation timestamp         |

### `accounts`

| Column        | Type                    | Description                        |
|---------------|-------------------------|------------------------------------|
| `id`          | UUID (PK)               | Primary key                        |
| `user_id`     | UUID → `users.id`       | Owner of the account               |
| `name`        | VARCHAR                 | Account name (e.g., "Savings")     |
| `balance`     | NUMERIC(20,8)           | Current balance (exact decimal)    |
| `currency`    | VARCHAR (default `INR`) | Currency code                      |
| `status`      | ENUM (`ACTIVE`, `SUSPENDED`, `CLOSED`) | Account status   |
| `created_at`  | TIMESTAMP               | Creation timestamp                 |

### `transactions`

| Column              | Type                           | Description                              |
|---------------------|--------------------------------|------------------------------------------|
| `id`                | UUID (PK)                      | Primary key                              |
| `idempotency_key`   | VARCHAR (unique)               | Client-generated idempotency key         |
| `from_account_id`   | UUID (nullable)                | Source account (null for deposits)       |
| `to_account_id`     | UUID                           | Destination account                      |
| `amount`            | NUMERIC(20,8)                  | Transfer amount                          |
| `type`              | ENUM (`TRANSFER`, `DEPOSIT`, `WITHDRAWAL`) | Transaction type      |
| `status`            | ENUM (`PENDING`, `COMPLETED`, `FAILED`) | Transaction status          |
| `note`              | VARCHAR (nullable)             | Optional note                            |
| `created_at`        | TIMESTAMP                      | Creation timestamp                       |

### `ledger_entries`

| Column            | Type                           | Description                                      |
|-------------------|--------------------------------|--------------------------------------------------|
| `id`              | UUID (PK)                      | Primary key                                      |
| `transaction_id`  | UUID → `transactions.id`       | Associated transaction                          |
| `account_id`      | UUID → `accounts.id`           | Account affected                                 |
| `entry_type`      | ENUM (`DEBIT`, `CREDIT`)       | Debit or credit                                  |
| `amount`          | NUMERIC(20,8)                  | Amount of the entry                              |
| `balance_after`   | NUMERIC(20,8)                  | Account balance after this entry (snapshot)      |
| `created_at`      | TIMESTAMP                      | Creation timestamp                               |

---

## 📡 API Reference

All protected endpoints require:

```
Authorization: Bearer <token_received_from_login_or_register>
```

All error responses follow this shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "You do not have enough balance for this transfer"
  }
}
```

### Auth Endpoints

| Method | Endpoint                 | Auth | Description                              |
|--------|--------------------------|------|------------------------------------------|
| POST   | `/api/v1/auth/register`  | No   | Register user + auto-create account, returns JWT |
| POST   | `/api/v1/auth/login`     | No   | Login and receive JWT token              |

### Account Endpoints

| Method | Endpoint                  | Auth | Description                               |
|--------|---------------------------|------|-------------------------------------------|
| GET    | `/api/v1/accounts`        | Yes  | Get all accounts for logged in user       |
| GET    | `/api/v1/accounts/:id`    | Yes  | Get single account by ID                  |
| POST   | `/api/v1/accounts`        | Yes  | Create a new account                      |

### Transaction Endpoints

| Method | Endpoint                                 | Auth | Description                                           |
|--------|------------------------------------------|------|-------------------------------------------------------|
| POST   | `/api/v1/transactions/transfer`          | Yes  | Atomic transfer between accounts (idempotent)         |
| POST   | `/api/v1/transactions/deposit`           | Yes  | Deposit into account (idempotent)                     |
| GET    | `/api/v1/transactions`                   | Yes  | Paginated transaction history                         |
| GET    | `/api/v1/transactions/accounts/:id/history` | Yes  | Ledger entries with balance snapshots              |

### Reconciliation Endpoints

| Method | Endpoint                     | Auth | Description                                 |
|--------|------------------------------|------|---------------------------------------------|
| GET    | `/api/v1/reconciliation/run` | Yes  | Run 3 integrity checks, return full report  |

#### Example: Transfer Request

```http
POST /api/v1/transactions/transfer
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "fromAccountId": "660e8400-e29b-41d4-a716-446655440001",
  "toAccountId":   "770e8400-e29b-41d4-a716-446655440002",
  "amount": "500.00",
  "note": "Splitting rent"
}
```

**Success Response — 201:**

```json
{
  "data": {
    "transaction": {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "from_account_id": "660e8400-e29b-41d4-a716-446655440001",
      "to_account_id":   "770e8400-e29b-41d4-a716-446655440002",
      "amount": "500.00000000",
      "type": "TRANSFER",
      "status": "COMPLETED",
      "note": "Splitting rent"
    },
    "newBalance": "500.00000000",
    "replayed": false
  }
}
```

**Error Response — 402:**

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "You do not have enough balance for this transfer"
  }
}
```

---

## 🔑 Key Technical Decisions

### Why `NUMERIC(20,8)` and not `FLOAT`?

IEEE 754 floating point cannot represent `0.1` exactly in binary. `0.1 + 0.2` in JavaScript gives `0.30000000004`. Over thousands of transactions, this error compounds into real money loss. `NUMERIC(20,8)` stores exact decimal values — this is what every real bank uses.

### Why `SELECT FOR UPDATE`?

Without locking, two concurrent transfers can both read the same balance simultaneously and both think there is enough money — causing an overdraft.

```sql
SELECT * FROM accounts
WHERE id IN (?, ?)
ORDER BY id        -- always lock in same order to prevent deadlock
FOR UPDATE         -- lock rows until transaction commits
```

`ORDER BY id` is critical. If Transfer A locks account 1 then waits for account 2, while Transfer B locks account 2 then waits for account 1, both wait forever — a deadlock. Sorting by ID means both transfers always try to lock the lower UUID first, so one waits safely behind the other.

### Why idempotency keys in PostgreSQL (not Redis)?

A user's network can drop after the server processes a transfer but before the client receives the response. The client retries — without idempotency, money is sent twice.

We store a client-generated UUID as a `UNIQUE` column on transactions. On retry, we find the existing transaction and return it immediately. The `UNIQUE` constraint in PostgreSQL is the final safety net — even if application code has a bug, the database rejects duplicates. No Redis needed. Pure PostgreSQL. Simple and reliable.

### Why double‑entry bookkeeping?

Every transfer creates two ledger entries:
- `DEBIT` for the sender — money left their account
- `CREDIT` for the receiver — money arrived in their account

The `balance_after` column stores a snapshot of the exact balance at that moment in time. This makes reconciliation possible and provides a complete, immutable audit trail. This is how every real bank records transactions.

---

## 🔍 Reconciliation

The reconciliation service runs 3 SQL integrity checks simultaneously:

1. **Balance vs ledger sum**: For every account, sum all `CREDIT` entries and subtract all `DEBIT` entries. Compare to the stored `balance` column. Any difference greater than `0.000001` means money appeared or disappeared without a record.
2. **Debits equal credits per transaction**: For every `TRANSFER` transaction, total debits must equal total credits. If not, the double‑entry bookkeeping is broken.
3. **Stuck PENDING transactions**: Any transaction stuck in `PENDING` status older than 5 minutes means a transfer started but never completed — usually from a server crash mid-transfer.

A healthy system returns zero results from all three checks.

---

## 🧪 Integration Tests

3 critical tests written with Jest covering the core financial logic. Isolated local Docker environments process the full suite in under 1 second.

```
 PASS  src/tests/transactions.test.js
  Transfer Logic
    ✓ successfully moves money and creates ledger entries
    ✓ fails with INSUFFICIENT_FUNDS when balance too low
    ✓ duplicate idempotency key replays original response without double charging

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

<img width="1020" height="661" alt="image" src="https://github.com/user-attachments/assets/fed3f327-9607-43bb-8525-d112c5aaae2e" />


- **Test A — Successful transfer**: Verifies money moves atomically, sender balance decreases, receiver balance increases, and exactly 2 ledger entries (`DEBIT` + `CREDIT`) are created with correct `balance_after` snapshots.
- **Test B — Insufficient funds rollback**: Proves that when a transfer fails, the entire `db.transaction()` rolls back — both balances remain completely unchanged. No partial updates. No transaction record created.
- **Test C — Idempotency deduplication**: Sends the same `Idempotency-Key` twice, asserts both calls return the same transaction ID, money is only deducted once, and only one row exists in the `transactions` table.

Run tests:

```bash
npm test
```

---

## ⚡ Load Test Results

20 concurrent transfers fired simultaneously from one account. `SELECT FOR UPDATE` ensures all transfers serialize correctly in the database engine. Zero money created or destroyed across all 20 transfers.

```
Testing SELECT FOR UPDATE concurrency safety

Registered anish. Account ID: 726129c4-668a-4209-b964-f42a1428a407
Registered rahul. Account ID: 206ac072-f4c5-4c8f-80d8-a278db0a580f
Deposited 10000 into anish account

Firing 20 concurrent transfers of 100 rupees each...

=== RESULTS ===
Duration:           54ms
Successful:         20 / 20
Failed:             0 / 20

=== BALANCE VERIFICATION ===
Anish final balance:  8000
Rahul final balance:  2000
Total money in system: 10000

=== ASSERTIONS ===
PASS - Total money conserved: 10000 === 10000
PASS - Anish balance correct: 8000
PASS - Rahul balance correct: 2000
PASS - No negative balances

=== RECONCILIATION CHECK ===
PASS - Reconciliation passed. Ledger is balanced.

=== LOAD TEST COMPLETE ===
```

<img width="518" height="352" alt="image" src="https://github.com/user-attachments/assets/9247564f-7b4b-4a3a-b4b2-b6f8370776f8" />


Run load test locally:

```bash
node loadtest.js
```

---

## 🚀 Local Setup

### Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL, optional)
- PostgreSQL (if running locally)

### Backend

1. **Clone the repo & install dependencies**

   ```bash
   git clone https://github.com/Anish033-coder/Transactional-Lader-System.git
   cd Transactional-Lader-System/backend
   npm install
   ```

2. **Boot up Local Docker Database**

   Start an isolated PostgreSQL container for lightning-fast testing:

   ```bash
   docker run --name ledger-test-db -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=ledger_test -p 5432:5432 -d postgres
   ```

3. **Configure Environment**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in your local DB credentials:

   ```
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=secret
   DB_NAME=ledger_test
   PORT=3001
   JWT_SECRET=any-long-random-string-here
   NODE_ENV=development
   ```

4. **Run migrations & start server**

   ```bash
   npx knex migrate:latest
   npm run dev
   ```

   Server runs at http://localhost:3001  
   Health check: http://localhost:3001/health

5. **Run Tests**

   ```bash
   npm test
   node loadtest.js
   ```

### Frontend

1. **Navigate and install dependencies**

   ```bash
   cd ../frontend
   npm install
   ```

2. **Configure Environment & Start**

   ```bash
   echo "VITE_API_URL=http://localhost:3001/api/v1" > .env
   npm run dev
   ```

   Frontend runs at http://localhost:5173

---

## 📁 Project Structure

```
Transactional-Lader-System/
├── README.md
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_create_users.js
│   │   │   │   ├── 002_create_accounts.js
│   │   │   │   ├── 003_create_transactions.js
│   │   │   │   ├── 004_add_idempotency_key.js
│   │   │   │   └── 005_create_ledger_entries.js
│   │   │   └── db.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── accounts.js
│   │   │   ├── transactions.js
│   │   │   └── reconciliation.js
│   │   ├── services/
│   │   │   ├── AuthService.js
│   │   │   ├── TransactionService.js
│   │   │   └── ReconciliationService.js
│   │   ├── tests/
│   │   │   ├── setup.js
│   │   │   └── transactions.test.js
│   │   └── index.js
│   ├── loadtest.js
│   ├── knexfile.js
│   ├── jest.config.js
│   ├── package.json
│   ├── .env
│   ├── .env.test
│   ├── .env.example
│   └── .gitignore
└── frontend/
    ├── public/
    │   └── vite.svg
    ├── src/
    │   ├── lib/
    │   │   └── api.js
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   ├── BalanceCard.jsx
    │   │   ├── TransferModal.jsx
    │   │   └── TransactionTable.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Transactions.jsx
    │   │   └── History.jsx
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── .env
    └── .gitignore
```

---

## 🚢 Deployment

**Backend** deployed on Railway with managed PostgreSQL.  
Start command runs migrations automatically on every deploy:

```bash
npx knex migrate:latest && node src/index.js
```

**Frontend** deployed on Vercel with `VITE_API_URL` pointing to Railway backend.

Both platforms auto-deploy on every push to the main branch. Zero manual steps after initial setup.

---

## ⚠️ Known Limitations

These are intentional tradeoffs, not bugs:


- **In‑memory rate limiter** — Resets on server restart. Multi‑instance deployments need a Redis store.
- **No refresh token** — Users must log in again after 7 days.
- **JWT in localStorage** — XSS risk. Production systems should use HTTP‑only cookies.

---

## 📚 What I Learned Building This

- How PostgreSQL database transactions work and why atomicity matters for financial systems.
- The difference between `FLOAT` and `NUMERIC` and why it is critical for money storage.
- How `SELECT FOR UPDATE` prevents race conditions in concurrent database writes.
- How deadlocks occur and why ordering lock acquisition by ID prevents them.
- How idempotency keys prevent duplicate charges under network retry scenarios.
- How double‑entry bookkeeping creates a complete immutable audit trail.
- How to write integration tests for financial logic using Jest.
- How to structure a Node.js backend with clean separation of concerns.
- How to deploy a backend with a managed database using Railway auto‑migrations.
- How to build and deploy a React frontend with Vite and Tailwind on Vercel.

---

## 👤 Author

**Anish Kumawat**  
2nd Year CSE — IIIT Lucknow

---

## 📄 License

MIT — free to use and modify.
