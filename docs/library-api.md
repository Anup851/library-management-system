# Library API

Base URL: `/api`

## Auth

- `POST /auth/login`
  - body: `{ "email": "admin@libraryhub.local", "password": "admin123" }`
- `GET /auth/me`

## Bootstrap

- `GET /bootstrap`
  - Returns user, books, branches, users, transactions, reservations, reviews, notifications, audit logs, dashboard analytics, and recommendations.

## Books

- `GET /books?search=&category=&author=&isbn=&branchId=`
- `POST /books`
- `PUT /books/:id`
- `DELETE /books/:id`

Book payload fields:

```json
{
  "title": "The Pragmatic Programmer",
  "author": "Andrew Hunt",
  "category": "Software Engineering",
  "isbn": "9780135957059",
  "barcode": "BK-10099",
  "description": "Classic software craftsmanship title.",
  "coverImage": "https://example.com/cover.jpg",
  "ebookUrl": "https://example.com/ebook.pdf",
  "publishedYear": 2019,
  "language": "English",
  "format": "hybrid",
  "tags": ["software", "engineering"],
  "branchIds": ["branch_central"],
  "totalCopies": 4,
  "availableCopies": 4
}
```

## Users & RBAC

- `GET /users`
- `PATCH /users/:id/role`
  - body: `{ "role": "librarian", "branchId": "branch_central" }`

## Circulation

- `GET /transactions`
- `POST /transactions/issue`
  - body: `{ "userId": "...", "branchId": "...", "bookId": "...", "dueDate": "2026-05-01T00:00:00.000Z" }`
- `POST /transactions/return`
  - body: `{ "transactionId": "..." }`
  - or `{ "scanCode": "BK-10001" }`

## Reservations

- `GET /reservations`
- `POST /reservations/:bookId`
- `POST /reservations/:id/fulfill`

## Recommendations & Reviews

- `GET /recommendations`
- `GET /reviews`
- `POST /reviews`
  - body: `{ "bookId": "...", "rating": 5, "comment": "Excellent read." }`

## Notifications & Audit Logs

- `GET /notifications`
- `GET /audit-logs`

## Dashboard & Assistant

- `GET /dashboard`
- `GET /chatbot?message=recommend%20technology%20books`

## Collection Model

- `users`
- `branches`
- `books`
- `transactions`
- `reservations`
- `reviews`
- `notifications`
- `auditLogs`
