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
  returnBookSchema,
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
  registrationNumber: z.string().min(1, "Registration number is required"),
  role: z.enum(["student"]).default("student"),
});
const googleAuthSchema = z.object({
  accessToken: z.string().min(1),
  registrationNumber: z.string().trim().min(1).optional(),
});
const registrationNumberSchema = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number is required"),
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

  const topReaderReward = [...activeUsers.entries()]
    .map(([userId, borrowCount]) => {
      const user = users.find((candidate) => candidate._id === userId && candidate.role === "student");
      if (!user) return null;
      return {
        userId,
        name: user.name,
        registrationNumber: user.registrationNumber,
        borrowCount,
        rewardTitle: "Top Reader Award",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.borrowCount - a!.borrowCount)[0] || null;

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
    topReaderReward,
    overdueItems,
  };
}

function recommendBooks(currentUser: User, books: Book[]) {
  const historyCategories = new Map<string, number>();
  for (const bookId of currentUser.borrowingHistory || []) {
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

function formatBookAvailability(book: Book, branches: { _id: string; name: string }[]) {
  const branchNames = branches
    .filter((branch) => book.branchIds.includes(branch._id))
    .map((branch) => branch.name);
  const locationText = branchNames.length > 0 ? `Available in ${branchNames.join(", ")}` : "No branch assignment yet";
  const digitalText = book.ebookUrl ? "Digital access is available." : "No digital copy is linked.";
  return `${book.title} by ${book.author} has ${book.availableCopies} of ${book.totalCopies} copies available. ${locationText}. ${digitalText}`;
}

function formatBookCard(book: Book, branches: { _id: string; name: string }[]) {
  const branchNames = branches
    .filter((branch) => book.branchIds.includes(branch._id))
    .map((branch) => branch.name);

  const lines = [
    `${book.title} by ${book.author}`,
    `Category: ${book.category}`,
    `Copies: ${book.availableCopies}/${book.totalCopies} available`,
    `Format: ${book.format}`,
  ];

  if (branchNames.length > 0) {
    lines.push(`Branches: ${branchNames.join(", ")}`);
  }

  if (book.ebookUrl) {
    lines.push("Digital copy available");
  }

  return lines.join("\n");
}

function buildChatResponse(
  message: string,
  books: Book[],
  recommendations: Book[],
  branches: { _id: string; name: string }[],
  transactions: Transaction[],
  reservations: Reservation[],
  currentUser: User,
) {
  const normalized = message.toLowerCase().trim();
  const activeLoans = transactions.filter((transaction) => transaction.status !== "RETURNED");
  const userLoans = activeLoans.filter((transaction) => transaction.userId === currentUser._id);
  const overdueLoans = userLoans.filter((transaction) => transaction.status === "OVERDUE");
  const waitingReservations = reservations.filter(
    (reservation) => reservation.userId === currentUser._id && (reservation.status === "WAITING" || reservation.status === "READY"),
  );

  const matchingBooks = books.filter((book) => {
    const haystack = `${book.title} ${book.author} ${book.category} ${book.isbn} ${book.barcode}`.toLowerCase();
    return normalized.length > 1 && haystack.includes(normalized);
  });
  const categoryMatches = books.filter((book) => normalized.includes(book.category.toLowerCase())).slice(0, 5);
  const greetingIntent = ["hi", "hello", "hey", "hii", "help", "who are you"].some((term) => normalized === term || normalized.startsWith(`${term} `));
  const dueSoonLoans = [...userLoans]
    .filter((transaction) => transaction.status === "ISSUED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  if (greetingIntent) {
    const nextDueLoan = dueSoonLoans[0];
    const nextDueBook = nextDueLoan
      ? books.find((candidate) => candidate._id === nextDueLoan.bookId)
      : null;

    return {
      reply: [
        `Hi ${currentUser.name.split(" ")[0]}, I can help with availability, your borrowed books, reservations, overdue fines, digital titles, and smart recommendations.`,
        nextDueLoan && nextDueBook
          ? `Your next due book is ${nextDueBook.title} on ${new Date(nextDueLoan.dueDate).toLocaleDateString()}.`
          : "You can ask things like: ask with AI about my borrowed books, show digital books, or recommend technology titles.",
      ].join("\n\n"),
      suggestedBooks: recommendations,
    };
  }

  if (normalized.includes("overdue") || normalized.includes("fine")) {
    if (overdueLoans.length === 0) {
      return {
        reply: "You do not have any overdue loans right now. If you want, I can help you check current borrowed books or reservation status.",
        suggestedBooks: recommendations,
      };
    }

    const summary = overdueLoans
      .map((loan) => {
        const book = books.find((candidate) => candidate._id === loan.bookId);
        return `- ${book?.title || "Unknown title"}: overdue with a current fine of $${loan.fineAmount}`;
      })
      .join("\n");

    return {
      reply: `You currently have ${overdueLoans.length} overdue book${overdueLoans.length === 1 ? "" : "s"}.\n\n${summary}`,
      suggestedBooks: overdueLoans
        .map((loan) => books.find((candidate) => candidate._id === loan.bookId))
        .filter(Boolean) as Book[],
    };
  }

  if (normalized.includes("available") || normalized.includes("availability") || normalized.includes("copy")) {
    const targetBooks = matchingBooks.length > 0 ? matchingBooks : books.filter((book) => book.availableCopies > 0).slice(0, 3);
    const reply = targetBooks.length > 0
      ? targetBooks.map((book) => formatBookCard(book, branches)).join("\n\n")
      : "I could not find an available copy for that search. Try another title, author, or category.";

    return {
      reply,
      suggestedBooks: targetBooks.slice(0, 4),
    };
  }

  if (normalized.includes("ebook") || normalized.includes("digital")) {
    const digitalBooks = (matchingBooks.length > 0 ? matchingBooks : books.filter((book) => Boolean(book.ebookUrl))).slice(0, 4);
    return {
      reply: digitalBooks.length > 0
        ? digitalBooks.map((book) => `- ${book.title} by ${book.author} has a digital copy ready to open.`).join("\n")
        : "I could not find a digital title for that search.",
      suggestedBooks: digitalBooks,
    };
  }

  if (normalized.includes("recommend") || normalized.includes("suggest")) {
    const recommendedSummary = recommendations
      .map((book) => `- ${book.title} by ${book.author} (${book.category})`)
      .join("\n");

    return {
      reply: `I used your history, category fit, and ratings to prepare stronger suggestions.\n\n${recommendedSummary || "No tailored suggestions yet, but I can still recommend by category, author, or format."}`,
      suggestedBooks: recommendations,
    };
  }

  if (normalized.includes("borrow") || normalized.includes("issued") || normalized.includes("my books")) {
    if (userLoans.length === 0) {
      return {
        reply: "You do not have any active borrowed books right now.",
        suggestedBooks: recommendations,
      };
    }

    return {
      reply: userLoans
        .map((loan) => {
          const book = books.find((candidate) => candidate._id === loan.bookId);
          return `- ${book?.title || "Unknown title"} is due on ${new Date(loan.dueDate).toLocaleDateString()}.`;
        })
        .join("\n"),
      suggestedBooks: userLoans
        .map((loan) => books.find((candidate) => candidate._id === loan.bookId))
        .filter(Boolean) as Book[],
    };
  }

  if (normalized.includes("reservation") || normalized.includes("reserve")) {
    if (waitingReservations.length === 0 && matchingBooks.length === 0) {
      return {
        reply: "You do not have any active reservations right now. If you want to reserve a specific book, ask me for its availability first.",
        suggestedBooks: recommendations,
      };
    }

    if (matchingBooks.length > 0) {
      return {
        reply: matchingBooks
          .map((book) => {
            const queue = reservations.filter((reservation) => reservation.bookId === book._id && reservation.status === "WAITING");
            return `- ${book.title} currently has ${queue.length} waiting reservation${queue.length === 1 ? "" : "s"}.`;
          })
          .join("\n"),
        suggestedBooks: matchingBooks.slice(0, 4),
      };
    }

    return {
      reply: waitingReservations
        .map((reservation) => {
          const book = books.find((candidate) => candidate._id === reservation.bookId);
          return `- ${book?.title || "Unknown title"} is in your reservation list with status ${reservation.status.toLowerCase()}.`;
        })
        .join("\n"),
      suggestedBooks: waitingReservations
        .map((reservation) => books.find((candidate) => candidate._id === reservation.bookId))
        .filter(Boolean) as Book[],
    };
  }

  if (normalized.includes("category") || normalized.includes("subject") || categoryMatches.length > 0) {
    const targetBooks = categoryMatches.length > 0 ? categoryMatches : recommendations;
    return {
      reply: targetBooks.length > 0
        ? targetBooks.map((book) => `- ${book.title} by ${book.author} in ${book.category}`).join("\n")
        : "I could not find matching categories yet. Try a category like fiction, programming, self improvement, or technology.",
      suggestedBooks: targetBooks.slice(0, 4),
    };
  }

  if (matchingBooks.length > 0) {
    return {
      reply: matchingBooks.map((book) => formatBookCard(book, branches)).join("\n\n"),
      suggestedBooks: matchingBooks.slice(0, 4),
    };
  }

  return {
    reply: "Hi, I can help you manage library tasks at a top level. Ask with AI about availability, your borrowed books, reservations, overdue fines, digital titles, categories, or smart recommendations.",
    suggestedBooks: recommendations,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function writeAudit(logs: AuditLog[], actorId: string, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  const auditLog = {
    _id: makeId("log"),
    actorId,
    action,
    entity,
    entityId,
    details,
    createdAt: nowIso(),
  };
  logs.unshift(auditLog);
  return auditLog;
}

function notify(notifications: Notification[], userId: string, title: string, message: string, channel: Notification["channel"] = "in_app") {
  const notification = {
    _id: makeId("notification"),
    userId,
    title,
    message,
    channel,
    read: false,
    createdAt: nowIso(),
  };
  notifications.unshift(notification);
  return notification;
}

function notifyStaff(state: Awaited<ReturnType<typeof readState>>, title: string, message: string) {
  return state.users
    .filter((user) => user.role === "admin" || user.role === "librarian")
    .map((user) => notify(state.notifications, user._id, title, message));
}

function normalizeBookCopies(book: Book) {
  book.totalCopies = Math.max(0, book.totalCopies);
  book.availableCopies = Math.min(Math.max(0, book.availableCopies), book.totalCopies);
}

function reindexReservationQueue(reservations: Reservation[], bookId: string) {
  reservations
    .filter((reservation) => reservation.bookId === bookId && reservation.status === "WAITING")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((reservation, index) => {
      reservation.position = index + 1;
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
  return transactions.filter((transaction) => transaction.userId === userId && transaction.status !== "RETURNED");
}

function userVisibleReservations(role: Role, userId: string, reservations: Reservation[]) {
  if (isStaff(role)) return reservations;
  return reservations.filter(
    (reservation) => reservation.userId === userId && (reservation.status === "WAITING" || reservation.status === "READY"),
  );
}

function userVisibleNotifications(role: Role, userId: string, notifications: Notification[]) {
  if (isStaff(role)) return notifications;
  return notifications.filter((notification) => notification.userId === userId);
}

function userVisibleUsers(role: Role, userId: string, users: User[]) {
  if (isStaff(role)) return users;
  return users.filter((user) => user._id === userId);
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

function shouldUseDirectSupabasePersistence() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function persistReturnDirect(
  transaction: Transaction,
  book: Book,
  user: User | undefined,
  notifications: Notification[],
  auditLog?: AuditLog,
) {
  const client = getSupabaseAuthClient();

  let transactionError: Error | null = null;
  let shouldUseLookupFallback = !isUuid(transaction._id) || !isUuid(book._id) || !isUuid(transaction.userId);

  if (!shouldUseLookupFallback) {
    const directUpdate = await client.from("transactions").update({
      returned_at: transaction.returnedAt || null,
      returned_to: transaction.returnedTo || null,
      fine_amount: transaction.fineAmount,
      status: transaction.status,
    }).eq("id", transaction._id);
    transactionError = directUpdate.error;

    if (transactionError && transaction.returnedTo) {
      const retry = await client.from("transactions").update({
        returned_at: transaction.returnedAt || null,
        returned_to: null,
        fine_amount: transaction.fineAmount,
        status: transaction.status,
      }).eq("id", transaction._id);
      transactionError = retry.error;
    }

    shouldUseLookupFallback = Boolean(transactionError);
  }

  if (shouldUseLookupFallback) {
    if (!user?.email) {
      throw new Error(transactionError?.message || "Unable to resolve the borrower profile for this return");
    }

    const { data: liveBook, error: liveBookError } = await client
      .from("books")
      .select("id")
      .or(`isbn.eq.${book.isbn},barcode.eq.${book.barcode}`)
      .limit(1)
      .maybeSingle();
    if (liveBookError || !liveBook?.id) {
      throw new Error(liveBookError?.message || "Unable to find the live book record for this return");
    }

    const { data: liveUser, error: liveUserError } = await client
      .from("profiles")
      .select("id")
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();
    if (liveUserError || !liveUser?.id) {
      throw new Error(liveUserError?.message || "Unable to find the live borrower profile for this return");
    }

    const { data: liveTransaction, error: liveTransactionError } = await client
      .from("transactions")
      .select("id")
      .eq("book_id", liveBook.id)
      .eq("user_id", liveUser.id)
      .in("status", ["ISSUED", "OVERDUE"])
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (liveTransactionError || !liveTransaction?.id) {
      throw new Error(liveTransactionError?.message || "Unable to find the live transaction for this return");
    }

    const lookupUpdate = await client.from("transactions").update({
      returned_at: transaction.returnedAt || null,
      returned_to: transaction.returnedTo || null,
      fine_amount: transaction.fineAmount,
      status: transaction.status,
    }).eq("id", liveTransaction.id);

    transactionError = lookupUpdate.error;
    if (transactionError && transaction.returnedTo) {
      const retry = await client.from("transactions").update({
        returned_at: transaction.returnedAt || null,
        returned_to: null,
        fine_amount: transaction.fineAmount,
        status: transaction.status,
      }).eq("id", liveTransaction.id);
      transactionError = retry.error;
    }

    const { error: liveBookUpdateError } = await client.from("books").update({
      available_copies: book.availableCopies,
      updated_at: nowIso(),
    }).eq("id", liveBook.id);
    if (liveBookUpdateError) throw new Error(liveBookUpdateError.message);
  }

  if (transactionError && transaction.returnedTo) {
    throw new Error(transactionError.message);
  }
  if (transactionError) throw new Error(transactionError.message);

  if (!shouldUseLookupFallback) {
    const { error: bookError } = await client.from("books").update({
      available_copies: book.availableCopies,
      updated_at: nowIso(),
    }).eq("id", book._id);
    if (bookError) throw new Error(bookError.message);
  }

  const validNotifications = notifications.filter((notification) => isUuid(notification.userId));
  if (validNotifications.length > 0) {
    const { error: notificationError } = await client.from("notifications").insert(validNotifications.map((notification) => ({
      ...(isUuid(notification._id) ? { id: notification._id } : {}),
      user_id: notification.userId,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      read: notification.read,
      created_at: notification.createdAt,
    })));
    if (notificationError) {
      console.warn("Non-blocking notification write failed during return:", notificationError.message);
    }
  }

  if (auditLog && isUuid(auditLog.actorId)) {
    const { error: auditError } = await client.from("audit_logs").insert({
      ...(isUuid(auditLog._id) ? { id: auditLog._id } : {}),
      actor_id: auditLog.actorId,
      action: auditLog.action,
      entity: auditLog.entity,
      entity_id: isUuid(auditLog.entityId) ? auditLog.entityId : null,
      details: auditLog.details,
      created_at: auditLog.createdAt,
    });
    if (auditError) {
      console.warn("Non-blocking audit write failed during return:", auditError.message);
    }
  }
}

async function persistReservationDecisionDirect(
  reservation: Reservation,
  waitingReservations: Reservation[],
  notifications: Notification[],
  auditLog?: AuditLog,
) {
  const client = getSupabaseAuthClient();

  const { error: reservationError } = await client.from("reservations").update({
    status: reservation.status,
    position: reservation.position,
    notified_at: reservation.notifiedAt || null,
  }).eq("id", reservation._id);
  if (reservationError) throw new Error(reservationError.message);

  if (waitingReservations.length > 0) {
    const { error: queueError } = await client.from("reservations").upsert(waitingReservations.map((item) => ({
      id: item._id,
      book_id: item.bookId,
      user_id: item.userId,
      status: item.status,
      position: item.position,
      created_at: item.createdAt,
      notified_at: item.notifiedAt || null,
    })));
    if (queueError) throw new Error(queueError.message);
  }

  const validNotifications = notifications.filter((notification) => isUuid(notification.userId));
  if (validNotifications.length > 0) {
    const { error: notificationError } = await client.from("notifications").insert(validNotifications.map((notification) => ({
      ...(isUuid(notification._id) ? { id: notification._id } : {}),
      user_id: notification.userId,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      read: notification.read,
      created_at: notification.createdAt,
    })));
    if (notificationError) {
      console.warn("Non-blocking notification write failed during reservation decision:", notificationError.message);
    }
  }

  if (auditLog && isUuid(auditLog.actorId)) {
    const { error: auditError } = await client.from("audit_logs").insert({
      ...(isUuid(auditLog._id) ? { id: auditLog._id } : {}),
      actor_id: auditLog.actorId,
      action: auditLog.action,
      entity: auditLog.entity,
      entity_id: isUuid(auditLog.entityId) ? auditLog.entityId : null,
      details: auditLog.details,
      created_at: auditLog.createdAt,
    });
    if (auditError) {
      console.warn("Non-blocking audit write failed during reservation decision:", auditError.message);
    }
  }
}

async function persistIssueDirect(
  transaction: Transaction,
  book: Book,
  user: User,
  branch: { _id: string; code: string } | undefined,
  fulfilledReservation: Reservation | undefined,
  auditLog?: AuditLog,
) {
  const client = getSupabaseAuthClient();

  const { data: liveBook, error: liveBookError } = await client
    .from("books")
    .select("id, available_copies")
    .or(`isbn.eq.${book.isbn},barcode.eq.${book.barcode}`)
    .limit(1)
    .maybeSingle();
  if (liveBookError || !liveBook?.id) {
    throw new Error(liveBookError?.message || "Unable to find the live book record for this issue");
  }

  const { data: liveUser, error: liveUserError } = await client
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .limit(1)
    .maybeSingle();
  if (liveUserError || !liveUser?.id) {
    throw new Error(liveUserError?.message || "Unable to find the live member profile for this issue");
  }

  let liveBranchId: string | null = null;
  if (branch) {
    if (isUuid(branch._id)) {
      liveBranchId = branch._id;
    } else {
      const { data: liveBranch, error: liveBranchError } = await client
        .from("branches")
        .select("id")
        .eq("code", branch.code)
        .limit(1)
        .maybeSingle();
      if (liveBranchError || !liveBranch?.id) {
        throw new Error(liveBranchError?.message || "Unable to find the live branch for this issue");
      }
      liveBranchId = liveBranch.id;
    }
  }

  const { error: transactionError } = await client.from("transactions").insert({
    ...(isUuid(transaction._id) ? { id: transaction._id } : {}),
    book_id: liveBook.id,
    user_id: liveUser.id,
    branch_id: liveBranchId,
    issued_by: isUuid(transaction.issuedBy) ? transaction.issuedBy : null,
    issued_at: transaction.issuedAt,
    due_date: transaction.dueDate,
    fine_amount: transaction.fineAmount,
    status: transaction.status,
  });
  if (transactionError) throw new Error(transactionError.message);

  const liveAvailableCopies = typeof liveBook.available_copies === "number" ? liveBook.available_copies : book.availableCopies + 1;
  const { error: bookError } = await client.from("books").update({
    available_copies: Math.max(0, liveAvailableCopies - 1),
    updated_at: nowIso(),
  }).eq("id", liveBook.id);
  if (bookError) throw new Error(bookError.message);

  if (fulfilledReservation) {
    let liveReservationId = isUuid(fulfilledReservation._id) ? fulfilledReservation._id : null;
    if (!liveReservationId) {
      const { data: liveReservation, error: liveReservationError } = await client
        .from("reservations")
        .select("id")
        .eq("book_id", liveBook.id)
        .eq("user_id", liveUser.id)
        .in("status", ["WAITING", "READY"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (liveReservationError) {
        throw new Error(liveReservationError.message);
      }
      liveReservationId = liveReservation?.id || null;
    }

    if (liveReservationId) {
      const { error: reservationError } = await client.from("reservations").update({
        status: "FULFILLED",
        notified_at: fulfilledReservation.notifiedAt || null,
      }).eq("id", liveReservationId);
      if (reservationError) throw new Error(reservationError.message);
    }
  }

  if (auditLog && isUuid(auditLog.actorId)) {
    const { error: auditError } = await client.from("audit_logs").insert({
      ...(isUuid(auditLog._id) ? { id: auditLog._id } : {}),
      actor_id: auditLog.actorId,
      action: auditLog.action,
      entity: auditLog.entity,
      entity_id: isUuid(auditLog.entityId) ? auditLog.entityId : null,
      details: auditLog.details,
      created_at: auditLog.createdAt,
    });
    if (auditError) {
      console.warn("Non-blocking audit write failed during issue:", auditError.message);
    }
  }
}

async function upsertStudentProfile(
  client: SupabaseClient,
  input: {
    id: string;
    email: string;
    fullName: string;
    registrationNumber?: string;
  },
) {
  const { data: existingProfile } = await client
    .from("profiles")
    .select("role, phone")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await client.from("profiles").upsert(
    {
      id: input.id,
      email: input.email,
      full_name: input.fullName,
      role: existingProfile?.role || "student",
      phone: input.registrationNumber || existingProfile?.phone || null,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function buildAuthPayload(userId: string) {
  const state = await readState();
  const user = state.users.find((candidate) => candidate._id === userId);
  if (!user) {
    throw new Error("Profile not found for this account");
  }

  const safeUser = publicUser(user);
  return {
    token: signToken(safeUser),
    user: safeUser,
  };
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
          phone: input.registrationNumber,
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

  app.post("/api/auth/google", async (req, res) => {
    try {
      const input = parseBody(googleAuthSchema, req.body);
      const client = getSupabaseAuthClient();
      const { data, error } = await client.auth.getUser(input.accessToken);

      if (error || !data.user?.email) {
        return res.status(401).json({ message: "Unable to verify Google sign-in" });
      }

      const fullName =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name ||
        data.user.email;

      await upsertStudentProfile(client, {
        id: data.user.id,
        email: data.user.email,
        fullName,
        registrationNumber: input.registrationNumber,
      });

      const payload = await buildAuthPayload(data.user.id);
      return res.json(payload);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to sign in with Google" });
    }
  });

  app.patch("/api/auth/registration-number", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(registrationNumberSchema, req.body);
      const client = getSupabaseAuthClient();
      const currentState = await readState();
      const currentUser = currentUserOrThrow(req, currentState.users.map(publicUser));

      await upsertStudentProfile(client, {
        id: currentUser._id,
        email: currentUser.email,
        fullName: currentUser.name,
        registrationNumber: input.registrationNumber,
      });

      const payload = await buildAuthPayload(currentUser._id);
      return res.json(payload);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update registration number" });
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
    try {
      const state = await readState();
      const transactionsWithComputedStatus = updateTransactionStatuses(state.transactions);

      const safeUsers = state.users.map(publicUser);
      const currentUser = currentUserOrThrow(req, safeUsers);
      const transactions = userVisibleTransactions(currentUser.role, currentUser._id, transactionsWithComputedStatus);
      const reservations = userVisibleReservations(currentUser.role, currentUser._id, state.reservations);
      const notifications = userVisibleNotifications(currentUser.role, currentUser._id, state.notifications);
      const visibleUsers = userVisibleUsers(currentUser.role, currentUser._id, safeUsers);
      const dashboardUsers = currentUser.role === "student" ? [currentUser] : safeUsers;

      return res.json({
        user: currentUser,
        branches: state.branches || [],
        users: visibleUsers || [],
        books: state.books || [],
        transactions,
        reservations,
        reviews: state.reviews || [],
        notifications,
        auditLogs: currentUser.role === "admin" ? state.auditLogs.slice(0, 20) : [],
        dashboard: getDashboardData(state.books || [], dashboardUsers || [], transactionsWithComputedStatus || [], reservations || []),
        recommendations: recommendBooks(currentUser, state.books || []),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load bootstrap data";
      const status = message.includes("Authenticated user not found") ? 401 : 500;
      return res.status(status).json({ message });
    }
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
    state.transactions = state.transactions.filter((transaction) => transaction.bookId !== bookId);
    state.reservations = state.reservations.filter((reservation) => reservation.bookId !== bookId);
    state.reviews = state.reviews.filter((review) => review.bookId !== bookId);
    state.notifications = state.notifications.filter((notification) => {
      const text = `${notification.title} ${notification.message}`.toLowerCase();
      return !text.includes(bookId.toLowerCase());
    });
    state.auditLogs = state.auditLogs.filter((log) => {
      if (log.entity === "book" && log.entityId === bookId) return false;
      return log.details?.bookId !== bookId;
    });
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
      const actorExists = state.users.some((candidate) => candidate._id === req.auth!.userId);
      const branch = state.branches.find((candidate) => candidate._id === input.branchId);

      const transaction: Transaction = {
        _id: makeId("txn"),
        bookId: book._id,
        userId: user._id,
        branchId: input.branchId,
        issuedBy: actorExists ? req.auth!.userId : "",
        issuedAt: nowIso(),
        dueDate: input.dueDate,
        fineAmount: 0,
        status: "ISSUED",
      };

      book.availableCopies -= 1;
      normalizeBookCopies(book);
      user.borrowingHistory = [book._id, ...user.borrowingHistory].slice(0, 20);
      const matchingReservation = state.reservations.find(
        (reservation) =>
          reservation.bookId === book._id &&
          reservation.userId === user._id &&
          (reservation.status === "READY" || reservation.status === "WAITING"),
      );
      if (matchingReservation) {
        matchingReservation.status = "FULFILLED";
        matchingReservation.notifiedAt = nowIso();
        reindexReservationQueue(state.reservations, book._id);
      }
      state.transactions.unshift(transaction);
      const issueAudit = writeAudit(state.auditLogs, req.auth!.userId, "ISSUE_BOOK", "transaction", transaction._id, {
        bookId: book._id,
        userId: user._id,
      });
      if (shouldUseDirectSupabasePersistence()) {
        await persistIssueDirect(transaction, book, user, branch, matchingReservation, issueAudit);
      } else {
        await writeState(state);
      }
      return res.status(201).json(transaction);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to issue book" });
    }
  });

  app.post("/api/transactions/return", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const input = parseBody(returnBookSchema, req.body);
      if (!input.transactionId && !input.scanCode) {
        return res.status(400).json({ message: "Provide a transaction id or scan code to process a return" });
      }
      const state = await readState();
      const transaction = state.transactions.find((candidate) => {
        if (input.transactionId) return candidate._id === input.transactionId;
        if (input.scanCode) {
          const book = state.books.find((item) => item._id === candidate.bookId);
          return book?.barcode === input.scanCode || book?.isbn === input.scanCode;
        }
        return false;
      });

      if (!transaction) {
        return res.status(404).json({ message: "Active transaction not found" });
      }
      if (transaction.status === "RETURNED") {
        return res.json(transaction);
      }

      const book = state.books.find((candidate) => candidate._id === transaction.bookId);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      const actorExists = state.users.some((candidate) => candidate._id === req.auth!.userId);

      transaction.returnedAt = nowIso();
      transaction.returnedTo = actorExists ? req.auth!.userId : undefined;
      transaction.fineAmount = computeFine(transaction.dueDate);
      transaction.status = "RETURNED";
      book.availableCopies += 1;
      normalizeBookCopies(book);
      const returnAudit = writeAudit(state.auditLogs, req.auth!.userId, "RETURN_BOOK", "transaction", transaction._id, {
        bookId: transaction.bookId,
        userId: transaction.userId,
        fineAmount: transaction.fineAmount,
      });
      const createdNotifications: Notification[] = [];
      createdNotifications.push(
        notify(state.notifications, transaction.userId, "Book Returned", `${book.title} has been returned successfully.`),
      );

      const nextReservation = state.reservations
        .filter((reservation) => reservation.bookId === book._id && reservation.status === "WAITING")
        .sort((a, b) => a.position - b.position)[0];

      if (nextReservation) {
        const queuedUser = state.users.find((candidate) => candidate._id === nextReservation.userId);
        createdNotifications.push(...notifyStaff(
          state,
          "Reservation Needs Review",
          `${book.title} was returned and ${queuedUser?.name || "a student"} has a pending request waiting for approval.`,
        ));
      }

      if (shouldUseDirectSupabasePersistence()) {
        const borrower = state.users.find((candidate) => candidate._id === transaction.userId);
        await persistReturnDirect(transaction, book, borrower, createdNotifications, returnAudit);
      } else {
        await writeState(state);
      }
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
    const book = state.books.find((candidate) => candidate._id === bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const existingReservation = state.reservations.find(
      (reservation) =>
        reservation.bookId === bookId &&
        reservation.userId === currentUser._id &&
        (reservation.status === "WAITING" || reservation.status === "READY"),
    );

    if (existingReservation) {
      return res.status(400).json({ message: "You already have an active reservation request for this book" });
    }

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
    reindexReservationQueue(state.reservations, bookId);
    notifyStaff(
      state,
      "New Reservation Request",
      `${currentUser.name} requested ${book.title}. Review and approve or decline the request.`,
    );
    notify(
      state.notifications,
      currentUser._id,
      "Reservation Request Sent",
      `${book.title} has been sent for admin/librarian approval.`,
    );
    writeAudit(state.auditLogs, currentUser._id, "CREATE_RESERVATION", "reservation", reservation._id, { bookId });
    await writeState(state);
    return res.status(201).json(reservation);
  });

  app.post("/api/reservations/:id/approve", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const state = await readState();
      const reservation = state.reservations.find((candidate) => candidate._id === String(req.params.id));
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      if (reservation.status === "READY") {
        return res.json(reservation);
      }
      if (reservation.status === "CANCELLED" || reservation.status === "FULFILLED") {
        return res.status(400).json({ message: `This reservation is already ${reservation.status.toLowerCase()}` });
      }
      if (reservation.status !== "WAITING") {
        return res.status(400).json({ message: "Only waiting reservations can be approved" });
      }

      const book = state.books.find((candidate) => candidate._id === reservation.bookId);
      reservation.status = "READY";
      reservation.notifiedAt = nowIso();
      reindexReservationQueue(state.reservations, reservation.bookId);
      const notification = notify(
        state.notifications,
        reservation.userId,
        "Reservation Approved",
        `${book?.title || "Your reserved book"} has been approved and is ready for pickup.`,
      );
      const auditLog = writeAudit(state.auditLogs, req.auth!.userId, "APPROVE_RESERVATION", "reservation", reservation._id, {
        bookId: reservation.bookId,
        userId: reservation.userId,
      });
      if (shouldUseDirectSupabasePersistence()) {
        await persistReservationDecisionDirect(
          reservation,
          state.reservations.filter((candidate) => candidate.bookId === reservation.bookId && candidate.status === "WAITING"),
          [notification],
          auditLog,
        );
      } else {
        await writeState(state);
      }
      return res.json(reservation);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to approve reservation" });
    }
  });

  app.post("/api/reservations/:id/decline", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const state = await readState();
      const reservation = state.reservations.find((candidate) => candidate._id === String(req.params.id));
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      if (reservation.status === "CANCELLED") {
        return res.json(reservation);
      }
      if (reservation.status === "READY" || reservation.status === "FULFILLED") {
        return res.status(400).json({ message: `This reservation is already ${reservation.status.toLowerCase()}` });
      }
      if (reservation.status !== "WAITING") {
        return res.status(400).json({ message: "Only waiting reservations can be declined" });
      }

      const book = state.books.find((candidate) => candidate._id === reservation.bookId);
      reservation.status = "CANCELLED";
      reindexReservationQueue(state.reservations, reservation.bookId);
      const notification = notify(
        state.notifications,
        reservation.userId,
        "Reservation Declined",
        `${book?.title || "Your reservation"} was declined by the library team.`,
      );
      const auditLog = writeAudit(state.auditLogs, req.auth!.userId, "DECLINE_RESERVATION", "reservation", reservation._id, {
        bookId: reservation.bookId,
        userId: reservation.userId,
      });
      if (shouldUseDirectSupabasePersistence()) {
        await persistReservationDecisionDirect(
          reservation,
          state.reservations.filter((candidate) => candidate.bookId === reservation.bookId && candidate.status === "WAITING"),
          [notification],
          auditLog,
        );
      } else {
        await writeState(state);
      }
      return res.json(reservation);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to decline reservation" });
    }
  });

  app.post("/api/reservations/:id/fulfill", requireAuth, requireRole(["admin", "librarian"]), async (req: AuthenticatedRequest, res) => {
    try {
      const state = await readState();
      const reservation = state.reservations.find((candidate) => candidate._id === String(req.params.id));
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      reservation.status = "FULFILLED";
      reindexReservationQueue(state.reservations, reservation.bookId);
      writeAudit(state.auditLogs, req.auth!.userId, "FULFILL_RESERVATION", "reservation", reservation._id);
      await writeState(state);
      return res.json(reservation);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to fulfill reservation" });
    }
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
      const existingReview = state.reviews.find(
        (candidate) => candidate.bookId === input.bookId && candidate.userId === req.auth!.userId,
      );
      const review: Review = existingReview || {
        _id: makeId("review"),
        bookId: input.bookId,
        userId: req.auth!.userId,
        rating: input.rating,
        comment: input.comment,
        createdAt: nowIso(),
      };

      review.rating = input.rating;
      review.comment = input.comment;

      if (!existingReview) {
        state.reviews.unshift(review);
      }

      const bookReviews = state.reviews.filter((candidate) => candidate.bookId === input.bookId);
      const book = state.books.find((candidate) => candidate._id === input.bookId);
      if (book) {
        book.ratingCount = bookReviews.length;
        book.ratingAverage = Number(
          (bookReviews.reduce((sum, candidate) => sum + candidate.rating, 0) / bookReviews.length).toFixed(1),
        );
      }

      writeAudit(state.auditLogs, req.auth!.userId, existingReview ? "UPDATE_REVIEW" : "CREATE_REVIEW", "review", review._id, {
        bookId: input.bookId,
      });
      await writeState(state);
      return res.status(existingReview ? 200 : 201).json(review);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to save review" });
    }
  });

  app.delete("/api/reviews/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    const state = await readState();
    const reviewId = String(req.params.id);
    const review = state.reviews.find((candidate) => candidate._id === reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const safeUsers = state.users.map(publicUser);
    const currentUser = currentUserOrThrow(req, safeUsers);
    const canDelete = review.userId === currentUser._id || currentUser.role === "admin";
    if (!canDelete) {
      return res.status(403).json({ message: "You cannot delete this review" });
    }

    state.reviews = state.reviews.filter((candidate) => candidate._id !== reviewId);
    const bookReviews = state.reviews.filter((candidate) => candidate.bookId === review.bookId);
    const book = state.books.find((candidate) => candidate._id === review.bookId);
    if (book) {
      book.ratingCount = bookReviews.length;
      book.ratingAverage = bookReviews.length > 0
        ? Number((bookReviews.reduce((sum, candidate) => sum + candidate.rating, 0) / bookReviews.length).toFixed(1))
        : 0;
    }

    writeAudit(state.auditLogs, req.auth!.userId, "DELETE_REVIEW", "review", reviewId, { bookId: review.bookId });
    await writeState(state);
    return res.status(204).send();
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
      return res.json(
        buildChatResponse(
          input.message,
          state.books,
          recommendations,
          state.branches,
          state.transactions,
          state.reservations,
          currentUser,
        ),
      );
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to answer query" });
    }
  });
}
