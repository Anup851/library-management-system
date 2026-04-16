import type { Express, Response } from "express";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  chatbotSchema,
  createBookSchema,
  createReviewSchema,
  issueBookSchema,
  loginSchema,
  updateBookSchema,
  updateUserRoleSchema,
  type AuditLog,
  type Book,
  type DashboardData,
  type Notification,
  type Reservation,
  type Review,
  type Role,
  type Transaction,
  type User,
} from "@shared/schema";
import { requireAuth, requireRole, signToken, type AuthenticatedRequest } from "./auth";
import { isStaff, publicUser, readState, writeState } from "./store";

const DAILY_FINE = Number(process.env.DAILY_FINE || 5);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["student"]).default("student"),
});

let authClient: SupabaseClient | null = null;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return randomUUID();
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown) {
  return schema.parse(body);
}

function daysLate(dueDate: string) {
  const diff = Date.now() - new Date(dueDate).getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function computeFine(dueDate: string) {
  return daysLate(dueDate) * DAILY_FINE;
}

function updateTransactionStatuses(transactions: Transaction[]): Transaction[] {
  return transactions.map((transaction) => {
    if (transaction.status === "RETURNED") return transaction;
    const fineAmount = computeFine(transaction.dueDate);
    return {
      ...transaction,
      fineAmount,
      status: fineAmount > 0 ? "OVERDUE" : "ISSUED",
    } satisfies Transaction;
  });
}

function getDashboardData(books: Book[], users: User[], transactions: Transaction[], reservations: Reservation[]): DashboardData {
  const activeTransactions = transactions.filter((transaction) => transaction.status !== "RETURNED");
  const overdueItems = activeTransactions.filter((transaction) => transaction.status === "OVERDUE");
  const borrowCounts = new Map<string, number>();
  const activeUsers = new Map<string, number>();

  for (const transaction of transactions) {
    borrowCounts.set(transaction.bookId, (borrowCounts.get(transaction.bookId) || 0) + 1);
    activeUsers.set(transaction.userId, (activeUsers.get(transaction.userId) || 0) + 1);
  }

  return {
    totals: {
      books: books.length,
      users: users.length,
      activeLoans: activeTransactions.length,
      overdueBooks: overdueItems.length,
      reservations: reservations.filter((reservation) => reservation.status === "WAITING" || reservation.status === "READY").length,
      digitalTitles: books.filter((book) => book.format !== "physical").length,
      fineRevenue: transactions.reduce((sum, transaction) => sum + transaction.fineAmount, 0),
    },
    mostBorrowedBooks: [...borrowCounts.entries()]
      .map(([bookId, borrowCount]) => ({
        bookId,
        title: books.find((book) => book._id === bookId)?.title || "Unknown title",
        borrowCount,
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 5),
    activeUsers: [...activeUsers.entries()]
      .map(([userId, borrowCount]) => ({
        userId,
        name: users.find((user) => user._id === userId)?.name || "Unknown user",
        borrowCount,
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 5),
    overdueItems,
  };
}

function recommendBooks(currentUser: User, books: Book[]) {
  const historyCategories = new Map<string, number>();
  for (const bookId of currentUser.borrowingHistory) {
    const matchedBook = books.find((book) => book._id === bookId);
    if (matchedBook) {
      historyCategories.set(matchedBook.category, (historyCategories.get(matchedBook.category) || 0) + 1);
    }
  }

  return [...books]
    .sort((a, b) => {
      const aScore = (historyCategories.get(a.category) || 0) * 2 + a.ratingAverage;
      const bScore = (historyCategories.get(b.category) || 0) * 2 + b.ratingAverage;
      return bScore - aScore;
    })
    .slice(0, 4);
}

function buildChatResponse(message: string, books: Book[], recommendations: Book[]) {
  const normalized = message.toLowerCase();
  if (normalized.includes("overdue")) {
    return {
      reply: "Overdue titles are shown on the dashboard. Librarians can also scan a barcode from the circulation panel to process returns and clear fines.",
      suggestedBooks: recommendations,
    };
  }

  if (normalized.includes("recommend") || normalized.includes("suggest")) {
    return {
      reply: "I looked at borrowing patterns and current ratings to suggest books you are most likely to enjoy next.",
      suggestedBooks: recommendations,
    };
  }

  const matchingBooks = books.filter((book) => {
    const haystack = `${book.title} ${book.author} ${book.category} ${book.isbn}`.toLowerCase();
    return haystack.includes(normalized);
  });

  if (matchingBooks.length > 0) {
    return {
      reply: `I found ${matchingBooks.length} matching title${matchingBooks.length > 1 ? "s" : ""}. You can open the catalog, reserve a title, or use the barcode value for circulation.`,
      suggestedBooks: matchingBooks.slice(0, 4),
    };
  }

  return {
    reply: "Try asking for a title, author, category, or recommendation. I can also help you find overdue items, digital books, and available copies.",
    suggestedBooks: recommendations,
  };
}

function writeAudit(logs: AuditLog[], actorId: string, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  logs.unshift({
    _id: makeId("log"),
    actorId,
    action,
    entity,
    entityId,
    details,
    createdAt: nowIso(),
  });
}

function notify(notifications: Notification[], userId: string, title: string, message: string, channel: Notification["channel"] = "in_app") {
  notifications.unshift({
    _id: makeId("notification"),
    userId,
    title,
    message,
    channel,
    read: false,
    createdAt: nowIso(),
  });
}

function currentUserOrThrow(req: AuthenticatedRequest, users: User[]) {
  const user = users.find((candidate) => candidate._id === req.auth?.userId);
  if (!user) {
    throw new Error("Authenticated user not found");
  }
  return user;
}

function userVisibleTransactions(role: Role, userId: string, transactions: Transaction[]) {
  if (isStaff(role)) return transactions;
  return transactions.filter((transaction) => transaction.userId === userId);
}

function getSupabaseAuthClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  if (!authClient) {
    authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return authClient;
}

export function registerRoutes(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = parseBody(loginSchema, req.body);
      const client = getSupabaseAuthClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (error || !data.user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const state = await readState();
      const user = state.users.find((candidate) => candidate._id === data.user.id);
      if (!user) {
        return res.status(401).json({ message: "Profile not found for this account" });
      }

      const safeUser = publicUser(user);
      return res.json({
        token: signToken(safeUser),
        user: safeUser,
      });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to login" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = parseBody(registerSchema, req.body);
      const client = getSupabaseAuthClient();
      const { data, error } = await client.auth.admin.createUser({
        email: input.email.toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.name,
        },
      });

      if (error || !data.user) {
        return res.status(400).json({ message: error?.message || "Unable to create account" });
      }

      const { error: profileError } = await client
        .from("profiles")
        .update({
          full_name: input.name,
          role: "student",
        })
        .eq("id", data.user.id);

      if (profileError) {
        return res.status(400).json({ message: profileError.message });
      }

      const state = await readState();
      const user = state.users.find((candidate) => candidate._id === data.user.id);
      if (!user) {
        return res.status(400).json({ message: "Account was created but the profile is not ready yet" });
      }

      const safeUser = publicUser(user);
      return res.status(201).json({
        token: signToken(safeUser),
        user: safeUser,
      });
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to register" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const user = state.users.find((candidate) => candidate._id === req.auth?.userId);
    if (!user) {
      return res.status(401).json({ message: "Session not found" });
    }
    return res.json(publicUser(user));
  });

  app.get("/api/bootstrap", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    state.transactions = updateTransactionStatuses(state.transactions);
    await writeState(state);

    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    const transactions = userVisibleTransactions(currentUser.role, currentUser._id, state.transactions);
    const reservations = currentUser.role === "student"
      ? state.reservations.filter((reservation) => reservation.userId === currentUser._id)
      : state.reservations;
    const notifications = state.notifications.filter(
      (notification) => currentUser.role !== "student" || notification.userId === currentUser._id,
    );

    return res.json({
      user: currentUser,
      branches: state.branches,
      users: safeUsers,
      books: state.books,
      transactions,
      reservations,
      reviews: state.reviews,
      notifications,
      auditLogs: currentUser.role === "admin" ? state.auditLogs.slice(0, 20) : [],
      dashboard: getDashboardData(state.books, safeUsers, state.transactions, state.reservations),
      recommendations: recommendBooks(currentUser, state.books),
    });
  });

  app.get("/api/books", requireAuth, async (req, res) => {
    const state = await readState();
    const search = String(req.query.search || "").toLowerCase();
    const category = String(req.query.category || "").toLowerCase();
    const author = String(req.query.author || "").toLowerCase();
    const isbn = String(req.query.isbn || "").toLowerCase();
    const branchId = String(req.query.branchId || "");

    const books = state.books.filter((book) => {
      const searchable = `${book.title} ${book.author} ${book.category} ${book.isbn} ${book.tags.join(" ")}`.toLowerCase();
      const matchesSearch = !search || searchable.includes(search);
      const matchesCategory = !category || book.category.toLowerCase() === category;
      const matchesAuthor = !author || book.author.toLowerCase().includes(author);
      const matchesIsbn = !isbn || book.isbn.toLowerCase().includes(isbn);
      const matchesBranch = !branchId || book.branchIds.includes(branchId);
      return matchesSearch && matchesCategory && matchesAuthor && matchesIsbn && matchesBranch;
    });

    return res.json(books);
  });

  app.post("/api/books", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input = parseBody(createBookSchema, req.body);
      const state = await readState();
      const book: Book = {
        ...input,
        _id: makeId("book"),
        tags: input.tags || [],
        branchIds: input.branchIds || [],
        ratingAverage: 0,
        ratingCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.books.unshift(book);
      writeAudit(state.auditLogs, req.auth!.userId, "CREATE_BOOK", "book", book._id, { title: book.title });
      await writeState(state);
      return res.status(201).json(book);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create book" });
    }
  });

  app.put("/api/books/:id", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const input = parseBody(updateBookSchema, req.body);
      const state = await readState();
      const bookId = String(req.params.id);
      const index = state.books.findIndex((book) => book._id === bookId);
      if (index === -1) {
        return res.status(404).json({ message: "Book not found" });
      }

      state.books[index] = {
        ...state.books[index],
        ...input,
        updatedAt: nowIso(),
      };
      writeAudit(state.auditLogs, req.auth!.userId, "UPDATE_BOOK", "book", bookId);
      await writeState(state);
      return res.json(state.books[index]);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update book" });
    }
  });

  app.delete("/api/books/:id", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res) => {
    const bookId = String(req.params.id);
    const state = await readState();
    state.books = state.books.filter((book) => book._id !== bookId);
    writeAudit(state.auditLogs, req.auth!.userId, "DELETE_BOOK", "book", bookId);
    await writeState(state);
    return res.status(204).send();
  });

  app.get("/api/users", requireAuth, requireRole(["admin", "librarian"]), async (_req, res) => {
    const state = await readState();
    return res.json(state.users.map(publicUser));
  });

  app.patch("/api/users/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(updateUserRoleSchema, req.body);
      const state = await readState();
      const user = state.users.find((candidate) => candidate._id === String(req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      user.role = input.role;
      user.branchId = input.branchId;
      writeAudit(state.auditLogs, req.auth!.userId, "UPDATE_ROLE", "user", user._id, { role: input.role });
      await writeState(state);
      return res.json(publicUser(user));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update role" });
    }
  });

  app.get("/api/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    state.transactions = updateTransactionStatuses(state.transactions);
    await writeState(state);
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    return res.json(userVisibleTransactions(currentUser.role, currentUser._id, state.transactions));
  });

  app.post("/api/transactions/issue", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(issueBookSchema, req.body);
      const state = await readState();
      const book = state.books.find(
        (candidate) => candidate._id === input.bookId || candidate.barcode === input.scanCode || candidate.isbn === input.scanCode,
      );
      if (!book) {
        return res.status(404).json({ message: "Book not found for the provided barcode or id" });
      }
      if (book.availableCopies <= 0) {
        return res.status(400).json({ message: "No copies available. Create a reservation instead." });
      }

      const user = state.users.find((candidate) => candidate._id === input.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const transaction: Transaction = {
        _id: makeId("txn"),
        bookId: book._id,
        userId: user._id,
        branchId: input.branchId,
        issuedBy: req.auth!.userId,
        issuedAt: nowIso(),
        dueDate: input.dueDate,
        fineAmount: 0,
        status: "ISSUED",
      };

      book.availableCopies -= 1;
      user.borrowingHistory = [book._id, ...user.borrowingHistory].slice(0, 20);
      state.transactions.unshift(transaction);
      await writeState(state);
      return res.status(201).json(transaction);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to issue book" });
    }
  });

  app.post("/api/transactions/return", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const state = await readState();
      const transaction = state.transactions.find((candidate) => {
        if (candidate.status === "RETURNED") return false;
        if (req.body?.transactionId) return candidate._id === req.body.transactionId;
        if (req.body?.scanCode) {
          const book = state.books.find((item) => item._id === candidate.bookId);
          return book?.barcode === req.body.scanCode || book?.isbn === req.body.scanCode;
        }
        return false;
      });

      if (!transaction) {
        return res.status(404).json({ message: "Active transaction not found" });
      }

      const book = state.books.find((candidate) => candidate._id === transaction.bookId);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      transaction.returnedAt = nowIso();
      transaction.returnedTo = req.auth!.userId;
      transaction.fineAmount = computeFine(transaction.dueDate);
      transaction.status = "RETURNED";
      book.availableCopies += 1;

      const nextReservation = state.reservations
        .filter((reservation) => reservation.bookId === book._id && reservation.status === "WAITING")
        .sort((a, b) => a.position - b.position)[0];

      if (nextReservation) {
        nextReservation.status = "READY";
        nextReservation.notifiedAt = nowIso();
      }

      await writeState(state);
      return res.json(transaction);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to return book" });
    }
  });

  app.get("/api/reservations", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    if (isStaff(currentUser.role)) {
      return res.json(state.reservations);
    }
    return res.json(state.reservations.filter((reservation) => reservation.userId === currentUser._id));
  });

  app.post("/api/reservations/:bookId", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    const bookId = String(req.params.bookId);
    const activeReservations = state.reservations
      .filter((reservation) => reservation.bookId === bookId && reservation.status === "WAITING")
      .sort((a, b) => a.position - b.position);

    const reservation: Reservation = {
      _id: makeId("reservation"),
      bookId,
      userId: currentUser._id,
      status: "WAITING",
      position: activeReservations.length + 1,
      createdAt: nowIso(),
    };

    state.reservations.unshift(reservation);
    await writeState(state);
    return res.status(201).json(reservation);
  });

  app.post("/api/reservations/:id/fulfill", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const reservation = state.reservations.find((candidate) => candidate._id === String(req.params.id));
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    reservation.status = "FULFILLED";
    writeAudit(state.auditLogs, req.auth!.userId, "FULFILL_RESERVATION", "reservation", reservation._id);
    await writeState(state);
    return res.json(reservation);
  });

  app.get("/api/recommendations", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    return res.json(recommendBooks(currentUser, state.books));
  });

  app.get("/api/reviews", requireAuth, async (_req, res) => {
    const state = await readState();
    return res.json(state.reviews);
  });

  app.post("/api/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(createReviewSchema, req.body);
      const state = await readState();
      const review: Review = {
        _id: makeId("review"),
        bookId: input.bookId,
        userId: req.auth!.userId,
        rating: input.rating,
        comment: input.comment,
        createdAt: nowIso(),
      };

      state.reviews.unshift(review);
      const bookReviews = state.reviews.filter((candidate) => candidate.bookId === input.bookId);
      const book = state.books.find((candidate) => candidate._id === input.bookId);
      if (book) {
        book.ratingCount = bookReviews.length;
        book.ratingAverage = Number(
          (bookReviews.reduce((sum, candidate) => sum + candidate.rating, 0) / bookReviews.length).toFixed(1),
        );
      }

      writeAudit(state.auditLogs, req.auth!.userId, "CREATE_REVIEW", "review", review._id, { bookId: input.bookId });
      await writeState(state);
      return res.status(201).json(review);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to save review" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    if (isStaff(currentUser.role)) {
      return res.json(state.notifications.slice(0, 20));
    }
    return res.json(state.notifications.filter((notification) => notification.userId === currentUser._id));
  });

  app.delete("/api/notifications/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    const notificationId = String(req.params.id);
    const notification = state.notifications.find((candidate) => candidate._id === notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const canDelete = isStaff(currentUser.role) || notification.userId === currentUser._id;
    if (!canDelete) {
      return res.status(403).json({ message: "You cannot delete this notification" });
    }

    state.notifications = state.notifications.filter((candidate) => candidate._id !== notificationId);
    await writeState(state);
    return res.status(204).send();
  });

  app.delete("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);

    state.notifications = isStaff(currentUser.role)
      ? []
      : state.notifications.filter((notification) => notification.userId !== currentUser._id);

    await writeState(state);
    return res.status(204).send();
  });

  app.get("/api/audit-logs", requireAuth, requireRole(["admin"]), async (_req, res) => {
    const state = await readState();
    return res.json(state.auditLogs.slice(0, 50));
  });

  app.get("/api/dashboard", requireAuth, async (_req, res) => {
    const state = await readState();
    const safeUsers = state.users.map(publicUser);
    return res.json(getDashboardData(state.books, safeUsers, state.transactions, state.reservations));
  });

  app.get("/api/chatbot", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(chatbotSchema, { message: String(req.query.message || "") });
      const state = await readState();
      const safeUsers = state.users.map(publicUser);
      const currentUser = currentUserOrThrow(req, safeUsers);
      const recommendations = recommendBooks(currentUser, state.books);
      return res.json(buildChatResponse(input.message, state.books, recommendations));
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to answer query" });
    }
  });
}
