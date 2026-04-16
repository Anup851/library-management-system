# Library Management System

Modern full-stack library management platform built with React, Tailwind CSS, Express, and a Supabase-backed persistence layer with seeded demo data.

## Features

- JWT authentication with `admin`, `librarian`, and `student` roles
- Book catalog management with category, ISBN, barcode, digital links, and branch inventory
- Issue and return workflows with due dates, overdue detection, and automatic fine calculation
- Reservation queue with availability notifications
- Review and rating system
- Recommendation engine based on borrowing history and ratings
- Digital library support through eBook / PDF links
- Dashboard analytics for popular books, active users, overdue items, and fine revenue
- Audit trail and notification center
- Responsive UI with dark and light modes

## Tech Stack

- Frontend: React + Tailwind CSS + React Query + Wouter
- Backend: Node.js + Express + TypeScript
- Auth: JWT + bcryptjs
- Database: Supabase Postgres via `@supabase/supabase-js`
- Dev fallback: seeded JSON store at `server/data/library-db.json`

## Project Structure

```text
client/
  src/
    App.tsx
    components/
    hooks/
server/
  auth.ts
  index.ts
  routes.ts
  store.ts
shared/
  schema.ts
docs/
  library-api.md
```


## Run Locally

1. Install dependencies:
   `npm install`
2. Start development server:
   `npm run dev`
3. Build for production:
   `npm run build`

## Sample Data

Seed data is created automatically on first run and includes:

- 3 users across all core roles
- 2 library branches
- 4 books with mixed physical and digital formats
- active and overdue transactions
- reservation queue
- reviews, notifications, and audit logs

## Notes

- Barcode / QR support is implemented as scan-code input against `barcode` or `isbn`.
- Notification delivery is modeled through in-app records plus email/SMS channel metadata.
- The assistant is a lightweight catalog-aware helper and can be replaced with a real LLM provider later.
