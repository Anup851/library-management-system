import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditLog,
  Book,
  Branch,
  Notification,
  Reservation,
  Review,
  Role,
  Transaction,
  User,
} from "@shared/schema";

export type StoredUser = User & {
  passwordHash?: string;
};

export type LibraryState = {
  users: StoredUser[];
  branches: Branch[];
  books: Book[];
  transactions: Transaction[];
  reservations: Reservation[];
  reviews: Review[];
  notifications: Notification[];
  auditLogs: AuditLog[];
};

type BranchRow = {
  id: string;
  name: string;
  code: string;
  address: string;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role: Role;
  branch_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

type BookRow = {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  barcode: string;
  description?: string | null;
  cover_image?: string | null;
  ebook_url?: string | null;
  published_year?: number | null;
  language?: string | null;
  format: "physical" | "digital" | "hybrid";
  total_copies?: number | null;
  available_copies?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BookBranchRow = {
  id: string;
  book_id: string;
  branch_id: string;
};

type TransactionRow = {
  id: string;
  book_id: string;
  user_id: string;
  branch_id?: string | null;
  issued_by?: string | null;
  returned_to?: string | null;
  issued_at?: string | null;
  due_date: string;
  returned_at?: string | null;
  fine_amount?: number | string | null;
  status: "ISSUED" | "RETURNED" | "OVERDUE";
};

type ReservationRow = {
  id: string;
  book_id: string;
  user_id: string;
  status: "WAITING" | "READY" | "FULFILLED" | "CANCELLED";
  position: number;
  created_at?: string | null;
  notified_at?: string | null;
};

type ReviewRow = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number | string;
  comment?: string | null;
  created_at?: string | null;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  channel: "email" | "sms" | "in_app";
  read?: boolean | null;
  created_at?: string | null;
};

type AuditLogRow = {
  id: string;
  actor_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
};

const DATA_PATH = path.resolve(process.cwd(), "server", "data", "library-db.json");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

function toIso(value?: string | null) {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
}

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return fallback;
}

function mapBranch(row: BranchRow): Branch {
  return {
    _id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
  };
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    _id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    branchId: row.branch_id || "",
    issuedBy: row.issued_by || "",
    returnedTo: row.returned_to || undefined,
    issuedAt: toIso(row.issued_at),
    dueDate: toIso(row.due_date),
    returnedAt: row.returned_at ? toIso(row.returned_at) : undefined,
    fineAmount: toNumber(row.fine_amount, 0),
    status: row.status,
  };
}

function mapReservation(row: ReservationRow): Reservation {
  return {
    _id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    status: row.status,
    position: row.position,
    createdAt: toIso(row.created_at),
    notifiedAt: row.notified_at ? toIso(row.notified_at) : undefined,
  };
}

function mapReview(row: ReviewRow): Review {
  return {
    _id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    rating: toNumber(row.rating, 0),
    comment: row.comment || "",
    createdAt: toIso(row.created_at),
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    _id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    channel: row.channel,
    read: Boolean(row.read),
    createdAt: toIso(row.created_at),
  };
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    _id: row.id,
    actorId: row.actor_id || "",
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id || "",
    details: row.details || {},
    createdAt: toIso(row.created_at),
  };
}

function computeBorrowingHistory(profileId: string, transactions: TransactionRow[]) {
  return transactions
    .filter((transaction) => transaction.user_id === profileId)
    .sort((a, b) => new Date(b.issued_at || 0).getTime() - new Date(a.issued_at || 0).getTime())
    .map((transaction) => transaction.book_id)
    .slice(0, 20);
}

function mapProfile(row: ProfileRow, transactions: TransactionRow[]): StoredUser {
  return {
    _id: row.id,
    name: row.full_name || row.email || "User",
    email: row.email || "",
    role: row.role,
    branchId: row.branch_id || undefined,
    avatar: row.avatar_url || undefined,
    phone: undefined,
    registrationNumber: row.phone || undefined,
    borrowingHistory: computeBorrowingHistory(row.id, transactions),
    createdAt: toIso(row.created_at),
  };
}

function mapBook(
  row: BookRow,
  bookBranches: BookBranchRow[],
  reviews: Review[],
): Book {
  const relatedBranches = bookBranches.filter((link) => link.book_id === row.id).map((link) => link.branch_id);
  const relatedReviews = reviews.filter((review) => review.bookId === row.id);
  const ratingCount = relatedReviews.length;
  const ratingAverage = ratingCount
    ? Number((relatedReviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount).toFixed(1))
    : 0;

  return {
    _id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    isbn: row.isbn,
    barcode: row.barcode,
    description: row.description || "",
    coverImage: row.cover_image || undefined,
    ebookUrl: row.ebook_url || undefined,
    publishedYear: row.published_year || 0,
    language: row.language || "English",
    format: row.format,
    tags: [],
    branchIds: relatedBranches,
    totalCopies: row.total_copies || 0,
    availableCopies: row.available_copies || 0,
    ratingAverage,
    ratingCount,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function ensureFileSeed(): Promise<LibraryState> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw) as LibraryState;
}

async function selectAll<T>(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("*");
  if (error) {
    throw new Error(`Unable to read Supabase table "${table}": ${error.message}`);
  }
  return (data || []) as T[];
}

async function upsertRows<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  onConflict = "id",
) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`Unable to write Supabase table "${table}": ${error.message}`);
  }
}

async function deleteMissingRows(client: SupabaseClient, table: string, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await client.from(table).delete().not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
  if (error) {
    throw new Error(`Unable to sync Supabase table "${table}": ${error.message}`);
  }
}

async function replaceBookBranches(client: SupabaseClient, books: Book[]) {
  const allLinks = books.flatMap((book) =>
    book.branchIds.map((branchId) => ({
      id: crypto.randomUUID(),
      book_id: book._id,
      branch_id: branchId,
    })),
  );

  const existing = await selectAll<BookBranchRow>(client, "book_branches");
  if (existing.length > 0) {
    const { error } = await client.from("book_branches").delete().in("id", existing.map((row) => row.id));
    if (error) {
      throw new Error(`Unable to update Supabase table "book_branches": ${error.message}`);
    }
  }

  if (allLinks.length > 0) {
    const { error } = await client.from("book_branches").insert(allLinks);
    if (error) {
      throw new Error(`Unable to write Supabase table "book_branches": ${error.message}`);
    }
  }
}

function toProfileRow(user: StoredUser): ProfileRow {
  return {
    id: user._id,
    full_name: user.name,
    email: user.email,
    role: user.role,
    branch_id: user.branchId || null,
    phone: user.registrationNumber || user.phone || null,
    avatar_url: user.avatar || null,
    created_at: user.createdAt,
  };
}

function toBookRow(book: Book): BookRow {
  return {
    id: book._id,
    title: book.title,
    author: book.author,
    category: book.category,
    isbn: book.isbn,
    barcode: book.barcode,
    description: book.description,
    cover_image: book.coverImage || null,
    ebook_url: book.ebookUrl || null,
    published_year: book.publishedYear,
    language: book.language,
    format: book.format,
    total_copies: book.totalCopies,
    available_copies: book.availableCopies,
    created_at: book.createdAt,
    updated_at: book.updatedAt,
  };
}

function toTransactionRow(transaction: Transaction): TransactionRow {
  return {
    id: transaction._id,
    book_id: transaction.bookId,
    user_id: transaction.userId,
    branch_id: transaction.branchId || null,
    issued_by: transaction.issuedBy || null,
    returned_to: transaction.returnedTo || null,
    issued_at: transaction.issuedAt,
    due_date: transaction.dueDate,
    returned_at: transaction.returnedAt || null,
    fine_amount: transaction.fineAmount,
    status: transaction.status,
  };
}

function toReservationRow(reservation: Reservation): ReservationRow {
  return {
    id: reservation._id,
    book_id: reservation.bookId,
    user_id: reservation.userId,
    status: reservation.status,
    position: reservation.position,
    created_at: reservation.createdAt,
    notified_at: reservation.notifiedAt || null,
  };
}

function toReviewRow(review: Review): ReviewRow {
  return {
    id: review._id,
    book_id: review.bookId,
    user_id: review.userId,
    rating: review.rating,
    comment: review.comment,
    created_at: review.createdAt,
  };
}

function toNotificationRow(notification: Notification): NotificationRow {
  return {
    id: notification._id,
    user_id: notification.userId,
    title: notification.title,
    message: notification.message,
    channel: notification.channel,
    read: notification.read,
    created_at: notification.createdAt,
  };
}

function toAuditLogRow(log: AuditLog): AuditLogRow {
  return {
    id: log._id,
    actor_id: log.actorId || null,
    action: log.action,
    entity: log.entity,
    entity_id: log.entityId || null,
    details: log.details,
    created_at: log.createdAt,
  };
}

async function writeSupabaseState(client: SupabaseClient, state: LibraryState) {
  await upsertRows(client, "profiles", state.users.map(toProfileRow));
  await upsertRows(client, "branches", state.branches.map((branch) => ({
    id: branch._id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
  })));
  await upsertRows(client, "books", state.books.map(toBookRow));
  await replaceBookBranches(client, state.books);
  // Validate book availability before upserting transactions
  const validTransactions = state.transactions.filter((transaction) => {
    const book = state.books.find((b) => b._id === transaction.bookId);
    if (!book || book.availableCopies <= 0) {
      console.warn(`Skipping transaction for book ID ${transaction.bookId}: No copies available.`);
      return false;
    }
    return true;
  });

  await upsertRows(client, "transactions", validTransactions.map(toTransactionRow));
  await upsertRows(client, "reservations", state.reservations.map(toReservationRow));
  await upsertRows(client, "reviews", state.reviews.map(toReviewRow));
  await upsertRows(client, "notifications", state.notifications.map(toNotificationRow));
  await upsertRows(client, "audit_logs", state.auditLogs.map(toAuditLogRow));

  await deleteMissingRows(client, "books", state.books.map((book) => book._id));
}

export async function readState(): Promise<LibraryState> {
  const client = getSupabaseClient();
  if (!client) {
    return ensureFileSeed();
  }

  const [profiles, branches, bookRows, bookBranches, transactionRows, reservationRows, reviewRows, notificationRows, auditLogRows] =
    await Promise.all([
      selectAll<ProfileRow>(client, "profiles"),
      selectAll<BranchRow>(client, "branches"),
      selectAll<BookRow>(client, "books"),
      selectAll<BookBranchRow>(client, "book_branches"),
      selectAll<TransactionRow>(client, "transactions"),
      selectAll<ReservationRow>(client, "reservations"),
      selectAll<ReviewRow>(client, "reviews"),
      selectAll<NotificationRow>(client, "notifications"),
      selectAll<AuditLogRow>(client, "audit_logs"),
    ]);

  const transactions = transactionRows.map(mapTransaction);
  const reviews = reviewRows.map(mapReview);

  return {
    users: profiles.map((profile) => mapProfile(profile, transactionRows)),
    branches: branches.map(mapBranch),
    books: bookRows.map((book) => mapBook(book, bookBranches, reviews)),
    transactions,
    reservations: reservationRows.map(mapReservation),
    reviews,
    notifications: notificationRows.map(mapNotification),
    auditLogs: auditLogRows.map(mapAuditLog),
  };
}

export async function writeState(state: LibraryState) {
  const client = getSupabaseClient();
  if (!client) {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(state, null, 2));
    return;
  }

  await writeSupabaseState(client, state);
}

export function publicUser(user: StoredUser): User {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function isStaff(role: Role) {
  return role === "admin" || role === "librarian";
}
