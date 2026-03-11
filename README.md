# Class Management System

This repository contains a React frontend and a Node/Express + MySQL backend for a school operations system.

## Current Production Pass

This codebase has been moved away from demo-only auth behavior:

- frontend auth now depends on the real backend API
- backend now exposes `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout`
- backend startup validates required environment variables before serving traffic
- frontend no longer uses a hardcoded hosted API fallback or a fake refresh-token flow

Some modules still use seeded/local data and should be migrated to backend-backed resources in later passes.

## Project Structure

- `frontend/` React application
- `backend/` Express API

## Run Both Apps

From the repository root, run `npm start` to open the frontend and backend in separate terminal windows.

You can also start them individually with `npm run start:frontend` and `npm run start:backend`.

## Backend Setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Create the database with `schema.sql`
5. Seed initial users with `seed.sql`
6. `npm start`

Seeded demo accounts use password `Admin1234`.

Required backend environment variables:

- `PORT`
- `NODE_ENV`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGINS`

Optional Telegram integration variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

## Frontend Setup

1. `cd frontend`
2. `npm install`
3. Set `REACT_APP_API_URL` if the backend is not available at `http://localhost:3001/api` in development or `/api` in production
4. `npm start`

Build:

```bash
cd frontend
npm run build
```

Test:

```bash
cd frontend
npm test -- --watchAll=false
```

## Available Backend Endpoints

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/students`
- `GET /api/students/:id`
- `POST /api/students`
- `GET /api/teachers`
- `POST /api/teachers`
- `PUT /api/teachers/:id`
- `GET /api/messages`
- `POST /api/messages`
- attendance and Telegram routes under `/api/attendance` and `/api/telegram`
