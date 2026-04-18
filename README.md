# Website 1st

Full-stack starter:
- Frontend: Angular (`frontend`)
- Backend: Node.js + Express (`backend`)
- Database: PostgreSQL (`docker-compose.yml`)

## Harness Commands (No Skill Index Required)

In this project root, run:

```bash
npm run harness:help
```

Run a specific workflow command:

```bash
npm run generator -- "Implement login API for users"
npm run evaluator -- "Audit story US-001"
npm run verify-thorough -- "Verify backend auth flow"
```

These commands read from `.claude/commands/*.md` and render the template locally.

## Use PostgreSQL Without Docker

If you want native PostgreSQL:
1. Install PostgreSQL on Windows (include command-line tools).
2. Make sure service is running and port is `5432`.
3. Update [backend/.env](/D:/Project/Website%201st/backend/.env) with your local username/password.
4. Run:

```bash
cd backend
npm run db:init
```

This will create database `website1st` and table `users`.

## 1) Start PostgreSQL

```bash
docker compose up -d
```

## 2) Start backend API

```bash
cd backend
npm run dev
```

Backend endpoints:
- `GET http://localhost:4000/api/health`
- `GET http://localhost:4000/api/db-check`

## 3) Start frontend

```bash
cd frontend
npm start
```

Frontend:
- `http://localhost:4200`
