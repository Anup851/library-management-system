import { z } from "zod";

export const roles = ["admin", "librarian", "student"] as const;
export const transactionStatuses = ["ISSUED", "RETURNED", "OVERDUE"] as const;
export const reservationStatuses = ["WAITING", "READY", "FULFILLED", "CANCELLED"] as const;
export const notificationChannels = ["email", "sms", "in_app"] as const;

export type Role = (typeof roles)[number];
export type TransactionStatus = (typeof transactionStatuses)[number];
export type ReservationStatus = (typeof reservationStatuses)[number];
export type NotificationChannel = (typeof notificationChannels)[number];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const branchSchema = z.object({
  _id: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string(),
});

export const userSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(roles),
  branchId: z.string().optional(),
  avatar: z.string().optional(),
  phone: z.string().optional(),
  borrowingHistory: z.array(z.string()).default([]),
  createdAt: z.string(),
});

export const bookSchema = z.object({
  _id: z.string(),
  title: z.string(),
  author: z.string(),
  category: z.string(),
  isbn: z.string(),
  barcode: z.string(),
  description: z.string(),
  coverImage: z.string().optional(),
  ebookUrl: z.string().optional(),
  publishedYear: z.number(),
  language: z.string(),
  format: z.enum(["physical", "digital", "hybrid"]),
  tags: z.array(z.string()).default([]),
  branchIds: z.array(z.string()).default([]),
  totalCopies: z.number().int().min(0),
  availableCopies: z.number().int().min(0),
  ratingAverage: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const transactionSchema = z.object({
  _id: z.string(),
  bookId: z.string(),
  userId: z.string(),
  branchId: z.string(),
  issuedBy: z.string(),
  returnedTo: z.string().optional(),
  issuedAt: z.string(),
  dueDate: z.string(),
  returnedAt: z.string().optional(),
  fineAmount: z.number().min(0).default(0),
  status: z.enum(transactionStatuses),
});

export const reservationSchema = z.object({
  _id: z.string(),
  bookId: z.string(),
  userId: z.string(),
  status: z.enum(reservationStatuses),
  position: z.number().int().min(1),
  createdAt: z.string(),
  notifiedAt: z.string().optional(),
});

export const reviewSchema = z.object({
  _id: z.string(),
  bookId: z.string(),
  userId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
});

export const notificationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  channel: z.enum(notificationChannels),
  read: z.boolean().default(false),
  createdAt: z.string(),
});

export const auditLogSchema = z.object({
  _id: z.string(),
  actorId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  details: z.record(z.any()).default({}),
  createdAt: z.string(),
});

export const issueBookSchema = z.object({
  userId: z.string(),
  branchId: z.string(),
  bookId: z.string().optional(),
  scanCode: z.string().optional(),
  dueDate: z.string(),
});

export const returnBookSchema = z.object({
  transactionId: z.string().optional(),
  scanCode: z.string().optional(),
});

export const createBookSchema = bookSchema.omit({
  _id: true,
  ratingAverage: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBookSchema = createBookSchema.partial();

export const createReviewSchema = z.object({
  bookId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(3),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(roles),
  branchId: z.string().optional(),
});

export const chatbotSchema = z.object({
  message: z.string().min(2),
});

export const dashboardSchema = z.object({
  totals: z.object({
    books: z.number(),
    users: z.number(),
    activeLoans: z.number(),
    overdueBooks: z.number(),
    reservations: z.number(),
    digitalTitles: z.number(),
    fineRevenue: z.number(),
  }),
  mostBorrowedBooks: z.array(
    z.object({
      bookId: z.string(),
      title: z.string(),
      borrowCount: z.number(),
    }),
  ),
  activeUsers: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      borrowCount: z.number(),
    }),
  ),
  overdueItems: z.array(transactionSchema),
});

export type Branch = z.infer<typeof branchSchema>;
export type User = z.infer<typeof userSchema>;
export type Book = z.infer<typeof bookSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type DashboardData = z.infer<typeof dashboardSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type IssueBookInput = z.infer<typeof issueBookSchema>;
export type ReturnBookInput = z.infer<typeof returnBookSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export type AuthUser = User;

export type AuthResponse = {
  token: string;
  user: User;
};

export type ChatbotResponse = {
  reply: string;
  suggestedBooks: Book[];
};
