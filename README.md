# Website 1st

Full-stack starter:
- Frontend: Angular (`frontend`)
- Backend: Node.js + Express (`backend`)
- Database: PostgreSQL (`docker-compose.yml`)

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
